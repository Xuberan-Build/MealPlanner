import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2, Plus, Package, Sparkles, ShoppingCart, X, Check } from 'lucide-react';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { useAuth } from '../../contexts/AuthContext';
import { groupByAisle } from '../../utils/ingredientCategories';
import { parseIngredientLine, formatQuantity, normalizeUnit } from '../../utils/quantity';
import { pantryKey } from '../../utils/pantryMatcher';
import {
  getPantry,
  upsertPantryItem,
  updatePantryItem,
  removePantryItem,
  setStaple,
  seedCommonStaples,
  COMMON_STAPLES
} from '../../services/pantryService';
import styles from './PantryPage.module.css';

/**
 * "2 cups" / "1/2" / "3" / "2 cans of tomatoes" / "2 x 400g tins" / "" -> { quantity, unit }
 * Only a real unit is kept (the first unit word); anything after it ("of tomatoes") and
 * words that are not units are dropped, so the amount can be compared with the list.
 */
export const parseAmountInput = (text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { quantity: null, unit: null };
  const line = parseIngredientLine(trimmed);
  if (line.amount.value === null) return { quantity: null, unit: null };
  const known = line.category !== 'unknown' && line.unit && line.unit !== 'each';
  return { quantity: line.amount.value, unit: known ? line.unit : null };
};

/** Display text for a pantry item's amount. */
export const pantryAmountText = (item) => {
  if (!item) return '';
  if (item.quantity === 0) return 'Ran out';
  if (item.quantity === null || item.quantity === undefined) return item.isStaple ? 'Always have' : 'In stock';
  const nu = normalizeUnit(item.unit || '');
  return formatQuantity({ value: item.quantity, unit: nu.unit, category: nu.category });
};

const amountInputValue = (item) => {
  if (!item || item.quantity === null || item.quantity === undefined || item.quantity === 0) return '';
  return pantryAmountText(item);
};

const PantryPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getPantry());
    } catch (e) {
      setError('Could not load your pantry. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const uid = user ? user.uid : null;
  useEffect(() => {
    if (uid) load();
  }, [uid, load]);

  const missingStaples = useMemo(() => {
    const keys = new Set(items.filter((i) => i.isStaple).map((i) => i.key || pantryKey(i.name)));
    return COMMON_STAPLES.filter((s) => !keys.has(pantryKey(s)));
  }, [items]);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const visible = q ? items.filter((i) => String(i.name || '').toLowerCase().includes(q)) : items;
    return groupByAisle(visible, (i) => i.name);
  }, [items, filter]);

  const stapleCount = items.filter((i) => i.isStaple).length;

  const mergeSaved = (saved) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = prev.slice();
      next[idx] = { ...prev[idx], ...saved };
      return next;
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError('');
    try {
      const { quantity, unit } = parseAmountInput(amount);
      const saved = await upsertPantryItem({ name: trimmed, quantity, unit }, items);
      mergeSaved(saved);
      setName('');
      setAmount('');
    } catch (err) {
      setError('Could not add that item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStaple = async (item) => {
    const next = !item.isStaple;
    mergeSaved({ ...item, isStaple: next });
    try {
      await setStaple(item.id, next);
    } catch (err) {
      mergeSaved(item);
      setError('Could not update that item.');
    }
  };

  const handleRemove = async (item) => {
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    try {
      await removePantryItem(item.id);
    } catch (err) {
      setItems((prev) => [...prev, item]);
      setError('Could not remove that item.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(amountInputValue(item));
  };

  const saveEdit = async (item) => {
    const parsed = parseAmountInput(editValue);
    // An empty box on an item that had run out keeps it run out (it does not become "in stock").
    const keepRanOut = item.quantity === 0 && !String(editValue || '').trim();
    const { quantity, unit } = keepRanOut ? { quantity: 0, unit: null } : parsed;
    setEditingId(null);
    if (keepRanOut) return;
    mergeSaved({ ...item, quantity, unit });
    try {
      const updates = await updatePantryItem(item.id, { quantity, unit });
      mergeSaved({ ...item, quantity: updates.quantity, unit: updates.unit });
    } catch (err) {
      mergeSaved(item);
      setError('Could not update the amount.');
    }
  };

  const markRanOut = async (item) => {
    setEditingId(null);
    mergeSaved({ ...item, quantity: 0, unit: null });
    try {
      await updatePantryItem(item.id, { quantity: 0, unit: null });
    } catch (err) {
      mergeSaved(item);
      setError('Could not update the amount.');
    }
  };

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    setError('');
    try {
      await seedCommonStaples(missingStaples);
      setItems(await getPantry());
    } catch (err) {
      setError('Could not add the common staples. Please try again.');
    } finally {
      setSeeding(false);
    }
  };

  const renderItem = (item) => {
    const editing = editingId === item.id;
    const ranOut = item.quantity === 0;
    return (
      <li key={item.id} className={`${styles.item} ${ranOut ? styles.ranOut : ''}`}>
        <button
          type="button"
          className={`${styles.starButton} ${item.isStaple ? styles.starOn : ''}`}
          onClick={() => handleToggleStaple(item)}
          aria-pressed={!!item.isStaple}
          aria-label={item.isStaple ? `${item.name}: always have (tap to unmark)` : `${item.name}: mark as always have`}
          title={item.isStaple ? 'Staple: always have' : 'Mark as a staple'}
        >
          <Star size={18} fill={item.isStaple ? 'currentColor' : 'none'} />
        </button>

        <div className={styles.itemMain}>
          <span className={styles.itemName}>{item.name}</span>
          {editing ? (
            <form
              className={styles.editForm}
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(item);
              }}
            >
              <input
                autoFocus
                className={styles.editInput}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="e.g. 2 cups (blank = in stock)"
                aria-label={`Amount of ${item.name}`}
                onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
              />
              <button type="submit" className={styles.iconButton} aria-label="Save amount">
                <Check size={16} />
              </button>
              <button type="button" className={styles.iconButton} onClick={() => setEditingId(null)} aria-label="Cancel">
                <X size={16} />
              </button>
            </form>
          ) : (
            <button type="button" className={styles.amountButton} onClick={() => startEdit(item)} title="Edit amount">
              {pantryAmountText(item)}
            </button>
          )}
          {!editing && item.fromPurchase === true && !item.isStaple && item.quantity !== 0 && (
            <span className={styles.boughtHint}>
              Bought for a shopping list, so other lists still ask for it. Tap the amount to confirm leftovers.
            </span>
          )}
        </div>

        {!editing && !ranOut && (
          <button type="button" className={styles.textButton} onClick={() => markRanOut(item)} title="Mark as run out">
            Ran out
          </button>
        )}
        <button
          type="button"
          className={`${styles.iconButton} ${styles.removeButton}`}
          onClick={() => handleRemove(item)}
          aria-label={`Remove ${item.name}`}
          title="Remove"
        >
          <Trash2 size={16} />
        </button>
      </li>
    );
  };

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.headerSpacer} />
      <div className={styles.container}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Pantry</h1>
            <p className={styles.subtitle}>
              What you already have. Your shopping list skips these.
            </p>
          </div>
          <Link to="/shopping-list" className={styles.linkButton}>
            <ShoppingCart size={16} />
            <span>Shopping list</span>
          </Link>
        </div>

        <form className={styles.addCard} onSubmit={handleAdd}>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an item, e.g. rice"
            aria-label="Item name"
          />
          <input
            className={`${styles.input} ${styles.amountInput}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (optional)"
            aria-label="Amount, optional, e.g. 2 cups"
          />
          <button type="submit" className={styles.primaryButton} disabled={!name.trim() || saving}>
            <Plus size={18} />
            <span>{saving ? 'Adding' : 'Add'}</span>
          </button>
        </form>

        {error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button type="button" className={styles.iconButton} onClick={() => setError('')} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Loading your pantry...</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><Package size={36} /></div>
            <h2>Your pantry is empty</h2>
            <p>
              Add the things you already have at home. We'll mark them on your shopping
              list so you only buy what you need.
            </p>
            <button type="button" className={styles.primaryButton} onClick={handleSeed} disabled={seeding}>
              <Sparkles size={18} />
              <span>{seeding ? 'Adding staples' : 'Add common staples'}</span>
            </button>
            <p className={styles.hint}>{COMMON_STAPLES.join(', ')}</p>
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.stats}>
                {items.length} {items.length === 1 ? 'item' : 'items'} · {stapleCount} {stapleCount === 1 ? 'staple' : 'staples'}
              </span>
              {missingStaples.length > 0 && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleSeed}
                  disabled={seeding}
                  title={`Adds: ${missingStaples.join(', ')}`}
                >
                  <Sparkles size={16} />
                  <span>{seeding ? 'Adding' : 'Add common staples'}</span>
                </button>
              )}
            </div>

            {items.length > 8 && (
              <input
                className={`${styles.input} ${styles.search}`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search your pantry"
                aria-label="Search your pantry"
              />
            )}

            <p className={styles.legend}>
              <Star size={14} fill="currentColor" /> Staples are things you always have (salt, oil). Tap an amount to edit it.
            </p>

            {groups.length === 0 && <div className={styles.loading}>No items match "{filter}".</div>}

            {groups.map(({ aisle, items: aisleItems }) => (
              <section key={aisle.id} className={styles.aisle}>
                <h2 className={styles.aisleTitle}>
                  {aisle.name}
                  <span className={styles.aisleCount}>{aisleItems.length}</span>
                </h2>
                <ul className={styles.list}>{aisleItems.map(renderItem)}</ul>
              </section>
            ))}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default PantryPage;
