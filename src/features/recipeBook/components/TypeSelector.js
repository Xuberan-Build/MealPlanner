import React, { useState, useRef, useEffect, useMemo, useId, useCallback } from 'react';
import { canonicalDietType, dietTypeKey, compactDietText } from '../../../utils/dietTypes/normalize';
import { suggestDietTypes, highlightMatch, STRONG_REASONS } from '../../../utils/dietTypes/suggest';
import styles from './TypeSelector.module.css';

/**
 * Typeahead for a single type value (Meal Type, Diet Type) using the ARIA combobox pattern.
 *
 * Props (existing contract):
 *   value, onChange(value), onBlur?(), options (strings, or { name } objects), placeholder, label, className
 * Optional:
 *   mode       'diet' | 'plain'. Default: 'diet' when the label/placeholder mentions "diet".
 *              Diet mode ranks against the user's options + the curated diet list, understands
 *              aliases ("GF" -> Gluten-Free), says "Did you mean …?" for near misses, and
 *              commits canonicalDietType(value). Plain mode is ranked autocomplete over `options`.
 *   onCommit   (value, { isNew }) called when a value is committed.
 *   emptyValue What a cleared diet field commits (default '').
 *   limit      Max suggestions while typing (default 8).
 *   id         Input id (default: generated).
 *
 * onChange is called on every keystroke with the raw text (as before) and once more with the
 * committed value. onBlur is called after the committed value has reached the parent (option
 * chosen, Enter, or focus leaving), so a parent's onBlur handler sees the new state.
 */
const DIET_HINT = /diet/i;

const toText = (val) => {
  if (val == null) return '';
  if (Array.isArray(val)) return val.length > 0 ? toText(val[0]) : '';
  if (typeof val === 'object') return typeof val.name === 'string' ? val.name : '';
  return String(val);
};

