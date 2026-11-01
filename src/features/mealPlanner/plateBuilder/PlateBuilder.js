// src/features/mealPlanner/plateBuilder/PlateBuilder.js
//
// Pick a protein, veg, carb and extras, adjust per-person portions, choose how many
// people, then continue. All plate logic lives in plateModel; this component only renders
// it and reports `{ recipe, people, saveAsFavorite }` to its parent.

import React, { useId, useMemo, useState } from 'react';
import {
  PLATE_SECTIONS,
  componentKey,
  emptyPlate,
  togglePick,
  setPortion,
  isPicked,
  plateComponents,
  isPlateEmpty,
  plateErrors,
  plateTitle,
  plateToRecipe,
  recipeToPlate,
} from './plateModel';
import styles from './PlateBuilder.module.css';

const UNIT_CHOICES = [
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
  { value: 'g', label: 'g' },
  { value: 'cup', label: 'cup' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'tsp', label: 'tsp' },
  { value: 'slice', label: 'slice' },
  { value: '', label: 'each' },
];

/** Adding an already-picked name keeps it (unlike toggling, which would remove it). */
const addPick = (plate, sectionId, name) => (isPicked(plate, sectionId, name) ? plate : togglePick(plate, sectionId, name));

const MIN_PEOPLE = 1;
const MAX_PEOPLE = 20;
const clampPeople = (n) => Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, Math.round(Number(n) || MIN_PEOPLE)));

/** Free-text "add your own" for one section. */
function CustomPick({ section, onAdd }) {
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };
  return (
    <form className={styles.customPick} onSubmit={submit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Other ${section.label.toLowerCase()}…`}
        aria-label={`Add another ${section.label.toLowerCase()}`}
        className={styles.customInput}
      />
      <button type="submit" className={styles.customAdd} disabled={!text.trim()}>
        Add
      </button>
    </form>
  );
}

const PlateBuilder = ({
  mealType = '',
  initialRecipe = null,
  initialPeople = 1,
  favorites = [],
  submitLabel = 'Choose days',
  onContinue,
}) => {
  const [plate, setPlate] = useState(() => (initialRecipe ? recipeToPlate(initialRecipe) : emptyPlate()));
  const [people, setPeople] = useState(() => clampPeople(initialPeople));
  const [title, setTitle] = useState(initialRecipe?.title || '');
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const uid = useId(); // unique ids for aria-labelledby, even with two builders on screen

  const components = plateComponents(plate);
  const errors = useMemo(() => plateErrors(plate), [plate]);
  const canContinue = !isPlateEmpty(plate) && errors.length === 0;

  const loadFavorite = (recipe) => {
    setPlate(recipeToPlate(recipe));
    setTitle(recipe.title || '');
    setSaveAsFavorite(false); // already a favourite
  };

  const handleContinue = () => {
    if (!canContinue || typeof onContinue !== 'function') return;
    onContinue({
      recipe: plateToRecipe(plate, { title, mealType }),
      people,
      saveAsFavorite,
    });
  };

  return (
    <div className={styles.builder}>
      {favorites.length > 0 && (
        <section className={styles.section} aria-labelledby={`${uid}-favorites`}>
          <h4 id={`${uid}-favorites`} className={styles.sectionTitle}>Your plates</h4>
          <div className={styles.chips}>
            {favorites.map((fav) => (
              <button key={fav.id || fav.title} type="button" className={styles.favChip} onClick={() => loadFavorite(fav)}>
                {fav.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {PLATE_SECTIONS.map((section) => {
        // Picks typed in by the user get their own chip after the built-in choices.
        const builtIn = new Set(section.options.map((o) => componentKey(o.name)));
        const custom = (plate[section.id] || []).filter((c) => !builtIn.has(componentKey(c.name)));
        return (
          <section key={section.id} className={styles.section} aria-labelledby={`${uid}-${section.id}`}>
            <h4 id={`${uid}-${section.id}`} className={styles.sectionTitle}>{section.label}</h4>
            <div className={styles.chips}>
              {[...section.options.map((o) => o.name), ...custom.map((c) => c.name)].map((name) => {
                const picked = isPicked(plate, section.id, name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`${styles.chip} ${picked ? styles.chipOn : ''}`}
                    aria-pressed={picked}
                    onClick={() => setPlate((p) => togglePick(p, section.id, name))}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <CustomPick section={section} onAdd={(name) => setPlate((p) => addPick(p, section.id, name))} />
          </section>
        );
      })}

      <section className={styles.summary} aria-labelledby={`${uid}-summary`}>
        <h4 id={`${uid}-summary`} className={styles.sectionTitle}>Per person</h4>
        {components.length === 0 ? (
          <p className={styles.empty}>Pick at least one thing above.</p>
        ) : (
          <ul className={styles.portions}>
            {components.map((c) => (
              <li key={`${c.section}-${c.name}`} className={styles.portionRow}>
                <span className={styles.portionName}>{c.name}</span>
                <input
                  className={styles.amountInput}
                  value={c.amount}
                  onChange={(e) => setPlate((p) => setPortion(p, c.section, c.name, { amount: e.target.value }))}
                  aria-label={`${c.name} amount per person`}
                  inputMode="decimal"
                />
                <select
                  className={styles.unitSelect}
                  value={UNIT_CHOICES.some((u) => u.value === c.unit) ? c.unit : ''}
                  onChange={(e) => setPlate((p) => setPortion(p, c.section, c.name, { unit: e.target.value }))}
                  aria-label={`${c.name} unit`}
                >
                  {UNIT_CHOICES.map((u) => (
                    <option key={u.label} value={u.value}>{u.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.removePick}
                  onClick={() => setPlate((p) => togglePick(p, c.section, c.name))}
                  aria-label={`Remove ${c.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.length > 0 && (
          <ul className={styles.errors} role="alert">
            {errors.map((msg) => <li key={msg}>{msg}</li>)}
          </ul>
        )}
      </section>

      <div className={styles.footerFields}>
        <div className={styles.field} role="group" aria-labelledby={`${uid}-people`}>
          <span id={`${uid}-people`}>People</span>
          <span className={styles.stepper}>
            <button type="button" onClick={() => setPeople((n) => clampPeople(n - 1))} disabled={people <= MIN_PEOPLE} aria-label="Fewer people">−</button>
            <output aria-live="polite" aria-label="Number of people">{people}</output>
            <button type="button" onClick={() => setPeople((n) => clampPeople(n + 1))} disabled={people >= MAX_PEOPLE} aria-label="More people">+</button>
          </span>
        </div>
        <label className={styles.field}>
          <span>Name (optional)</span>
          <input
            type="text"
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={plateTitle(plate)}
          />
        </label>
        <label className={styles.checkboxField}>
          <input type="checkbox" checked={saveAsFavorite} onChange={(e) => setSaveAsFavorite(e.target.checked)} />
          Save to "Your plates"
        </label>
      </div>

      <button type="button" className="submit-button" onClick={handleContinue} disabled={!canContinue}>
        {submitLabel}
      </button>
    </div>
  );
};

export default PlateBuilder;
