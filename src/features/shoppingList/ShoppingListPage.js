// ShoppingListPage.js
// -------------------------------------------------
// The shopping list: generated from the meal plan (buildShoppingList), checked against the
// pantry (annotateWithPantry), grouped by grocery aisle in store-walk order, with saved lists,
// templates, quick add, product matching and auto-save.
//
// Data flow:
//   shoppingList (state)  = normalized items, exactly what gets saved (see listModel)
//   pantry (state)        = the user's pantry docs (null until loaded / when signed out)
//   viewItems (memo)      = annotateList(shoppingList, pantry): adds pantryStatus etc.
//   grouped (memo)        = { toBuy: aisles[], have: [], counts }
//   tripView (memo)       = 2-3 shopping trips only: the list split into one section per trip
//                           (trips/tripModel.buildTripView); rows are trip LINES of an item
// Every change goes through updateList(next) -> state + debounced save (or a new list).

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './ShoppingListPage.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import ShoppingListGenerator from '../mealPlanner/components/ShoppingListGenerator';
import ShoppingListRow from './components/ShoppingListRow';
import ProductPreferencesSettings from './components/ProductPreferencesSettings';
import BrowseCategoriesModal from './components/BrowseCategoriesModal';
import EditItemModal from './components/EditItemModal';
import RecipeSelectionModal from './components/RecipeSelectionModal';
import SaveShoppingListModal from './components/SaveShoppingListModal';
import SavedShoppingLists from './components/SavedShoppingLists';
import EmptyState from './components/EmptyState';
import QuickAddBar from './components/QuickAddBar';
import CommonItemsBar from './components/CommonItemsBar';
import TemplateLibrary from './components/TemplateLibrary';
import CreateTemplateModal from './components/CreateTemplateModal';
import TripSettings from './trips/TripSettings';
import { Package, Settings, FileText, ChevronDown, Archive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SHOPPING_CATEGORIES } from './constants/categories';
import {
  getUserShoppingLists,
  createShoppingList,
  updateShoppingList,
  findListForMealPlan,
  linkListToMealPlan,
} from '../../services/ShoppingListService';
import {
  buildItemsFromRecipe,
  mergeShoppingItems,
  replacePlanSources,
} from '../../services/shoppingList/buildShoppingList';
import { getPantry, recordPurchases, undoPurchase, markHave, markNeed } from '../../services/pantryService';
import { matchItemsBatch } from '../../services/productMatchingService';
import { getUserPreferences } from '../../services/userProductPreferencesService';
import { trackItemUsage, getCommonItems } from '../../services/commonItemsService';
import {
  normalizeList,
  annotateList,
  prepareItemsForSave,
  makeManualItem,
  asManualSource,
  applyItemEdit,
  purchaseFromItem,
  groupForDisplay,
} from './listModel';
import {
  buildTrips,
  buildTripView,
  toggleTick,
  reopenItem,
  attachPurchaseRecords,
} from './trips/tripModel';
import { activeTripDays, loadTripSettings, saveTripSettings } from './trips/tripSettingsStore';

const EMPTY_PLAN = Object.freeze({});
const NO_PLAN_KEYS = Object.freeze([]);
const PURCHASE_FLUSH_MS = 2500;
const MOVE_TOAST_MS = 6000;
const HAVE_PULSE_MS = 1600;
const COLLAPSE_STORAGE_KEY = 'shoppingListCollapsedAisles';

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (e) {
    // storage unavailable (private mode): the page works without it
  }
};

let addCounter = 0;
/** Unique id for one "add a recipe" action, so separate adds of a recipe always add up. */
const newAddId = () => {
  addCounter += 1;
  return `add-${Date.now().toString(36)}-${addCounter}`;
};

/** The productMatch stored on an item, from ranked matches (best first). */
const toProductMatch = (matches) => ({
  mode: 'smart',
  selectedProduct: matches[0].product,
  suggestedProducts: matches.slice(1).map((m) => m.product),
  matchScore: matches[0].score,
  matchReason: matches[0].reason,
  lastUpdated: Date.now(),
});

const defaultListName = () => `Shopping List - ${new Date().toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})}`;

/** Key of one pending purchase: the whole item, or one trip line of it. */
const purchaseKey = (itemId, tripKey) => (tripKey ? `${itemId}@${tripKey}` : itemId);

const ShoppingListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = (user && user.uid) || null;
  const mealPlan = useMemo(() => location.state?.mealPlan || EMPTY_PLAN, [location.state]);
  const hasMealPlan = Object.keys(mealPlan).length > 0;
  // Which saved/working plan this list belongs to (see mealPlanModel.shoppingListPlanKeys).
  const planKeys = useMemo(() => location.state?.planKeys || NO_PLAN_KEYS, [location.state]);
  const planName = location.state?.planName || null;

  /* -------------------- state -------------------- */
  const [shoppingList, setShoppingList] = useState([]);
  const [savedLists, setSavedLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [currentListName, setCurrentListName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved', 'unsaved'
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Pantry ("what we have")
  const [pantry, setPantryState] = useState(null);
  const [showHaveSection, setShowHaveSection] = useState(false);
  const [collapsedAisles, setCollapsedAisles] = useState(() => readStorage(COLLAPSE_STORAGE_KEY, {}));
  // "Eggs moved to Already have · Undo"
  const [moveToast, setMoveToast] = useState(null);
  const [pulseHave, setPulseHave] = useState(false);

  // Shopping trips (per user, saved on this device only)
  const [tripSettings, setTripSettings] = useState(() => loadTripSettings(userId));

  // Product matching state
  const [showPreferences, setShowPreferences] = useState(false);
  const [enableSmartMatching, setEnableSmartMatching] = useState(
    () => readStorage('enableSmartMatching', true) !== false // default on
  );
  const [isMatchingProducts, setIsMatchingProducts] = useState(false);

  // Templates & common items
  const [commonItems, setCommonItems] = useState([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [recentIngredients, setRecentIngredients] = useState([]);

  // Rename after auto-save
  const [showRenameToast, setShowRenameToast] = useState(false);
  const [justAutoSaved, setJustAutoSaved] = useState(false);

  // Refs mirror state for async callbacks (timers, network responses).
  const autoSaveTimerRef = useRef(null);
  const isClearingRef = useRef(false);
  const listRef = useRef([]);
  const listIdRef = useRef(null);
  const listNameRef = useRef('');
  const pantryRef = useRef(null);
  const creatingRef = useRef(false);
  const generatingRef = useRef(false);
  const pendingPurchasesRef = useRef(new Map());
  const purchaseTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const moveToastTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);

  /* -------------------- small state helpers -------------------- */
  const setList = useCallback((next) => {
    listRef.current = next;
    setShoppingList(next);
  }, []);

  const setActiveList = useCallback((id, name) => {
    listIdRef.current = id;
    listNameRef.current = name;
    setCurrentListId(id);
    setCurrentListName(name);
  }, []);

  const setPantry = useCallback((next) => {
    pantryRef.current = next;
    setPantryState(next);
  }, []);

  const refreshPantry = useCallback(async () => {
    try {
      const items = await getPantry();
      setPantry(items);
      return items;
    } catch (err) {
      // Signed out or offline: keep whatever pantry status the saved list carries.
      return pantryRef.current;
    }
  }, [setPantry]);

  const upsertPantryDocs = useCallback((docs) => {
    const next = Array.isArray(pantryRef.current) ? pantryRef.current.slice() : [];
    (docs || []).forEach((d) => {
      if (!d || !d.id) return;
      const i = next.findIndex((p) => p.id === d.id);
      if (i >= 0) next[i] = { ...next[i], ...d };
      else next.push(d);
    });
    setPantry(next);
  }, [setPantry]);

  const removePantryDoc = useCallback((id) => {
    if (!Array.isArray(pantryRef.current)) return;
    setPantry(pantryRef.current.filter((p) => p.id !== id));
  }, [setPantry]);

  const showSavedToast = useCallback(() => {
    setJustAutoSaved(true);
    setShowRenameToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowRenameToast(false), 8000);
  }, []);

  /* -------------------- persistence -------------------- */
  const loadSavedLists = useCallback(async () => {
    try {
      setIsLoading(true);
      const lists = await getUserShoppingLists();
      setSavedLists(lists);
      return lists;
    } catch (err) {
      console.error('Load lists failed:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedSave = useCallback((listId, items) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null;
      if (!listId) return;
      try {
        setSaveStatus('saving');
        await updateShoppingList(listId, { items: prepareItemsForSave(items, pantryRef.current, { listId }) });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 1500);
  }, []);

  /** Create a new saved list from items and make it the active list. */
  const saveAsNewList = useCallback(async (
    items,
    { name, type = 'standalone', source = 'Created manually', toast = true, extra = {} } = {}
  ) => {
    const listName = name || listNameRef.current || defaultListName();
    try {
      setSaveStatus('saving');
      const newListId = await createShoppingList({
        ...extra,
        name: listName,
        items: prepareItemsForSave(items, pantryRef.current),
        type,
        source
      });
      setActiveList(newListId, listName);
      setSaveStatus('saved');
      writeStorage('lastActiveShoppingListId', newListId);
      loadSavedLists();
      if (toast) showSavedToast();
      return newListId;
    } catch (err) {
      console.error('Saving new list failed:', err);
      setSaveStatus('unsaved');
      return null;
    }
  }, [loadSavedLists, setActiveList, showSavedToast]);

  /** Save the list: debounced update of the active list, or create one if there is none. */
  const persist = useCallback((items, { source = 'Created manually' } = {}) => {
    const id = listIdRef.current;
    if (id) {
      setSaveStatus('unsaved');
      debouncedSave(id, items);
      return;
    }
    if (!items.length || generatingRef.current) {
      setSaveStatus('unsaved');
      return;
    }
    if (creatingRef.current) return; // a create is in flight; it re-saves the latest items
    creatingRef.current = true;
    saveAsNewList(items, { source }).then((newId) => {
      creatingRef.current = false;
      // Anything that changed while the list was being created gets saved now.
      if (newId && listRef.current !== items) debouncedSave(newId, listRef.current);
    });
  }, [debouncedSave, saveAsNewList]);

  const updateList = useCallback((next, opts) => {
    setList(next);
    persist(next, opts);
  }, [persist, setList]);

  /* -------------------- pantry learning: bought items -------------------- */
  // Ticking an item records the purchase in the pantry (flagged as bought for this list, so
  // it only counts as "have" on this list). The record is kept on the item (pantryAdded) so
  // unticking takes exactly that purchase back out again.
  const undoRecordedPurchase = useCallback(async (record) => {
    if (!record) return;
    try {
      const res = await undoPurchase(record);
      if (res && res.removedId) removePantryDoc(res.removedId);
      else if (res && res.saved) upsertPantryDocs([res.saved]);
    } catch (err) {
      console.warn('Could not take the purchase back out of the pantry:', err);
    }
  }, [removePantryDoc, upsertPantryDocs]);

  const flushPurchases = useCallback(async () => {
    if (purchaseTimerRef.current) {
      clearTimeout(purchaseTimerRef.current);
      purchaseTimerRef.current = null;
    }
    const entries = Array.from(pendingPurchasesRef.current.values());
    pendingPurchasesRef.current.clear();
    if (!entries.length) return;
    try {
      const { saved, records } = await recordPurchases(entries.map(({ purchase }) => (
        { ...purchase, listId: purchase.listId || listIdRef.current || null }
      )));
      upsertPantryDocs(saved);
      const { items, stale, changed } = attachPurchaseRecords(
        listRef.current,
        entries.map(({ itemId, tripKey }, i) => ({ itemId, tripKey, record: records[i] || null }))
      );
      // Unticked while the request was in flight: take those purchases straight back out.
      stale.forEach(undoRecordedPurchase);
      if (changed) updateList(items);
    } catch (err) {
      console.warn('Could not record bought items in the pantry:', err);
    }
  }, [updateList, upsertPantryDocs, undoRecordedPurchase]);

  /** Record `line` (a whole item, or one trip's line of it) as bought, batched. */
  const queuePurchase = useCallback((line, itemId, tripKey = null) => {
    pendingPurchasesRef.current.set(purchaseKey(itemId, tripKey), {
      itemId,
      tripKey,
      purchase: { ...purchaseFromItem(line), listId: listIdRef.current || null },
    });
    if (purchaseTimerRef.current) clearTimeout(purchaseTimerRef.current);
    purchaseTimerRef.current = setTimeout(flushPurchases, PURCHASE_FLUSH_MS);
  }, [flushPurchases]);

  /** Forget queued purchases of an item (all of its lines, or just one). */
  const dropPendingPurchases = useCallback((itemId, tripKey) => {
    pendingPurchasesRef.current.forEach((entry, key) => {
      if (entry.itemId === itemId && (tripKey === undefined || entry.tripKey === tripKey)) {
        pendingPurchasesRef.current.delete(key);
      }
    });
  }, []);

  /* -------------------- effects -------------------- */
  const handleLoadExistingList = useCallback((listId, lists) => {
    const list = (lists || savedLists).find((l) => l.id === listId);
    if (!list) return;
    setList(normalizeList(list.items || []));
    setActiveList(listId, list.name);
    setSaveStatus('saved');
    writeStorage('lastActiveShoppingListId', listId);
  }, [savedLists, setActiveList, setList]);

  // Mount: load saved lists, the pantry, common items and recents.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lists = await loadSavedLists();
      if (cancelled) return;
      if (!hasMealPlan) {
        let lastActiveListId = null;
        try { lastActiveListId = localStorage.getItem('lastActiveShoppingListId'); } catch (e) { /* ignore */ }
        if (lastActiveListId) handleLoadExistingList(lastActiveListId, lists);
      }
    })();
    refreshPantry();
    Promise.resolve(getCommonItems(8))
      .then((items) => { if (!cancelled) setCommonItems(items || []); })
      .catch(() => {});
    const recent = readStorage('recentIngredients', []);
    setRecentIngredients(Array.isArray(recent) ? recent.slice(0, 5) : []);
    return () => { cancelled = true; };
    // Mount only: re-running would reload the last list over the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeStorage('enableSmartMatching', String(enableSmartMatching));
  }, [enableSmartMatching]);

  useEffect(() => {
    writeStorage(COLLAPSE_STORAGE_KEY, collapsedAisles);
  }, [collapsedAisles]);

  // Signed in (or switched account) after mount: use that user's trip settings.
  const tripUserRef = useRef(userId);
  useEffect(() => {
    if (tripUserRef.current === userId) return;
    tripUserRef.current = userId;
    setTripSettings(loadTripSettings(userId));
  }, [userId]);

  const handleTripSettingsChange = useCallback((next) => {
    setTripSettings(next);
    saveTripSettings(userId, next);
  }, [userId]);

  // Unmount: stop timers, but save the latest edits right away and still record anything
  // bought in the last few seconds (the saved items then carry the purchase records, so the
  // purchase is never sent twice and can still be undone).
  useEffect(() => () => {
    const hadPendingSave = !!autoSaveTimerRef.current;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (moveToastTimerRef.current) clearTimeout(moveToastTimerRef.current);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    if (purchaseTimerRef.current) clearTimeout(purchaseTimerRef.current);
    const entries = Array.from(pendingPurchasesRef.current.values());
    pendingPurchasesRef.current.clear();

    const listId = listIdRef.current;
    const items = listRef.current;
    const pantryNow = pantryRef.current;
    const save = (list) => {
      if (!listId) return Promise.resolve();
      return Promise.resolve(updateShoppingList(listId, { items: prepareItemsForSave(list, pantryNow, { listId }) }))
        .catch(() => {});
    };

    if (entries.length) {
      Promise.resolve(recordPurchases(entries.map(({ purchase }) => ({ ...purchase, listId: purchase.listId || listId || null }))))
        .then((res) => {
          const records = (res && res.records) || [];
          const attached = attachPurchaseRecords(
            items,
            entries.map(({ itemId, tripKey }, i) => ({ itemId, tripKey, record: records[i] || null }))
          );
          return save(attached.items);
        })
        .catch(() => (hadPendingSave ? save(items) : undefined));
    } else if (hadPendingSave) {
      save(items);
    }
  }, []);

  /* -------------------- derived view -------------------- */
  const viewItems = useMemo(
    () => annotateList(shoppingList, pantry, { listId: currentListId }),
    [shoppingList, pantry, currentListId]
  );
  const grouped = useMemo(() => groupForDisplay(viewItems), [viewItems]);

  const trips = useMemo(() => buildTrips(activeTripDays(tripSettings)), [tripSettings]);
  const multiTrip = trips.length > 1;
  const tripView = useMemo(
    () => (multiTrip ? buildTripView(shoppingList, pantry, trips, { listId: currentListId }) : null),
    [multiTrip, shoppingList, pantry, trips, currentListId]
  );
  // Extra amounts (manual adds) are bought on the first trip.
  const firstTripKey = multiTrip ? trips[0].key : null;

  /* -------------------- product matching (background) -------------------- */
  // Runs after the list is saved and never blocks it. Only items still to buy, and only
  // ones without a product, are looked up; results merge into whatever the list is by then.
  const matchProductsInBackground = useCallback(async () => {
    const targets = annotateList(listRef.current, pantryRef.current)
      .filter((i) => i.effectiveStatus !== 'have' && !i.productMatch);
    if (!targets.length) return;

    setIsMatchingProducts(true);
    try {
      const userPreferences = await getUserPreferences().catch(() => ({}));
      const matchesById = await matchItemsBatch(
        targets.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, category: i.category })),
        { userPreferences, maxResults: 5, minScore: 0.3 }
      );
      const found = new Map();
      matchesById.forEach((matches, id) => {
        if (matches && matches.length) found.set(id, toProductMatch(matches));
      });
      if (found.size === 0 || isClearingRef.current) return;
      updateList(listRef.current.map((it) => (
        found.has(it.id) && !it.productMatch ? { ...it, productMatch: found.get(it.id) } : it
      )));
    } catch (err) {
      console.warn('Product matching is unavailable right now:', err);
    } finally {
      setIsMatchingProducts(false);
    }
  }, [updateList]);

  /* -------------------- generation from the meal plan -------------------- */
  // Saves straight away: regenerating a plan updates that plan's existing list (keeping
  // ticks, overrides and manual items) instead of creating another list.
  const handleListGenerated = async (generated) => {
    if (isClearingRef.current || generatingRef.current) return;
    const fresh = normalizeList(generated);
    if (!fresh.length) return;

    generatingRef.current = true;
    setList(fresh); // show the list right away
    let savedItems = fresh;
    try {
      const [, existing] = await Promise.all([
        refreshPantry(),
        findListForMealPlan(planKeys).catch((err) => {
          console.warn('Could not look up this plan\'s list; a new one will be created:', err);
          return null;
        }),
      ]);
      if (isClearingRef.current) return;

      if (existing) {
        savedItems = normalizeList(replacePlanSources(normalizeList(existing.items || []), fresh));
        setList(savedItems);
        setActiveList(existing.id, existing.name);
        writeStorage('lastActiveShoppingListId', existing.id);
        setSaveStatus('saving');
        await Promise.all([
          updateShoppingList(existing.id, {
            items: prepareItemsForSave(savedItems, pantryRef.current, { listId: existing.id }),
          }),
          linkListToMealPlan(existing.id, planKeys),
        ]);
        setSaveStatus('saved');
        loadSavedLists();
      } else {
        creatingRef.current = true;
        try {
          await saveAsNewList(fresh, {
            name: planName ? `${planName} - Shopping List` : defaultListName(),
            type: 'mealPlan',
            source: 'Generated from meal plan',
            extra: planKeys.length ? { sourcePlanKeys: planKeys.slice() } : {},
          });
        } finally {
          creatingRef.current = false;
        }
      }
    } catch (err) {
      console.error('Saving the generated list failed:', err);
      setSaveStatus('unsaved');
    } finally {
      generatingRef.current = false;
    }

    // Edits made while saving are saved now; then look up products without blocking.
    if (listIdRef.current && listRef.current !== savedItems) debouncedSave(listIdRef.current, listRef.current);
    if (enableSmartMatching) matchProductsInBackground();
  };

  /* -------------------- list-level handlers -------------------- */
  const handleCreateNewList = async (name = 'New Shopping List') => {
    if (shoppingList.length > 0 && (saveStatus === 'unsaved' || !currentListId)) {
      const shouldSave = window.confirm(
        'You have unsaved changes. Do you want to save the current list before creating a new one?'
      );
      if (shouldSave) {
        if (!currentListId) {
          setShowSaveModal(true);
          return;
        }
        await handleManualSave();
      }
    }

    try {
      setIsLoading(true);
      const id = await createShoppingList({ name, items: [], type: 'standalone', source: 'Created manually' });
      setActiveList(id, name);
      setList([]);
      setSaveStatus('saved');
      loadSavedLists();
    } catch (err) {
      console.error('Create list failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTemplate = (template) => {
    const items = normalizeList(
      (template.items || [])
        .map((it) => makeManualItem(it.name, { quantity: it.quantity, unit: it.unit }))
        .filter(Boolean)
    );
    setShowTemplateLibrary(false);
    setActiveList(null, template.name);
    updateList(items, { source: `From template: ${template.name}` });
  };

  const handleCommonItemClick = (item) => {
    handleQuickAddItem(item.name);
  };

  /* -------------------- quick add -------------------- */
  const handleQuickAddItem = (itemName) => {
    const manual = makeManualItem(itemName);
    if (manual) {
      const current = listRef.current;
      const existing = current.find((it) => it.key === manual.key);
      let next;
      if (!existing) {
        next = [...current, manual];
      } else if (manual.parts.length) {
        // Same ingredient already on the list: add the amount instead of a second line.
        next = normalizeList(mergeShoppingItems(current, [asManualSource(manual)]))
          .map((it) => (it.key === manual.key ? reopenItem(it, firstTripKey) : it));
      } else {
        next = current.map((it) => (it === existing ? reopenItem(it, firstTripKey) : it));
      }
      updateList(next, { source: 'Created manually' });

      trackItemUsage(itemName);
      const recent = readStorage('recentIngredients', []);
      const updated = [itemName, ...(Array.isArray(recent) ? recent : []).filter((r) => r !== itemName)].slice(0, 10);
      writeStorage('recentIngredients', updated);
      setRecentIngredients(updated.slice(0, 5));
    }

    setShowCategoriesModal(false);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  /* -------------------- recipe add -------------------- */
  const handleRecipeAdd = ({ recipe, servings }) => {
    // Every add from the modal is its own source (addId), so adding a recipe again (at any
    // servings) adds to the list instead of being ignored as a duplicate.
    const newItems = buildItemsFromRecipe(recipe, servings, { addId: newAddId() });
    if (!newItems.length) return;
    const next = normalizeList(mergeShoppingItems(listRef.current, newItems));
    const title = recipe?.title || recipe?.name || 'recipe';
    updateList(next, { source: `Added from recipe: ${title}` });
  };

  /* -------------------- per-item handlers -------------------- */
  // viewItem is an item (1 trip) or one trip's line of an item (2-3 trips, has tripKey).
  const handleToggleBought = (viewItem) => {
    const itemId = viewItem.itemId || viewItem.id;
    const tripKey = viewItem.tripKey || null;
    const current = listRef.current.find((it) => it.id === itemId);
    if (!current) return;
    const bought = !viewItem.completed;
    const { item: nextItem, undo, purchases } = toggleTick(current, {
      tripKey,
      bought,
      tripKeys: viewItem.itemTripKeys || [],
    });
    updateList(listRef.current.map((it) => (it.id === itemId ? nextItem : it)));

    if (!tripKey) {
      dropPendingPurchases(itemId); // a whole-item tick replaces any line purchases
    } else if (!bought) {
      dropPendingPurchases(itemId, tripKey);
      dropPendingPurchases(itemId, null); // a queued whole purchase: the other lines re-record
    }
    undo.forEach(undoRecordedPurchase);
    // Each purchase is recorded with that line's own amounts.
    const lines = (tripView && tripView.lines) || [];
    purchases.forEach((key) => {
      if (!key) {
        queuePurchase(viewItem.tripKey ? (viewItems.find((v) => v.id === itemId) || viewItem) : viewItem, itemId, null);
        return;
      }
      const line = key === tripKey ? viewItem : lines.find((l) => l.itemId === itemId && l.tripKey === key);
      if (line) queuePurchase(line, itemId, key);
    });
  };

  /** Close the "moved" toast. */
  const dismissMoveToast = useCallback(() => {
    if (moveToastTimerRef.current) clearTimeout(moveToastTimerRef.current);
    moveToastTimerRef.current = null;
    setMoveToast(null);
  }, []);

  const flashHaveCount = useCallback(() => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    setPulseHave(true);
    pulseTimerRef.current = setTimeout(() => setPulseHave(false), HAVE_PULSE_MS);
  }, []);

  /**
   * Have it / Need it. Returns the pantry change made (so Undo can reverse it):
   *   { kind: 'have' | 'need', doc } where doc is the pantry item markHave/markNeed changed.
   */
  const applyPantryStatus = async (nextStatus, viewItem) => {
    const match = viewItem.pantryMatch && viewItem.pantryMatch.id
      ? ((pantryRef.current || []).find((p) => p.id === viewItem.pantryMatch.id) || viewItem.pantryMatch)
      : null;
    try {
      if (nextStatus === 'have') {
        const saved = await markHave(viewItem, match);
        upsertPantryDocs([saved]);
        return saved && saved !== match ? { kind: 'have', doc: saved } : null;
      }
      if (match) {
        const saved = await markNeed(match);
        if (saved) upsertPantryDocs([saved]);
        return saved && saved !== match ? { kind: 'need', doc: saved } : null;
      }
    } catch (err) {
      console.warn('Could not update the pantry:', err);
    }
    return null;
  };

  const handlePantryChange = (nextStatus, viewItem) => {
    const itemId = viewItem.itemId || viewItem.id;
    const before = listRef.current.find((it) => it.id === itemId);
    if (!before) return;
    const previousOverride = before.pantryOverride === undefined ? null : before.pantryOverride;
    const wasInHave = viewItem.effectiveStatus === 'have' && !viewItem.completed;
    updateList(listRef.current.map((it) => (it.id === itemId ? { ...it, pantryOverride: nextStatus } : it)));
    const pantryChange = applyPantryStatus(nextStatus, viewItem);

    const movesToHave = nextStatus === 'have';
    if (movesToHave === wasInHave) return;
    if (movesToHave) flashHaveCount();
    if (moveToastTimerRef.current) clearTimeout(moveToastTimerRef.current);
    setMoveToast({
      id: `${itemId}-${Date.now()}`,
      itemId,
      name: viewItem.name,
      to: movesToHave ? 'have' : 'need',
      previousOverride,
      pantryChange,
      item: viewItem,
    });
    moveToastTimerRef.current = setTimeout(() => setMoveToast(null), MOVE_TOAST_MS);
  };

  const setOverride = (itemId, override, onlyIf) => {
    const current = listRef.current.find((it) => it.id === itemId);
    if (!current || (onlyIf !== undefined && current.pantryOverride !== onlyIf)) return;
    updateList(listRef.current.map((it) => (it.id === itemId ? { ...it, pantryOverride: override } : it)));
  };

  /**
   * Undo the last move. The row goes back straight away (an explicit need/have choice
   * when it had none), the pantry change is reversed, and once the pantry agrees the item
   * goes back to having no explicit choice, exactly as before.
   */
  const handleUndoMove = async () => {
    const toast = moveToast;
    dismissMoveToast();
    if (!toast) return;
    const undoTo = toast.to === 'have' ? 'need' : 'have';
    setOverride(toast.itemId, toast.previousOverride || undoTo);
    if (toast.to === 'need') flashHaveCount();
    if (toast.previousOverride) return;

    const change = await toast.pantryChange;
    let pantryAgrees = !change;
    if (change && change.doc) {
      try {
        const saved = change.kind === 'have' ? await markNeed(change.doc) : await markHave(toast.item, change.doc);
        if (saved) upsertPantryDocs([saved]);
        pantryAgrees = !!saved && saved !== change.doc;
      } catch (err) {
        console.warn('Could not undo the pantry change:', err);
      }
    }
    if (pantryAgrees) setOverride(toast.itemId, null, undoTo);
  };

  const handleSaveItem = (itemId, data) => {
    updateList(normalizeList(listRef.current.map((it) => (it.id === itemId ? applyItemEdit(it, data) : it))));
  };

  const handleDeleteItem = (itemId) => {
    dropPendingPurchases(itemId);
    updateList(listRef.current.filter((it) => it.id !== itemId));
  };

  const handleProductSelect = (itemId, product) => {
    updateList(listRef.current.map((item) => (item.id === itemId ? {
      ...item,
      productMatch: {
        mode: product ? 'specific' : 'generic',
        selectedProduct: product || null,
        suggestedProducts: item.productMatch?.suggestedProducts || [],
        matchScore: item.productMatch?.matchScore ?? null,
        matchReason: product ? 'Manually selected' : null,
        lastUpdated: Date.now()
      }
    } : item)));
  };

  // A trip line opens the whole item (the edit modal edits the saved item).
  const openEdit = (viewItem) => {
    const itemId = viewItem.itemId || viewItem.id;
    setEditingItem(viewItems.find((v) => v.id === itemId) || viewItem);
    setShowEditModal(true);
  };

  const toggleAisle = (collapseKey) => {
    setCollapsedAisles((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }));
  };

  /* -------------------- save / rename / delete -------------------- */
  const handleManualSave = async () => {
    if (!currentListId) {
      setShowSaveModal(true);
      return;
    }
    try {
      setSaveStatus('saving');
      await updateShoppingList(currentListId, { items: prepareItemsForSave(listRef.current, pantryRef.current, { listId: currentListId }) });
      setSaveStatus('saved');
      loadSavedLists();
    } catch (err) {
      console.error('Manual save failed:', err);
      alert('Failed to save list. Please try again.');
      setSaveStatus('unsaved');
    }
  };

  const handleRenameList = async (newName) => {
    if (!currentListId) return;
    try {
      setSaveStatus('saving');
      await updateShoppingList(currentListId, { name: newName });
      setActiveList(currentListId, newName);
      setSaveStatus('saved');
      loadSavedLists();
    } catch (err) {
      console.error('Rename list failed:', err);
      alert('Failed to rename list. Please try again.');
      setSaveStatus('unsaved');
    }
  };

  const handlePanelRename = (listId) => {
    if (listId !== currentListId) {
      handleLoadExistingList(listId);
      setTimeout(() => setShowRenameModal(true), 100);
    } else {
      setShowRenameModal(true);
    }
  };

  const handlePanelDelete = (listId) => {
    if (listId === currentListId) {
      // Clear the auto-save timer first so it cannot re-create the deleted list's items.
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setActiveList(null, '');
      setList([]);
      setSaveStatus('saved');
    }
    loadSavedLists();
  };

  const handleClearList = () => {
    const message = saveStatus === 'unsaved' || saveStatus === 'saving'
      ? 'This list has unsaved changes. Are you sure you want to clear it? Unsaved items will be lost.'
      : 'Are you sure you want to clear this list and start fresh?';
    if (!window.confirm(message)) return;

    isClearingRef.current = true;
    flushPurchases(); // things already bought are still in the pantry

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setList([]);
    setActiveList(null, '');
    setSaveStatus('saved');

    // Drop the meal plan from history state so the list is not regenerated.
    navigate('/shopping-list', { replace: true, state: {} });
    setTimeout(() => { isClearingRef.current = false; }, 100);
  };

  const handleSaveAsNewList = async (newName) => {
    const hadList = !!currentListId;
    const newId = await saveAsNewList(listRef.current, {
      name: newName,
      source: hadList ? 'Copied from existing list' : 'Created from meal plan',
      toast: false
    });
    if (newId) {
      alert(hadList ? `New list "${newName}" created successfully!` : `List "${newName}" saved successfully!`);
    } else {
      alert('Failed to save list. Please try again.');
    }
  };

  /* -------------------- shared modals -------------------- */
  const sharedModals = (
    <>
      <BrowseCategoriesModal
        isOpen={showCategoriesModal}
        onClose={() => {
          setShowCategoriesModal(false);
          setSelectedCategory(null);
          setSelectedSubcategory(null);
        }}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        onCategorySelect={setSelectedCategory}
        onSubcategorySelect={setSelectedSubcategory}
        onItemAdd={handleQuickAddItem}
        categories={SHOPPING_CATEGORIES}
      />
      <EditItemModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingItem(null); }}
        item={editingItem}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
      <RecipeSelectionModal isOpen={showRecipeModal} onClose={() => setShowRecipeModal(false)} onRecipeAdd={handleRecipeAdd} />
    </>
  );

  const templateModals = (
    <>
      {showTemplateLibrary && (
        <div className={styles['modal-overlay']} onClick={() => setShowTemplateLibrary(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TemplateLibrary
              onLoadTemplate={handleLoadTemplate}
              onClose={() => setShowTemplateLibrary(false)}
              onCreateNew={() => {
                setShowTemplateLibrary(false);
                setShowCreateTemplate(true);
              }}
            />
          </div>
        </div>
      )}
      {showCreateTemplate && (
        <div className={styles['modal-overlay']} onClick={() => setShowCreateTemplate(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CreateTemplateModal
              currentItems={shoppingList}
              onClose={() => setShowCreateTemplate(false)}
              onTemplateSaved={() => {
                getCommonItems(8).then(setCommonItems).catch(() => {});
              }}
            />
          </div>
        </div>
      )}
    </>
  );

  // Reachable in every state (empty, generating, list), not only once a list has items.
  const pantryButton = (
    <button
      type="button"
      className={styles['pantry-link']}
      onClick={() => navigate('/pantry')}
      aria-label="Open your pantry"
      title="What you already have at home"
    >
      <Archive size={14} />
      <span>Pantry</span>
    </button>
  );

  /* -------------------- render: nothing yet -------------------- */
  if (!hasMealPlan && shoppingList.length === 0 && !currentListId) {
    return (
      <div className={styles['shopping-list-page']}>
        <Header />
        <div style={{ height: '80px' }} />
        <div className={styles['empty-pantry-row']}>{pantryButton}</div>
        {isLoading ? (
          <div className={styles['loading-state']}><p>Loading your shopping lists...</p></div>
        ) : (
          <EmptyState
            onCreateNew={handleCreateNewList}
            onLoadTemplate={() => setShowTemplateLibrary(true)}
            onGenerateFromMealPlan={() => navigate('/meal-planner')}
            onAddRecipe={() => setShowRecipeModal(true)}
            onDeleteList={handlePanelDelete}
            onRenameList={handlePanelRename}
            onBrowseCategories={(category, subcategory) => {
              setSelectedCategory(category);
              setSelectedSubcategory(subcategory);
              setShowCategoriesModal(true);
            }}
            onViewSaved={() => {
              alert('Saved lists feature coming soon!');
            }}
            savedLists={savedLists}
            onLoadList={handleLoadExistingList}
            savedListsCount={savedLists.length}
            hasTemplates={false}
          />
        )}
        <BottomNav />
        {sharedModals}
        {templateModals}
      </div>
    );
  }

  /* -------------------- render: the list -------------------- */
  const statusConfig = {
    saving: { text: 'Saving...', color: '#b08a3e', icon: '↻' },
    saved: { text: 'Saved', color: '#5f7f5f', icon: '✓' },
    unsaved: { text: 'Unsaved', color: '#b5534a', icon: '!' }
  };
  const badge = currentListId ? statusConfig[saveStatus] : null;
  const { counts } = tripView || grouped;
  const haveRows = tripView ? tripView.have : grouped.have;
  const progress = counts.toBuy ? Math.round((counts.bought / counts.toBuy) * 100) : 0;

  /** One aisle card (collapsible). collapseKey keeps trips' aisles apart. */
  const renderAisle = ({ aisle, items, remaining }, collapseKey) => {
    const collapsed = !!collapsedAisles[collapseKey];
    const panelId = `aisle-${collapseKey.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    return (
      <div key={collapseKey} className={`${styles['aisle-group']} ${remaining === 0 ? styles['aisle-done'] : ''}`}>
        <button
          type="button"
          className={styles['aisle-header']}
          onClick={() => toggleAisle(collapseKey)}
          aria-expanded={!collapsed}
          aria-controls={panelId}
        >
          <span className={styles['aisle-name']}>{aisle.name}</span>
          <span className={styles['aisle-count']}>
            {remaining === 0 ? 'done' : `${remaining} of ${items.length}`}
          </span>
          <ChevronDown
            size={18}
            className={`${styles['aisle-chevron']} ${collapsed ? styles['chevron-collapsed'] : ''}`}
            aria-hidden="true"
          />
        </button>
        {!collapsed && (
          <ul id={panelId} className={styles['aisle-items']}>
            {items.map((item) => (
              <ShoppingListRow
                key={item.id}
                item={item}
                variant="buy"
                smartMatching={enableSmartMatching}
                onToggleBought={handleToggleBought}
                onPantryChange={handlePantryChange}
                onEdit={openEdit}
                onProductSelect={handleProductSelect}
              />
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className={styles['shopping-list-page']}>
      <Header />
      <div style={{ height: '80px' }} />
      <div className={styles['list-header']}>
        <div className={styles['header-content']}>
          <h1>{currentListName || 'Your Shopping List'}</h1>
          {badge && (
            <span className={styles['save-status-badge']} style={{ color: badge.color }} role="status">
              {badge.icon} {badge.text}
            </span>
          )}
        </div>
        <div className={styles['header-actions']}>
          {pantryButton}
          <button
            className={styles['preferences-button']}
            onClick={() => setShowPreferences(true)}
            title="Product Preferences"
            aria-label="Product preferences"
          >
            <Settings size={20} />
          </button>
          <label className={styles['smart-toggle']}>
            <input
              type="checkbox"
              checked={enableSmartMatching}
              onChange={() => setEnableSmartMatching((v) => !v)}
            />
            <Package size={16} />
            <span>Smart Matching</span>
          </label>
        </div>
      </div>

      {isMatchingProducts && (
        <div className={styles['matching-indicator']} role="status">
          <div className={styles['matching-spinner']}></div>
          <span>Finding best products...</span>
        </div>
      )}

      {showRenameToast && justAutoSaved && (
        <div className={styles['rename-toast']} role="status">
          <div className={styles['toast-content']}>
            <div className={styles['toast-message']}>
              <span className={styles['toast-icon']}>✓</span>
              <span>List saved as "{currentListName}"</span>
            </div>
            <div className={styles['toast-actions']}>
              <button
                className={styles['toast-rename-button']}
                onClick={() => {
                  setShowRenameModal(true);
                  setShowRenameToast(false);
                  setJustAutoSaved(false);
                }}
              >
                Rename
              </button>
              <button
                className={styles['toast-dismiss-button']}
                onClick={() => {
                  setShowRenameToast(false);
                  setJustAutoSaved(false);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {shoppingList.length === 0 && hasMealPlan && !currentListId ? (
        <ShoppingListGenerator mealPlan={mealPlan} onListGenerated={handleListGenerated} />
      ) : shoppingList.length === 0 && !currentListId ? (
        <EmptyState
          onCreateNew={handleCreateNewList}
          onLoadTemplate={() => setShowTemplateLibrary(true)}
          onGenerateFromMealPlan={() => navigate('/meal-planner')}
          onViewSaved={() => {
            alert('Saved lists feature coming soon!');
          }}
          savedLists={savedLists}
          onLoadList={handleLoadExistingList}
          savedListsCount={savedLists.length}
          hasTemplates={false}
        />
      ) : (
        <>
          <QuickAddBar onItemAdd={handleQuickAddItem} recentItems={recentIngredients} />
          <CommonItemsBar items={commonItems} onItemClick={handleCommonItemClick} />

          <div className={styles['shopping-list-container']}>
            <TripSettings settings={tripSettings} onChange={handleTripSettingsChange} />

            {/* Summary */}
            <section className={styles['list-summary']} aria-label="List summary">
              <div className={styles['summary-top']}>
                <p className={styles['summary-text']}>
                  <strong>{counts.remaining}</strong> {counts.remaining === 1 ? 'item' : 'items'} to buy
                  <span className={styles['summary-dot']} aria-hidden="true">·</span>
                  <strong>{counts.have}</strong> already in pantry
                </p>
              </div>
              {counts.toBuy > 0 && (
                <>
                  <div
                    className={styles['progress-track']}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={counts.toBuy}
                    aria-valuenow={counts.bought}
                    aria-label="Items bought"
                  >
                    <div className={styles['progress-fill']} style={{ width: `${progress}%` }} />
                  </div>
                  <p className={styles['progress-text']}>
                    {counts.bought === counts.toBuy
                      ? 'All done. Everything is bought.'
                      : `${counts.bought} of ${counts.toBuy} bought`}
                  </p>
                </>
              )}
            </section>

            {/* To buy, by aisle (one section per trip with 2-3 trips) */}
            {tripView ? tripView.trips.map(({ trip, label, cover, toBuy, counts: tripCounts }) => {
              const headingId = `trip-heading-${trip.number}`;
              return (
                <section
                  key={trip.key}
                  className={`${styles['list-section']} ${styles['trip-section']}`}
                  aria-labelledby={headingId}
                >
                  <div className={styles['trip-header']}>
                    <h2 id={headingId} className={styles['trip-title']}>
                      {label}
                      {cover && <span className={styles['trip-cover']}> — {cover}</span>}
                    </h2>
                    {tripCounts.toBuy > 0 && (
                      <span className={styles['trip-count']}>
                        {tripCounts.bought === tripCounts.toBuy
                          ? 'all bought'
                          : `${tripCounts.bought} of ${tripCounts.toBuy} bought`}
                      </span>
                    )}
                  </div>
                  {trip.index === 0 && (
                    <p className={styles['trip-subtitle']}>Plus everything that keeps all week.</p>
                  )}
                  {toBuy.length === 0 && (
                    <p className={styles['section-empty']}>Nothing to buy on this trip.</p>
                  )}
                  {toBuy.map((group) => renderAisle(group, `${trip.key}:${group.aisle.id}`))}
                </section>
              );
            }) : (
              <section className={styles['list-section']} aria-labelledby="to-buy-heading">
                <h2 id="to-buy-heading" className={styles['section-title']}>To buy</h2>
                {grouped.toBuy.length === 0 && (
                  <p className={styles['section-empty']}>
                    {counts.have > 0
                      ? 'Nothing left to buy. Everything is in your pantry.'
                      : 'Your list is empty. Add items above or add a recipe.'}
                  </p>
                )}
                {grouped.toBuy.map((group) => renderAisle(group, group.aisle.id))}
              </section>
            )}

            {/* Already have */}
            {haveRows.length > 0 && (
              <section className={`${styles['list-section']} ${styles['have-section']}`} aria-labelledby="have-heading">
                <h2 id="have-heading" className={styles['section-title-wrap']}>
                  <button
                    type="button"
                    className={styles['aisle-header']}
                    onClick={() => setShowHaveSection((v) => !v)}
                    aria-expanded={showHaveSection}
                    aria-controls="have-items"
                  >
                    <span className={styles['aisle-name']}>Already have</span>
                    <span className={`${styles['aisle-count']} ${pulseHave ? styles['count-pulse'] : ''}`}>
                      {haveRows.length}
                      {haveRows.some((i) => i.needsCheck) ? ' · check amounts' : ''}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`${styles['aisle-chevron']} ${showHaveSection ? '' : styles['chevron-collapsed']}`}
                      aria-hidden="true"
                    />
                  </button>
                </h2>
                {showHaveSection && (
                  <ul id="have-items" className={styles['aisle-items']}>
                    {haveRows.map((item) => (
                      <ShoppingListRow
                        key={item.id}
                        item={item}
                        variant="have"
                        onPantryChange={handlePantryChange}
                        onEdit={openEdit}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </>
      )}

      {/* Always mounted, so screen readers announce what moved. */}
      <div className={styles['move-toast-region']} role="status" aria-live="polite">
        {moveToast && (
          <div key={moveToast.id} className={styles['move-toast']}>
            <span className={styles['move-toast-text']}>
              {moveToast.to === 'have'
                ? `${moveToast.name} moved to Already have`
                : `${moveToast.name} moved back to your list`}
            </span>
            <button type="button" className={styles['move-toast-undo']} onClick={handleUndoMove}>
              Undo
            </button>
            <button
              type="button"
              className={styles['move-toast-close']}
              onClick={dismissMoveToast}
              aria-label="Dismiss"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
      </div>

      {(shoppingList.length > 0 || currentListId) && (
        <div className={styles['bottom-action-bar']}>
          <button
            className={styles['icon-button']}
            onClick={() => setShowCategoriesModal(true)}
            title="Browse Categories"
            aria-label="Browse categories"
          >
            <Package size={20} />
          </button>
          <button
            className={styles['icon-button']}
            onClick={() => setShowRecipeModal(true)}
            title="Add Recipe"
            aria-label="Add a recipe"
          >
            <FileText size={20} />
          </button>
          <button className={styles['clear-list-button']} onClick={handleClearList} title="Clear List">
            Clear List
          </button>
        </div>
      )}

      <BottomNav />

      <SavedShoppingLists
        savedLists={savedLists}
        onLoadList={handleLoadExistingList}
        onDeleteList={handlePanelDelete}
        onRenameList={handlePanelRename}
        currentListId={currentListId}
      />

      {sharedModals}

      <SaveShoppingListModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveAsNewList}
        existingName=""
        isRenaming={false}
      />
      <SaveShoppingListModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onSave={handleRenameList}
        existingName={currentListName}
        isRenaming={true}
      />

      {showPreferences && <ProductPreferencesSettings onClose={() => setShowPreferences(false)} />}

      {templateModals}
    </div>
  );
};

export default ShoppingListPage;
