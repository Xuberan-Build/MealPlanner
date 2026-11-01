import {
  getSlot,
  setSlot,
  removeSlot,
  findConflicts,
  assignRecipe,
  listMeals,
  countMeals,
  isPlanEmpty,
  summarizePlan,
  plansEqual,
  loadWorkingSession,
  saveWorkingSession,
  clearWorkingSession,
  WORKING_PLAN_KEY,
  WORKING_SESSION_KEY,
} from '../mealPlanModel';

const tacos = { id: 'r1', title: 'Tacos', servings: '4' };
const soup = { id: 'r2', title: 'Soup', servings: '6' };

const memoryStorage = () => {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
    data,
  };
};

describe('getSlot', () => {
  test('reads the current { recipe, servings } format', () => {
    const plan = { Monday: { Dinner: { recipe: tacos, servings: 2 } } };
    expect(getSlot(plan, 'Monday', 'Dinner')).toEqual({ recipe: tacos, servings: 2 });
  });

  test('reads the legacy bare-recipe format and strips selectedServings', () => {
    const plan = { Monday: { Dinner: { ...tacos, selectedServings: 3 } } };
    expect(getSlot(plan, 'Monday', 'Dinner')).toEqual({ recipe: tacos, servings: 3 });
  });

  test('coerces string/invalid servings to a positive integer', () => {
    expect(getSlot({ Mon: { D: { recipe: tacos, servings: '5' } } }, 'Mon', 'D').servings).toBe(5);
    expect(getSlot({ Mon: { D: { recipe: tacos, servings: 'abc' } } }, 'Mon', 'D').servings).toBe(1);
    expect(getSlot({ Mon: { D: { recipe: tacos, servings: 0 } } }, 'Mon', 'D').servings).toBe(1);
  });

  test('returns null for empty or malformed slots', () => {
    expect(getSlot({}, 'Monday', 'Dinner')).toBeNull();
    expect(getSlot(null, 'Monday', 'Dinner')).toBeNull();
    expect(getSlot({ Monday: { Dinner: {} } }, 'Monday', 'Dinner')).toBeNull();
    expect(getSlot({ Monday: { Dinner: 'tacos' } }, 'Monday', 'Dinner')).toBeNull();
  });
});

describe('setSlot / removeSlot', () => {
  test('setSlot is immutable and keeps other meals on the day', () => {
    const plan = { Monday: { Lunch: { recipe: soup, servings: 1 } } };
    const next = setSlot(plan, 'Monday', 'Dinner', { recipe: tacos, servings: 2 });
    expect(next).not.toBe(plan);
    expect(next.Monday).not.toBe(plan.Monday);
    expect(plan.Monday.Dinner).toBeUndefined();
    expect(next.Monday.Lunch).toEqual({ recipe: soup, servings: 1 });
    expect(next.Monday.Dinner).toEqual({ recipe: tacos, servings: 2 });
  });

  test('setSlot never stores the UI-only selectedServings field', () => {
    const next = setSlot({}, 'Monday', 'Dinner', { recipe: { ...tacos, selectedServings: 9 }, servings: 2 });
    expect(next.Monday.Dinner.recipe).toEqual(tacos);
  });

  test('removeSlot removes one meal and drops empty days', () => {
    const plan = {
      Monday: { Lunch: { recipe: soup, servings: 1 }, Dinner: { recipe: tacos, servings: 2 } },
      Tuesday: { Dinner: { recipe: tacos, servings: 2 } },
    };
    const afterDinner = removeSlot(plan, 'Monday', 'Dinner');
    expect(afterDinner.Monday).toEqual({ Lunch: { recipe: soup, servings: 1 } });
    expect(plan.Monday.Dinner).toBeDefined(); // original untouched

    const afterTuesday = removeSlot(afterDinner, 'Tuesday', 'Dinner');
    expect(afterTuesday).not.toHaveProperty('Tuesday');
  });

  test('removeSlot on an empty slot returns the same plan', () => {
    const plan = { Monday: {} };
    expect(removeSlot(plan, 'Monday', 'Dinner')).toBe(plan);
  });
});

describe('findConflicts / assignRecipe', () => {
  const plan = {
    Tuesday: { Dinner: { recipe: tacos, servings: 4 } },
    Thursday: { Dinner: { recipe: soup, servings: 2 } },
    Friday: { Lunch: { recipe: soup, servings: 2 } },
  };

  test('reports days whose slot holds a different recipe, in week order', () => {
    expect(findConflicts(plan, ['Thursday', 'Tuesday', 'Wednesday'], 'Dinner', soup)).toEqual([
      { day: 'Tuesday', title: 'Tacos' },
    ]);
    expect(findConflicts(plan, ['Thursday', 'Tuesday'], 'Dinner', { id: 'r3', title: 'Curry' })).toEqual([
      { day: 'Tuesday', title: 'Tacos' },
      { day: 'Thursday', title: 'Soup' },
    ]);
  });

  test('same recipe in the slot (e.g. changing servings) is not a conflict', () => {
    expect(findConflicts(plan, ['Tuesday'], 'Dinner', tacos)).toEqual([]);
  });

  test('other meal types on the same day are not conflicts', () => {
    expect(findConflicts(plan, ['Friday'], 'Dinner', tacos)).toEqual([]);
  });

  test('assignRecipe writes every selected day', () => {
    const next = assignRecipe(plan, {
      recipe: tacos,
      servings: 3,
      days: ['Monday', 'Thursday'],
      meal: 'Dinner',
    });
    expect(getSlot(next, 'Monday', 'Dinner')).toEqual({ recipe: tacos, servings: 3 });
    expect(getSlot(next, 'Thursday', 'Dinner')).toEqual({ recipe: tacos, servings: 3 });
    expect(getSlot(next, 'Tuesday', 'Dinner')).toEqual({ recipe: tacos, servings: 4 });
  });
});

