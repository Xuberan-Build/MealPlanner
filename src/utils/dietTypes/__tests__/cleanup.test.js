import {
  formatCleanupReport,
  likelyTypoOf,
  parseCleanupArgs,
  planGlobalDietTypeMerges,
  planRecipeDietTypes,
} from '../cleanup';

describe('parseCleanupArgs', () => {
  test('dry run by default', () => {
    expect(parseCleanupArgs(['--project', 'demo'])).toEqual({ project: 'demo', apply: false, user: null, verbose: false });
    expect(parseCleanupArgs(['--project=demo', '--dry-run']).apply).toBe(false);
  });

  test('--apply, --user, --verbose', () => {
    expect(parseCleanupArgs(['--project', 'demo', '--apply', '--user', 'u1', '-v']))
      .toEqual({ project: 'demo', apply: true, user: 'u1', verbose: true });
    expect(parseCleanupArgs(['--user=u2', '--project=p']).user).toBe('u2');
  });

  test('errors', () => {
    expect(() => parseCleanupArgs([])).toThrow(/--project/);
    expect(() => parseCleanupArgs(['--project'])).toThrow(/--project/);
    expect(() => parseCleanupArgs(['--project', '--apply'])).toThrow(/--project/);
    expect(() => parseCleanupArgs(['--project', 'p', '--apply', '--dry-run'])).toThrow(/either/);
    expect(() => parseCleanupArgs(['--project', 'p', '--force'])).toThrow(/Unknown/);
    expect(() => parseCleanupArgs(['--project', 'p', '--user'])).toThrow(/--user/);
  });
});

describe('planRecipeDietTypes', () => {
  test('already clean -> no change', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'Vegan', dietTypes: ['Vegan'] });
    expect(plan.changed).toBe(false);
    expect(plan.update).toEqual({});
    expect(plan.categories).toEqual([]);
  });

  test('no diet type at all -> no change, no field created', () => {
    expect(planRecipeDietTypes({ id: 'r' }).changed).toBe(false);
    expect(planRecipeDietTypes({ id: 'r', dietType: '', dietTypes: [] }).changed).toBe(false);
  });

  test('formatting', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'vegan ', dietTypes: ['vegan '] });
    expect(plan.update).toEqual({ dietType: 'Vegan', dietTypes: ['Vegan'] });
    expect(plan.categories).toEqual(['formatting']);
  });

  test('alias', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'GF', dietTypes: ['GF'] });
    expect(plan.update).toEqual({ dietType: 'Gluten-Free', dietTypes: ['Gluten-Free'] });
    expect(plan.categories).toContain('alias');
  });

  test('blank "Not Specified" is cleared', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'Not Specified' });
    expect(plan.update).toEqual({ dietType: '' });
    expect(plan.categories).toEqual(['blank']);
  });

  test('fill array from legacy', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'Keto' });
    expect(plan.update).toEqual({ dietTypes: ['Keto'] });
    expect(plan.categories).toEqual(['fill-array']);
  });

  test('duplicates removed', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'Vegan', dietTypes: ['Vegan', 'vegan', 'GF', 'gluten free'] });
    expect(plan.update).toEqual({ dietTypes: ['Vegan', 'Gluten-Free'] });
    expect(plan.categories).toEqual(expect.arrayContaining(['duplicate', 'alias', 'formatting']));
  });

  test('legacy value missing from the array is kept and flagged as conflict', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'vegan', dietTypes: ['Keto'] });
    expect(plan.update).toEqual({ dietType: 'Vegan' });
    expect(plan.after).toEqual({ dietType: 'Vegan', dietTypes: ['Keto'] });
    expect(plan.categories).toContain('conflict');
  });

  test('custom types are kept', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'soul food', dietTypes: ['soul food'] });
    expect(plan.after.dietTypes).toEqual(['Soul Food']);
  });

  test('typos are reported, not changed', () => {
    const plan = planRecipeDietTypes({ id: 'r', dietType: 'Vegitarain', dietTypes: ['Vegitarain'] });
    expect(plan.changed).toBe(false);
    expect(plan.typos).toEqual([{ value: 'Vegitarain', suggestion: 'Vegetarian' }]);
    expect(plan.categories).toEqual(['typo']);
  });
});

