// src/features/admin/IngredientDictionaryPage.js
//
// Admin page for the shared ingredient dictionary: which names are the same product for
// every user. Add or change aliases, switch them on/off, and review user suggestions.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import {
  BUILT_IN_ALIASES,
  aliasKey,
  getActiveAliases,
  resolveWith,
  validateAlias,
} from '../../utils/ingredientAliases';
import { displayIngredientName } from '../../utils/quantity';
import {
  isCurrentUserAdmin,
  listPendingSuggestions,
  loadIngredientDictionary,
  resolveSuggestion,
  saveAlias,
  setAliasEnabled,
} from '../../services/ingredientDictionaryService';
import { buildDictionaryRows, filterRows } from './dictionaryRows';
import styles from './IngredientDictionaryPage.module.css';

const label = (key) => displayIngredientName(key) || key;

function AddAliasForm({ onSaved }) {
  const [alias, setAlias] = useState('');
  const [canonical, setCanonical] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const problems = alias || canonical ? validateAlias(getActiveAliases(), alias, canonical) : [];
  const from = aliasKey(alias);
  const to = aliasKey(canonical);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await saveAlias({ alias, canonical, note });
      setAlias('');
      setCanonical('');
      setNote('');
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={submit} aria-labelledby="add-alias-title">
      <h2 id="add-alias-title" className={styles.cardTitle}>Add a same-product name</h2>
      <div className={styles.formRow}>
        <label>
          <span>Name people use</span>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="old fashioned oats" />
        </label>
        <label>
          <span>Same product as</span>
          <input value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="rolled oats" />
        </label>
      </div>
      <label className={styles.noteField}>
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </label>
      {from && to && problems.length === 0 && (
        <p className={styles.preview} aria-live="polite">
          Every user&apos;s lists will show “{alias.trim()}” as <strong>{label(resolveWith({ ...getActiveAliases(), [from]: to }, from))}</strong>.
        </p>
      )}
      {problems.length > 0 && <p className={styles.problem} role="alert">{problems.join(' ')}</p>}
      {error && <p className={styles.problem} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={saving || !from || !to || problems.length > 0}>
        {saving ? 'Saving…' : 'Save for everyone'}
      </button>
    </form>
  );
}

const IngredientDictionaryPage = () => {
  const [status, setStatus] = useState('checking'); // checking | denied | ready
  const [entries, setEntries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [loaded, pending] = await Promise.all([
      loadIngredientDictionary(),
      listPendingSuggestions().catch(() => []),
    ]);
    if (loaded) setEntries(loaded);
    setSuggestions(pending);
  }, []);

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin().then(async (admin) => {
      if (cancelled) return;
      if (!admin) {
        setStatus('denied');
        return;
      }
      await refresh();
      if (!cancelled) setStatus('ready');
    });
    return () => { cancelled = true; };
  }, [refresh]);

  const rows = useMemo(() => filterRows(buildDictionaryRows(BUILT_IN_ALIASES, entries), search), [entries, search]);

  const run = async (action, done) => {
    setMessage('');
    try {
      await action();
      await refresh();
      setMessage(done);
    } catch (err) {
      setMessage(err.message || 'Something went wrong.');
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.content}>
        <h1 className={styles.title}>Ingredient dictionary</h1>
        <p className={styles.subtitle}>
          Names that are the same product for every user&apos;s shopping list and pantry.
        </p>

        {status === 'checking' && <p>Loading…</p>}
        {status === 'denied' && (
          <p className={styles.card} role="alert">
            This page is for admins. Ask an admin to add your account to the <code>admins</code> list.
          </p>
        )}

        {status === 'ready' && (
          <>
            {message && <p className={styles.message} role="status">{message}</p>}

            <AddAliasForm onSaved={() => { refresh(); setMessage('Saved for everyone.'); }} />

            <section className={styles.card} aria-labelledby="suggestions-title">
              <h2 id="suggestions-title" className={styles.cardTitle}>
                Suggestions from users {suggestions.length > 0 && <span className={styles.count}>{suggestions.length}</span>}
              </h2>
              {suggestions.length === 0 ? (
                <p className={styles.muted}>No suggestions waiting.</p>
              ) : (
                <ul className={styles.list}>
                  {suggestions.map((s) => (
                    <li key={s.id} className={styles.row}>
                      <span>“{label(s.alias)}” → <strong>{label(s.canonical)}</strong>{s.context && <em className={styles.muted}> · {s.context}</em>}</span>
                      <span className={styles.actions}>
                        <button type="button" className={styles.primarySmall} onClick={() => run(() => resolveSuggestion(s, true), 'Approved and saved for everyone.')}>Approve</button>
                        <button type="button" className={styles.secondarySmall} onClick={() => run(() => resolveSuggestion(s, false), 'Suggestion rejected.')}>Reject</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.card} aria-labelledby="aliases-title">
              <div className={styles.listHeader}>
                <h2 id="aliases-title" className={styles.cardTitle}>All same-product names ({rows.length})</h2>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  aria-label="Search names"
                  className={styles.search}
                />
              </div>
              <ul className={styles.list}>
                {rows.map((row) => (
                  <li key={row.alias} className={`${styles.row} ${row.enabled ? '' : styles.off}`}>
                    <span>
                      “{label(row.alias)}” → <strong>{label(row.canonical)}</strong>
                      <span className={styles.badge}>{row.source === 'built-in' ? 'Built-in' : 'Shared'}</span>
                      {!row.enabled && <span className={styles.badgeOff}>Off</span>}
                      {row.note && <em className={styles.muted}> · {row.note}</em>}
                    </span>
                    <button
                      type="button"
                      className={styles.secondarySmall}
                      onClick={() => run(
                        () => setAliasEnabled(row.alias, !row.enabled, row.canonical),
                        row.enabled ? `"${label(row.alias)}" switched off for everyone.` : `"${label(row.alias)}" switched on for everyone.`
                      )}
                      aria-label={`${row.enabled ? 'Switch off' : 'Switch on'} ${label(row.alias)}`}
                    >
                      {row.enabled ? 'Switch off' : 'Switch on'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default IngredientDictionaryPage;