describe('listing, summaries and equality', () => {
  // Keys deliberately out of week order (Firestore/JS key order is not week order).
  const plan = {
    Saturday: { Dinner: { recipe: soup, servings: 2 } },
    Monday: { Dinner: { recipe: tacos, servings: 4 } },
    Wednesday: { Lunch: { recipe: soup, servings: 1 }, Dinner: { recipe: tacos, servings: 2 } },
    Tuesday: {},
  };

  test('listMeals is in week order and skips empty days', () => {
    expect(listMeals(plan).map(({ day, meal }) => `${day}/${meal}`)).toEqual([
      'Monday/Dinner',
      'Wednesday/Lunch',
      'Wednesday/Dinner',
      'Saturday/Dinner',
    ]);
    expect(countMeals(plan)).toBe(4);
  });

  test('isPlanEmpty treats days with no meals as empty', () => {
    expect(isPlanEmpty({})).toBe(true);
    expect(isPlanEmpty({ Monday: {} })).toBe(true);
    expect(isPlanEmpty(plan)).toBe(false);
  });

  test('summarizePlan is week-ordered and says how many are hidden', () => {
    expect(summarizePlan(plan)).toBe('Mon: Tacos • Wed: Soup • Wed: Tacos • +1 more');
    expect(summarizePlan(plan, 10)).toBe('Mon: Tacos • Wed: Soup • Wed: Tacos • Sat: Soup');
    expect(summarizePlan({})).toBe('No meals added');
  });

  test('plansEqual ignores key order and legacy-vs-new format', () => {
    const legacy = {
      Monday: { Dinner: { ...tacos, selectedServings: 4 } },
      Wednesday: { Dinner: { recipe: tacos, servings: 2 }, Lunch: { recipe: soup, servings: 1 } },
      Saturday: { Dinner: { recipe: soup, servings: 2 } },
    };
    // `legacy` has the same meals as `plan`, but Monday is in the legacy format and
    // Wednesday's meal keys are in a different insertion order.
    expect(plansEqual(plan, legacy)).toBe(true);
    expect(plansEqual(plan, plan)).toBe(true);
    expect(plansEqual({}, { Monday: {} })).toBe(true);
    expect(plansEqual(plan, setSlot(plan, 'Monday', 'Dinner', { recipe: tacos, servings: 5 }))).toBe(false);
    expect(plansEqual(plan, removeSlot(plan, 'Saturday', 'Dinner'))).toBe(false);
    expect(plansEqual(legacy, legacy)).toBe(true);
  });
});

describe('working session persistence', () => {
  test('round-trips the plan and the plan being edited', () => {
    const storage = memoryStorage();
    const plan = { Monday: { Dinner: { recipe: tacos, servings: 2 } } };
    const editingPlan = { id: 'p1', name: 'Week 1', plan: { ignored: true } };
    saveWorkingSession(storage, { plan, editingPlan, originalPlan: {} });

    expect(loadWorkingSession(storage)).toEqual({
      plan,
      editingPlan: { id: 'p1', name: 'Week 1' },
      originalPlan: {},
    });
  });

  test('saving without an editing plan clears the edit context', () => {
    const storage = memoryStorage();
    saveWorkingSession(storage, { plan: {}, editingPlan: { id: 'p1', name: 'W' }, originalPlan: {} });
    saveWorkingSession(storage, { plan: {}, editingPlan: null, originalPlan: null });
    expect(storage.data[WORKING_SESSION_KEY]).toBeUndefined();
    expect(loadWorkingSession(storage).editingPlan).toBeNull();
  });

  test('corrupt or missing storage falls back to an empty plan', () => {
    const storage = memoryStorage();
    storage.setItem(WORKING_PLAN_KEY, '{not json');
    storage.setItem(WORKING_SESSION_KEY, '{"editingPlan":{"id":"x"}}'); // missing name
    expect(loadWorkingSession(storage)).toEqual({ plan: {}, editingPlan: null, originalPlan: null });
    expect(loadWorkingSession(null)).toEqual({ plan: {}, editingPlan: null, originalPlan: null });
  });

  test('a throwing storage never crashes saving or clearing', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => saveWorkingSession(throwing, { plan: {}, editingPlan: null })).not.toThrow();
    expect(() => clearWorkingSession(throwing)).not.toThrow();
    expect(loadWorkingSession(throwing).plan).toEqual({});
    warn.mockRestore();
  });
});