describe('likelyTypoOf', () => {
  test('only near misses of curated diets', () => {
    expect(likelyTypoOf('Ketoo')).toBe('Keto');
    expect(likelyTypoOf('Keto')).toBeNull();
    expect(likelyTypoOf('Italian')).toBeNull();
    expect(likelyTypoOf('')).toBeNull();
  });
});

describe('planGlobalDietTypeMerges', () => {
  const ts = (s) => ({ seconds: s });
  const docs = [
    { id: 'u-vegan', name: 'vegan ', createdBy: 'u1', createdAt: ts(1) },
    { id: 'vegan', name: 'Vegan', createdBy: 'system', createdAt: ts(5) },
    { id: 'VEGAN', name: 'VEGAN', createdBy: 'u2', createdAt: ts(2) },
    { id: 'gf', name: 'GF', createdBy: 'u1', createdAt: ts(3) },
    { id: 'gluten-free-2', name: 'gluten free', createdBy: 'u2', createdAt: ts(1) },
    { id: 'old', name: 'Vegan', createdBy: 'u3', isActive: false },
    { id: 'merged', name: 'vegan', createdBy: 'u3', mergedInto: 'vegan' },
    { id: 'blank', name: 'Not Specified', createdBy: 'u1' },
    { id: 'typo', name: 'Ketoo', createdBy: 'u1' },
  ];

  test('keeper = system, else oldest; duplicates marked inactive; never deletes', () => {
    const plan = planGlobalDietTypeMerges(docs);
    expect(plan.groups).toEqual([
      { key: 'vegan', name: 'Vegan', keeperId: 'vegan', duplicateIds: ['u-vegan', 'VEGAN'] },
      { key: 'glutenfree', name: 'Gluten-Free', keeperId: 'gluten-free-2', duplicateIds: ['gf'] },
    ]);
    expect(plan.updates).toEqual(expect.arrayContaining([
      { id: 'VEGAN', update: { isActive: false, mergedInto: 'vegan' }, reason: 'merge' },
      { id: 'u-vegan', update: { isActive: false, mergedInto: 'vegan' }, reason: 'merge' },
      { id: 'gf', update: { isActive: false, mergedInto: 'gluten-free-2' }, reason: 'merge' },
      { id: 'gluten-free-2', update: { name: 'Gluten-Free', previousName: 'gluten free' }, reason: 'rename' },
    ]));
    expect(plan.updates).toHaveLength(4);
    expect(plan.updates.some((u) => ['old', 'merged', 'blank'].includes(u.id))).toBe(false);
    expect(plan.updates.every((u) => u.update && typeof u.update === 'object')).toBe(true);
    expect(plan.blankIds).toEqual(['blank']);
    expect(plan.typos).toEqual([{ id: 'typo', value: 'Ketoo', suggestion: 'Keto' }]);
  });
});

describe('formatCleanupReport', () => {
  test('dry-run report lists old -> new and says nothing was written', () => {
    const recipePlans = [
      planRecipeDietTypes({ id: 'r1', dietType: 'GF', dietTypes: ['GF'] }),
      planRecipeDietTypes({ id: 'r2', dietType: 'Vegan', dietTypes: ['Vegan'] }),
      planRecipeDietTypes({ id: 'r3', dietType: 'vegan', dietTypes: ['Keto'] }),
    ];
    const globalPlan = planGlobalDietTypeMerges([
      { id: 'a', name: 'Vegan', createdBy: 'system' },
      { id: 'b', name: 'vegan', createdBy: 'u' },
    ]);
    const report = formatCleanupReport({ recipePlans, globalPlan, apply: false, project: 'demo' });
    expect(report).toContain('[dry-run] project=demo');
    expect(report).toContain('Recipes: 3 scanned, 2 to update');
    expect(report).toContain('dietType:  "GF" -> "Gluten-Free"');
    expect(report).toContain('dietTypes: ["GF"] -> ["Gluten-Free"]');
    expect(report).toContain('Conflicts');
    expect(report).toContain('"Vegan": keep a; mark inactive (mergedInto) b');
    expect(report).toContain('Nothing written');
  });
});
