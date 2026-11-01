// src/features/recipeBook/dedupe/DuplicateReview.js
//
// Review possible duplicate recipes and, only after an explicit confirmation that lists
// exactly what happens, delete the extra copies. Planned meals that use a deleted copy
// are moved to the kept recipe first, so the meal plan never points at a missing recipe.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkingPlan, updateWorkingPlan, getWorkingSession } from '../../mealPlanner/workingPlanStore';
import { listMeals, setSlot, slotsForRecipe } from '../../mealPlanner/mealPlanModel';
import { describeRecipe, linkRecipes } from './findDuplicateRecipes';
import styles from './DuplicateReview.module.css';

const formatDate = (millis) =>
  millis === null || millis === undefined
    ? 'Unknown'
    : new Date(millis).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Keep Tab / Shift+Tab inside `container`. */
export function trapTab(event, container) {
  if (event.key !== 'Tab' || !container) return;
  const items = Array.from(container.querySelectorAll(FOCUSABLE));
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = container.contains(active);
  if (event.shiftKey && (!inside || active === first || !items.includes(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const titleOf = (recipe) => recipe?.title || 'Untitled recipe';

/** Planned slots holding one of `ids` (matched by recipe id only). */
export function slotsUsingIds(plan, ids) {
  const wanted = new Set(ids.map(String));
  return listMeals(plan).filter(({ slot }) => slot.recipe?.id !== undefined && wanted.has(String(slot.recipe.id)));
}

/** Pure: plan with every slot holding one of `ids` pointed at `kept`, servings unchanged. */
export function repointPlan(plan, ids, kept) {
  return slotsUsingIds(plan, ids).reduce(
    (next, { day, meal, slot }) => setSlot(next, day, meal, { recipe: kept, servings: slot.servings }),
    plan,
  );
}

const plannedText = (plan, recipe) => {
  const slots = slotsForRecipe(plan, recipe);
  return slots.length ? slots.map(({ day, meal }) => `${day.slice(0, 3)} ${meal}`).join(', ') : 'Not planned';
};

function RecipeColumn({ group, recipe, index, keepId, spared, unlinked, plan, onKeep, onToggleDelete }) {
  const facts = describeRecipe(recipe);
  const isKept = recipe.id === keepId;
  const copy = `copy ${index + 1}`;
  return (
    <li className={`${styles.column} ${isKept ? styles.kept : ''}`}>
      <label className={styles.keepChoice}>
        <input
          type="radio"
          name={`keep-${group.key}`}
          checked={isKept}
          onChange={() => onKeep(recipe.id)}
          aria-label={`Keep ${copy}: ${titleOf(recipe)}`}
        />
        <span>{isKept ? 'Keep this one' : 'Keep this one instead'}</span>
      </label>
      <h4 className={styles.columnTitle}>{titleOf(recipe)}</h4>
      <p className={styles.copyLabel}>
        Copy {index + 1}
        {recipe.id === group.suggestedKeepId ? ' · suggested' : ''}
      </p>
      <dl className={styles.facts}>
        <dt>Servings</dt><dd>{facts.hasServings ? String(recipe.servings) : '—'}</dd>
        <dt>Ingredients</dt><dd>{facts.ingredientCount}</dd>
        <dt>Instructions</dt><dd>{facts.hasInstructions ? 'Yes' : 'No'}</dd>
        <dt>Photo</dt><dd>{facts.hasImage ? 'Yes' : 'No'}</dd>
        <dt>Last updated</dt><dd>{formatDate(facts.updatedAt ?? facts.createdAt)}</dd>
        <dt>Planned</dt><dd>{plannedText(plan, recipe)}</dd>
      </dl>
      {!isKept && (
        <label className={styles.deleteChoice}>
          <input
            type="checkbox"
            checked={!spared.includes(recipe.id)}
            onChange={() => onToggleDelete(recipe.id)}
            aria-label={`Delete ${copy}: ${titleOf(recipe)}`}
          />
          <span>Delete this copy</span>
        </label>
      )}
      {!isKept && unlinked.includes(recipe.id) && (
        <p className={styles.note}>Different ingredients from the copy you’re keeping — not selected by default.</p>
      )}
    </li>
  );
}

const DuplicateReview = ({ isOpen, groups, onClose, onDismiss, deleteRecipe }) => {
  const { plan } = useWorkingPlan();
  // groupKey -> { keepId, overrides: { [id]: deleteSelected } }. Overrides reset when Keep changes.
  const [choices, setChoices] = useState({});
  const [step, setStep] = useState({ type: 'review' });
  const headingRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const busy = step.type === 'deleting';

  const choiceFor = useCallback(
    (group) => {
      const saved = choices[group.key];
      const keepId = saved && group.recipes.some((r) => r.id === saved.keepId) ? saved.keepId : group.suggestedKeepId;
      const kept = group.recipes.find((r) => r.id === keepId);
      const overrides = (saved && saved.keepId === keepId && saved.overrides) || {};
      const others = group.recipes.filter((r) => r.id !== keepId);
      // Only copies directly linked to the kept one are pre-selected for deletion.
      const unlinked = others.filter((r) => !linkRecipes(kept, r)).map((r) => r.id);
      const spared = others
        .filter((r) => (r.id in overrides ? !overrides[r.id] : unlinked.includes(r.id)))
        .map((r) => r.id);
      return { keepId, spared, unlinked, overrides };
    },
    [choices],
  );

  const close = useCallback(() => {
    if (busy) return;
    setStep({ type: 'review' });
    onClose();
  }, [busy, onClose]);

  // Remember what had focus so it can be restored; focus the heading on each step.
  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement;
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function' && document.body.contains(opener)) opener.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && headingRef.current) headingRef.current.focus();
  }, [isOpen, step.type]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
      else trapTab(event, dialogRef.current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const setKeep = (group, keepId) =>
    setChoices((prev) => ({ ...prev, [group.key]: { keepId, overrides: {} } }));

  const toggleDelete = (group, id) =>
    setChoices((prev) => {
      const { keepId, spared, overrides } = choiceFor(group);
      // Currently spared -> select for deletion, and vice versa.
      return { ...prev, [group.key]: { keepId, overrides: { ...overrides, [id]: spared.includes(id) } } };
    });

  const startMerge = (group) => {
    const { keepId, spared } = choiceFor(group);
    const kept = group.recipes.find((r) => r.id === keepId);
    const toDelete = group.recipes.filter((r) => r.id !== keepId && !spared.includes(r.id));
    const untouched = group.recipes.filter((r) => r.id !== keepId && spared.includes(r.id));
    if (!kept || toDelete.length === 0) return;
    const copyNumber = (recipe) => group.recipes.indexOf(recipe) + 1;
    const moves = slotsUsingIds(plan, toDelete.map((r) => r.id)).map(({ day, meal, slot }) => ({
      day,
      meal,
      servings: slot.servings,
      from: toDelete.find((r) => String(r.id) === String(slot.recipe.id)),
    }));
    setStep({ type: 'confirm', group, kept, toDelete, untouched, moves, copyNumber });
  };

  const confirmMerge = async () => {
    const { group, kept, toDelete, copyNumber } = step;
    setStep({ ...step, type: 'deleting' });
    // 1. Move planned meals to the kept recipe (harmless even if a delete later fails).
    const ids = toDelete.map((r) => r.id);
    const moved = slotsUsingIds(getWorkingSession().plan, ids).length;
    updateWorkingPlan((current) => repointPlan(current, ids, kept));
    // 2. Delete each copy; one failure does not stop the others.
    const deleted = [];
    const failed = [];
    for (const recipe of toDelete) {
      try {
        await deleteRecipe(recipe.id);
        deleted.push(recipe);
      } catch (err) {
        failed.push({ recipe, message: err?.message || 'Could not delete this recipe.' });
      }
    }
    setStep({ type: 'result', group, kept, deleted, failed, moved, copyNumber });
  };

  const backToReview = () => setStep({ type: 'review' });

  let body;
  if (step.type === 'review') {
    body = (
      <>
        <header className={styles.header}>
          <h2 id="duplicate-review-title" ref={headingRef} tabIndex={-1}>
            Possible duplicates
          </h2>
          <button type="button" className={styles.close} onClick={close} aria-label="Close duplicate review">
            ×
          </button>
        </header>
        <p className={styles.intro}>
          Pick the copy to keep. Nothing is deleted until you confirm on the next screen.
        </p>
        {groups.length === 0 ? (
          <p className={styles.empty}>No possible duplicates left to review.</p>
        ) : (
          groups.map((group) => {
            const { keepId, spared, unlinked } = choiceFor(group);
            const deleteCount = group.recipes.filter((r) => r.id !== keepId && !spared.includes(r.id)).length;
            const headingId = `dup-group-${group.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            return (
              <section key={group.key} className={styles.group} aria-labelledby={headingId}>
                <div className={styles.groupHeader}>
                  <h3 id={headingId}>{titleOf(group.recipes[0])}</h3>
                  <span className={`${styles.badge} ${group.confidence === 'exact' ? styles.exact : ''}`}>
                    {group.confidence === 'exact' ? 'Exact match' : 'Likely duplicate'}
                  </span>
                </div>
                <p className={styles.reason}>{group.reason}</p>
                <ul className={styles.columns} aria-label={`Copies of ${titleOf(group.recipes[0])}`}>
                  {group.recipes.map((recipe, index) => (
                    <RecipeColumn
                      key={recipe.id}
                      group={group}
                      recipe={recipe}
                      index={index}
                      keepId={keepId}
                      spared={spared}
                      unlinked={unlinked}
                      plan={plan}
                      onKeep={(id) => setKeep(group, id)}
                      onToggleDelete={(id) => toggleDelete(group, id)}
                    />
                  ))}
                </ul>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={() => onDismiss(group.key)}>
                    Not duplicates
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => startMerge(group)}
                    disabled={deleteCount === 0}
                  >
                    Merge…
                  </button>
                </div>
              </section>
            );
          })
        )}
      </>
    );
  } else if (step.type === 'confirm' || step.type === 'deleting') {
    const { kept, toDelete, untouched = [], moves = [], copyNumber } = step;
    body = (
      <>
        <header className={styles.header}>
          <h2 id="duplicate-review-title" ref={headingRef} tabIndex={-1}>
            Confirm merge
          </h2>
        </header>
        <div className={styles.summary}>
          <h3>Keep</h3>
          <ul aria-label="Recipe to keep">
            <li>{titleOf(kept)} <span className={styles.muted}>(copy {copyNumber(kept)})</span></li>
          </ul>
          <h3>Delete permanently ({toDelete.length})</h3>
          <ul aria-label="Recipes to delete">
            {toDelete.map((r) => (
              <li key={r.id}>{titleOf(r)} <span className={styles.muted}>(copy {copyNumber(r)})</span></li>
            ))}
          </ul>
          {untouched.length > 0 && (
            <>
              <h3>Left as they are</h3>
              <ul aria-label="Recipes left untouched">
                {untouched.map((r) => (
                  <li key={r.id}>{titleOf(r)} <span className={styles.muted}>(copy {copyNumber(r)})</span></li>
                ))}
              </ul>
            </>
          )}
          <h3>Planned meals moved to the kept recipe</h3>
          {moves.length ? (
            <ul aria-label="Planned meals to move">
              {moves.map((m) => (
                <li key={`${m.day}-${m.meal}`}>
                  {m.day} · {m.meal} — {plural(m.servings, 'serving')}, was copy {copyNumber(m.from)}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>None of the copies being deleted are in your meal plan.</p>
          )}
          <p className={styles.warning}>Deleting can’t be undone.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={backToReview} disabled={busy}>
            Back
          </button>
          <button type="button" className={styles.danger} onClick={confirmMerge} disabled={busy || toDelete.length === 0}>
            {busy ? 'Deleting…' : `Delete ${plural(toDelete.length, 'recipe')}`}
          </button>
        </div>
      </>
    );
  } else {
    const { kept, deleted, failed, moved, copyNumber } = step;
    body = (
      <>
        <header className={styles.header}>
          <h2 id="duplicate-review-title" ref={headingRef} tabIndex={-1}>
            {failed.length ? 'Merge finished with problems' : 'Merge complete'}
          </h2>
        </header>
        <div className={styles.summary} role="status">
          <p>
            Kept “{titleOf(kept)}”.{' '}
            {moved > 0 ? `${plural(moved, 'planned meal')} now use it.` : ''}
          </p>
          {deleted.length > 0 && (
            <ul aria-label="Deleted recipes">
              {deleted.map((r) => (
                <li key={r.id}>Deleted {titleOf(r)} (copy {copyNumber(r)})</li>
              ))}
            </ul>
          )}
          {failed.length > 0 && (
            <ul aria-label="Recipes that could not be deleted" className={styles.errors}>
              {failed.map(({ recipe, message }) => (
                <li key={recipe.id}>
                  Could not delete {titleOf(recipe)} (copy {copyNumber(recipe)}): {message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={close}>
            Close
          </button>
          <button type="button" className={styles.primary} onClick={backToReview}>
            Back to duplicates
          </button>
        </div>
      </>
    );
  }

  return (
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="duplicate-review-title">
        {body}
      </div>
    </div>
  );
};

export default DuplicateReview;