const TypeSelector = ({
  value,
  onChange,
  onBlur,
  onCommit,
  options = [],
  placeholder = 'Select or type...',
  label,
  className = '',
  mode,
  emptyValue = '',
  limit = 8,
  id,
}) => {
  const isDiet = mode ? mode === 'diet' : DIET_HINT.test(`${label || ''} ${placeholder || ''}`);
  const displayFor = useCallback(
    (val) => (isDiet ? canonicalDietType(toText(val)) || '' : toText(val)),
    [isDiet]
  );

  const generatedId = useId();
  const inputId = id || `type-selector-${generatedId}`;
  const listId = `${inputId}-listbox`;
  const labelId = `${inputId}-label`;
  const optionId = (i) => `${inputId}-option-${i}`;

  const [inputValue, setInputValue] = useState(() => displayFor(value));
  const [isOpen, setIsOpen] = useState(false);
  // null = automatic (strong first match is highlighted); -1 = nothing; n = that item.
  const [activeIndex, setActiveIndex] = useState(null);
  const [blurTick, setBlurTick] = useState(0);

  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);
  const notifiedRef = useRef(false);
  const listRef = useRef(null);
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  // Follow the parent's value, except while the user is editing.
  useEffect(() => {
    if (!focusedRef.current) setInputValue(displayFor(value));
  }, [value, displayFor]);

  // Deferred onBlur: runs after the render that carries the committed value.
  useEffect(() => {
    if (blurTick > 0 && onBlurRef.current) onBlurRef.current();
  }, [blurTick]);

  const optionList = useMemo(() => (Array.isArray(options) ? options : []), [options]);

  const result = useMemo(() => {
    const query = dirtyRef.current ? inputValue : '';
    return suggestDietTypes(query, optionList, {
      limit: query.trim() ? limit : Infinity,
      includeCanonical: isDiet,
      canonicalize: isDiet,
    });
  }, [inputValue, optionList, isDiet, limit]);

  const query = dirtyRef.current ? inputValue.trim() : '';
  const items = useMemo(() => {
    const list = [];
    if (result.didYouMean) list.push({ kind: 'didYouMean', name: result.didYouMean });
    for (const s of result.suggestions) {
      if (s.isNew) list.push({ kind: 'create', name: s.name });
      else if (s.name !== result.didYouMean) list.push({ kind: 'option', name: s.name, reason: s.reason });
    }
    return list;
  }, [result]);

  const autoIndex = query && items[0] && items[0].kind === 'option' && STRONG_REASONS.includes(items[0].reason) ? 0 : -1;
  const effectiveIndex = activeIndex === null ? autoIndex : Math.min(activeIndex, items.length - 1);
  const showDropdown = isOpen && items.length > 0;

  useEffect(() => {
    if (!showDropdown || effectiveIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[effectiveIndex];
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [effectiveIndex, showDropdown]);

  const knownKeys = useMemo(() => {
    const keyOf = isDiet ? dietTypeKey : compactDietText;
    return new Set(optionList.map((o) => keyOf(toText(o))).filter(Boolean));
  }, [optionList, isDiet]);

  const commit = (raw) => {
    const text = toText(raw).replace(/\s+/g, ' ').trim();
    const canonical = isDiet ? canonicalDietType(text) : text;
    const committed = isDiet ? canonical || emptyValue : text;
    dirtyRef.current = false;
    notifiedRef.current = true;
    setInputValue(isDiet ? canonical || '' : text);
    setIsOpen(false);
    setActiveIndex(null);
    if (onChange) onChange(committed);
    if (onCommit) {
      const key = isDiet ? dietTypeKey(committed) : compactDietText(committed);
      onCommit(committed, { isNew: Boolean(key) && !knownKeys.has(key) });
    }
    setBlurTick((t) => t + 1);
  };

  const handleInputChange = (e) => {
    const next = e.target.value;
    dirtyRef.current = true;
    setInputValue(next);
    setIsOpen(true);
    setActiveIndex(null);
    if (onChange) onChange(next);
  };

  const handleFocus = () => {
    focusedRef.current = true;
    notifiedRef.current = false;
    setIsOpen(true);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    setIsOpen(false);
    setActiveIndex(null);
    if (dirtyRef.current) {
      commit(inputValue);
    } else if (!notifiedRef.current) {
      setBlurTick((t) => t + 1);
    }
  };

  const move = (delta) => {
    if (!items.length) return;
    const from = effectiveIndex;
    const next = from < 0 ? (delta > 0 ? 0 : items.length - 1) : (from + delta + items.length) % items.length;
    setActiveIndex(next);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(0);
        } else {
          move(1);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(items.length - 1);
        } else {
          move(-1);
        }
        break;
      case 'Enter':
        if (showDropdown && effectiveIndex >= 0) {
          e.preventDefault();
          commit(items[effectiveIndex].name);
        } else if (dirtyRef.current) {
          e.preventDefault();
          commit(inputValue);
        }
        break;
      case 'Escape':
        if (showDropdown) {
          // Close the list only; don't let a surrounding modal close too.
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          setActiveIndex(null);
        }
        break;
      default:
        break;
    }
  };

  const renderName = (item) =>
    highlightMatch(item.name, item.kind === 'option' && item.reason !== 'fuzzy' && item.reason !== 'alias' ? query : '')
      .map((seg, i) => (seg.match ? <mark key={i} className={styles.match}>{seg.text}</mark> : <span key={i}>{seg.text}</span>));

  return (
    <div className={`${styles.container} ${className}`}>
      {label && <label className={styles.label} id={labelId} htmlFor={inputId}>{label}</label>}
      <div className={styles.inputWrapper}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showDropdown && effectiveIndex >= 0 ? optionId(effectiveIndex) : undefined}
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={styles.input}
        />
        {showDropdown && (
          <ul
            className={styles.dropdown}
            id={listId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : placeholder}
            ref={listRef}
          >
            {items.map((item, index) => {
              const active = index === effectiveIndex;
              const kindClass = item.kind === 'create' ? styles.optionNew : item.kind === 'didYouMean' ? styles.optionHint : '';
              return (
                <li
                  key={`${item.kind}-${item.name}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={active}
                  aria-label={item.kind === 'didYouMean' ? `Did you mean ${item.name}?` : item.kind === 'create' ? `Create "${item.name}"` : item.name}
                  className={`${styles.option} ${kindClass} ${active ? styles.active : ''}`}
                  // Keep focus in the input so blur doesn't commit the typed text first.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(item.name)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {item.kind === 'didYouMean' && <>Did you mean <strong>{item.name}</strong>?</>}
                  {item.kind === 'create' && <>Create &ldquo;<strong>{item.name}</strong>&rdquo;</>}
                  {item.kind === 'option' && renderName(item)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TypeSelector;
