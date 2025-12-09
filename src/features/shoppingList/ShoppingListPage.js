// ShoppingListPage.js – COMPLETE & FUNCTIONAL WITH PRODUCT MATCHING
// -------------------------------------------------
// Provides shopping‑list CRUD, quick‑add, recipe import, modal handling, and smart product matching.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './ShoppingListPage.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import ShoppingListGenerator from '../mealPlanner/components/ShoppingListGenerator';
import ShoppingItem from './components/ShoppingItem';
import SmartShoppingListItem from './components/SmartShoppingListItem';
import ProductPreferencesSettings from './components/ProductPreferencesSettings';
import BrowseCategoriesModal from './components/BrowseCategoriesModal';
import EditItemModal from './components/EditItemModal';
import RecipeSelectionModal from './components/RecipeSelectionModal';
import ShoppingListAutocomplete from './components/ShoppingListAutocomplete';
import SaveShoppingListModal from './components/SaveShoppingListModal';
import SavedShoppingLists from './components/SavedShoppingLists';
import EmptyState from './components/EmptyState';
import QuickAddBar from './components/QuickAddBar';
import CommonItemsBar from './components/CommonItemsBar';
import TemplateLibrary from './components/TemplateLibrary';
import CreateTemplateModal from './components/CreateTemplateModal';
import { Trash2, Package, Settings, FileText } from 'lucide-react';
import { SHOPPING_CATEGORIES } from './constants/categories';
import {
  getUserShoppingLists,
  createShoppingList,
  updateShoppingList,
  addItemToList,
  removeItemFromList,
  updateItemInList,
  createListFromMealPlan,
  deleteShoppingList,
} from '../../services/ShoppingListService';
import { matchIngredientToProducts } from '../../services/productMatchingService';
import { getUserPreferences } from '../../services/userProductPreferencesService';
import { trackItemUsage, getCommonItems } from '../../services/commonItemsService';
import { loadTemplate as loadTemplateService } from '../../services/shoppingListTemplateService';

const ShoppingListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mealPlan = location.state?.mealPlan || {};

  /* -------------------- state -------------------- */
  const [shoppingList, setShoppingList] = useState([]);
  const [savedLists, setSavedLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [currentListName, setCurrentListName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved', 'unsaved'
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Product matching state
  const [showPreferences, setShowPreferences] = useState(false);
  const [enableSmartMatching, setEnableSmartMatching] = useState(
    localStorage.getItem('enableSmartMatching') !== 'false' // Default to true
  );
  const [isMatchingProducts, setIsMatchingProducts] = useState(false);

  // Phase 1: Template & common items state
  const [commonItems, setCommonItems] = useState([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [recentIngredients, setRecentIngredients] = useState([]);

  // Rename after auto-save state
  const [showRenameToast, setShowRenameToast] = useState(false);
  const [justAutoSaved, setJustAutoSaved] = useState(false);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef(null);
  // Track when user is clearing the list to prevent auto-regeneration
  const isClearingRef = useRef(false);

  /* -------------------- effects -------------------- */
  useEffect(() => {
    const initializePage = async () => {
      await loadSavedLists();

      // Auto-load last active list if no meal plan is being passed in
      if (Object.keys(mealPlan).length === 0) {
        const lastActiveListId = localStorage.getItem('lastActiveShoppingListId');
        if (lastActiveListId) {
          // Small delay to ensure saved lists are loaded
          setTimeout(() => {
            handleLoadExistingList(lastActiveListId);
          }, 100);
        }
      }
    };

    initializePage();
  }, []);

  useEffect(() => {
    if (Object.keys(mealPlan).length > 0 && shoppingList.length === 0) {
      setIsLoading(true);
    }
  }, [mealPlan, shoppingList.length]);

  // Save smart matching preference to localStorage
  useEffect(() => {
    localStorage.setItem('enableSmartMatching', enableSmartMatching.toString());
  }, [enableSmartMatching]);

  // Phase 1: Load user's common items on mount
  useEffect(() => {
    const fetchCommonItems = async () => {
      const items = await getCommonItems(8); // Get top 8 items
      setCommonItems(items);
    };

    fetchCommonItems();
  }, []);

  // Phase 1: Load recent ingredients from localStorage
  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('recentIngredients') || '[]');
    setRecentIngredients(recent.slice(0, 5));
  }, []);

  /* -------------------- Helper Functions -------------------- */
  // Remove undefined values from objects to prevent Firestore errors
  const sanitizeForFirestore = (obj) => {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForFirestore(item)).filter(item => item !== undefined);
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
          const sanitizedValue = sanitizeForFirestore(value);
          if (sanitizedValue !== undefined) {
            sanitized[key] = sanitizedValue;
          }
        }
      });
      return sanitized;
    }

    return obj;
  };

  /* -------------------- Auto-save helper -------------------- */
  const debouncedSave = useCallback(async (listId, items) => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!listId) return;

      try {
        setSaveStatus('saving');
        // Sanitize items before saving to prevent undefined value errors
        const sanitizedItems = sanitizeForFirestore(items);
        await updateShoppingList(listId, { items: sanitizedItems });
        setSaveStatus('saved');
        console.log('Auto-saved shopping list:', listId);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 1500); // Auto-save after 1.5 seconds of no changes
  }, []);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  /* -------------------- DB helpers -------------------- */
  const loadSavedLists = async () => {
    try {
      setIsLoading(true);
      const lists = await getUserShoppingLists();
      setSavedLists(lists);
    } catch (err) {
      console.error('Load lists failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleListGenerated = async (generated) => {
    // Don't generate list if user just cleared it
    if (isClearingRef.current) {
      console.log('List generation skipped - user cleared the list');
      return;
    }

    // Generate a default name with date
    const defaultName = `Shopping List - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}`;

    // If smart matching is disabled, use original logic but auto-save
    if (!enableSmartMatching) {
      setShoppingList(generated);

      // Auto-save the generated list
      try {
        setSaveStatus('saving');
        const sanitizedItems = sanitizeForFirestore(generated);
        const newListId = await createShoppingList({
          name: defaultName,
          items: sanitizedItems,
          type: 'mealPlan',
          source: 'Generated from meal plan'
        });
        setCurrentListId(newListId);
        setCurrentListName(defaultName);
        setSaveStatus('saved');

        // Store as last active list
        localStorage.setItem('lastActiveShoppingListId', newListId);

        // Reload saved lists to show the new one
        loadSavedLists();
        console.log('Shopping list auto-saved:', newListId);

        // Show rename toast
        setJustAutoSaved(true);
        setShowRenameToast(true);
        setTimeout(() => setShowRenameToast(false), 8000); // Hide after 8 seconds
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('unsaved');
        setCurrentListId(null);
        setCurrentListName('');
      }
      return;
    }

    // Enhanced list generation with product matching
    try {
      setIsMatchingProducts(true);
      setShoppingList(generated); // Show list immediately

      // Get user preferences
      const userPrefs = await getUserPreferences().catch(() => ({}));

      // Match products for each ingredient in batches
      const BATCH_SIZE = 5;
      const enhancedItems = [...generated];

      for (let i = 0; i < generated.length; i += BATCH_SIZE) {
        const batch = generated.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (item, batchIndex) => {
            const itemIndex = i + batchIndex;

            try {
              const matches = await matchIngredientToProducts(
                {
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  category: item.category
                },
                {
                  userPreferences: userPrefs,
                  maxResults: 5,
                  minScore: 0.3,
                  useCache: true
                }
              );

              if (matches.length > 0) {
                enhancedItems[itemIndex] = {
                  ...item,
                  productMatch: {
                    mode: 'smart',
                    selectedProduct: matches[0].product,
                    suggestedProducts: matches.slice(1).map(m => m.product),
                    matchScore: matches[0].score,
                    matchReason: matches[0].reason,
                    lastUpdated: Date.now()
                  }
                };
              }
            } catch (err) {
              console.error(`Failed to match ${item.name}:`, err);
              // Keep original item without product match
            }
          })
        );

        // Update UI with partial results after each batch
        setShoppingList([...enhancedItems]);
      }

      // Auto-save the enhanced list
      try {
        setSaveStatus('saving');
        const sanitizedItems = sanitizeForFirestore(enhancedItems);
        const newListId = await createShoppingList({
          name: defaultName,
          items: sanitizedItems,
          type: 'mealPlan',
          source: 'Generated from meal plan with smart matching'
        });
        setCurrentListId(newListId);
        setCurrentListName(defaultName);
        setSaveStatus('saved');

        // Store as last active list
        localStorage.setItem('lastActiveShoppingListId', newListId);

        // Reload saved lists to show the new one
        loadSavedLists();
        console.log('Shopping list auto-saved with product matching:', newListId);

        // Show rename toast
        setJustAutoSaved(true);
        setShowRenameToast(true);
        setTimeout(() => setShowRenameToast(false), 8000); // Hide after 8 seconds
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('unsaved');
      }
    } catch (err) {
      console.error('Error in smart list generation:', err);
      // Fallback to original list and try to save
      setShoppingList(generated);
      try {
        setSaveStatus('saving');
        const sanitizedItems = sanitizeForFirestore(generated);
        const newListId = await createShoppingList({
          name: defaultName,
          items: sanitizedItems,
          type: 'mealPlan',
          source: 'Generated from meal plan'
        });
        setCurrentListId(newListId);
        setCurrentListName(defaultName);
        setSaveStatus('saved');
        localStorage.setItem('lastActiveShoppingListId', newListId);
        loadSavedLists();

        // Show rename toast
        setJustAutoSaved(true);
        setShowRenameToast(true);
        setTimeout(() => setShowRenameToast(false), 8000); // Hide after 8 seconds
      } catch (saveErr) {
        console.error('Fallback auto-save failed:', saveErr);
        setSaveStatus('unsaved');
        setCurrentListId(null);
        setCurrentListName('');
      }
    } finally {
      setIsMatchingProducts(false);
    }
  };

  const handleCreateNewList = async (name = 'New Shopping List') => {
    // If there's an unsaved list with items, ask if they want to save first
    if (shoppingList.length > 0 && (saveStatus === 'unsaved' || !currentListId)) {
      const shouldSave = window.confirm(
        'You have unsaved changes. Do you want to save the current list before creating a new one?'
      );

      if (shouldSave) {
        if (!currentListId) {
          // No list ID, need to create one first
          setShowSaveModal(true);
          return;
        } else {
          // Save current list
          await handleManualSave();
        }
      }
    }

    try {
      setIsLoading(true);
      const id = await createShoppingList({ name, items: [], type: 'standalone', source: 'Created manually' });
      setCurrentListId(id);
      setCurrentListName(name);
      setShoppingList([]);
      setSaveStatus('saved');
      loadSavedLists();
    } catch (err) {
      console.error('Create list failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadExistingList = async (listId) => {
    try {
      setIsLoading(true);
      const list = savedLists.find((l) => l.id === listId);
      if (list) {
        setShoppingList(list.items || []);
        setCurrentListId(listId);
        setCurrentListName(list.name);
        setSaveStatus('saved');

        // Store as last active list
        localStorage.setItem('lastActiveShoppingListId', listId);
        console.log('Loaded shopping list:', listId);
      }
    } catch (err) {
      console.error('Load list failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /* -------------------- Phase 1: Template handlers -------------------- */
  const handleLoadTemplate = async (template) => {
    // Convert template items to shopping list format
    const templateItems = template.items.map((item, index) => ({
      id: `temp-${Date.now()}-${index}`,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'items',
      category: item.category || 'Other',
      completed: false,
      alreadyHave: false,
      notes: '',
      estimatedCost: 0,
    }));

    setShoppingList(templateItems);
    setShowTemplateLibrary(false);
    setSaveStatus('unsaved');
    setCurrentListId(null);
    setCurrentListName(template.name);
  };

  const handleCommonItemClick = (item) => {
    handleQuickAddItem(item.name);
  };

  /* -------------------- quick‑add helpers -------------------- */
  const handleQuickAddItem = async (itemName, category = 'Other') => {
    const item = {
      name: itemName,
      quantity: 1,
      unit: 'items',
      category,
      estimatedCost: 0,
      completed: false,
      alreadyHave: false,
      notes: '',
    };

    if (currentListId) {
      try {
        await addItemToList(currentListId, item);
      } catch (err) {
        console.error('DB add failed:', err);
      }
    }

    setShoppingList((prev) => [...prev, { ...item, id: `temp-${Date.now()}` }]);

    // Phase 1: Track item usage for common items
    trackItemUsage(itemName);

    // Phase 1: Update recent ingredients in localStorage
    const recent = JSON.parse(localStorage.getItem('recentIngredients') || '[]');
    const updated = [itemName, ...recent.filter(r => r !== itemName)].slice(0, 10);
    localStorage.setItem('recentIngredients', JSON.stringify(updated));
    setRecentIngredients(updated.slice(0, 5));

    // reset modal state
    setShowQuickAdd(false);
    setShowCategoriesModal(false);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  /* -------------------- per‑item handlers -------------------- */
  const handleQuantityChange = async (id, qty) => {
    const newList = shoppingList.map((it) => (it.id === id ? { ...it, quantity: parseInt(qty) || 0 } : it));
    setShoppingList(newList);

    // Auto-save changes
    if (currentListId) {
      debouncedSave(currentListId, newList);
      setSaveStatus('unsaved');
    }
  };

  const handleNoteChange = async (id, note) => {
    const newList = shoppingList.map((it) => (it.id === id ? { ...it, notes: note } : it));
    setShoppingList(newList);

    // Auto-save changes
    if (currentListId) {
      debouncedSave(currentListId, newList);
      setSaveStatus('unsaved');
    }
  };

  const handleAlreadyHaveToggle = async (id) => {
    const newList = shoppingList.map((it) => (it.id === id ? { ...it, alreadyHave: !it.alreadyHave } : it));
    setShoppingList(newList);

    // Auto-save changes
    if (currentListId) {
      debouncedSave(currentListId, newList);
      setSaveStatus('unsaved');
    }
  };

  /* -------------------- edit‑item modal handlers -------------------- */
  const handleSaveItem = async (itemId, data) => {
    const newList = shoppingList.map((it) => (it.id === itemId ? { ...it, ...data } : it));
    setShoppingList(newList);

    if (currentListId) {
      try {
        setSaveStatus('saving');
        await updateItemInList(currentListId, itemId, data);
        setSaveStatus('saved');
        console.log('Item updated in DB:', itemId);
      } catch (err) {
        console.error('Update item failed:', err);
        setSaveStatus('unsaved');
      }
    }
  };

  const handleDeleteItem = async (itemId) => {
    const newList = shoppingList.filter((it) => it.id !== itemId);
    setShoppingList(newList);

    if (currentListId) {
      try {
        setSaveStatus('saving');
        await removeItemFromList(currentListId, itemId);
        setSaveStatus('saved');
        console.log('Item deleted from DB:', itemId);
      } catch (err) {
        console.error('Delete item failed:', err);
        setSaveStatus('unsaved');
      }
    }
  };

  /* -------------------- product matching handlers -------------------- */
  const handleProductSelect = async (itemId, product) => {
    const newList = shoppingList.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          productMatch: {
            mode: product ? 'specific' : 'generic',
            selectedProduct: product,
            suggestedProducts: item.productMatch?.suggestedProducts || [],
            matchScore: item.productMatch?.matchScore,
            matchReason: product ? 'Manually selected' : null,
            lastUpdated: Date.now()
          }
        };
      }
      return item;
    });

    setShoppingList(newList);

    // Auto-save changes
    if (currentListId) {
      debouncedSave(currentListId, newList);
      setSaveStatus('unsaved');
    }
  };

  const toggleSmartMatching = () => {
    setEnableSmartMatching(!enableSmartMatching);
  };

  /* -------------------- save/rename handlers -------------------- */
  const handleManualSave = async () => {
    if (!currentListId) {
      // No list exists, create a new one
      setShowSaveModal(true);
      return;
    }

    try {
      setSaveStatus('saving');
      const sanitizedItems = sanitizeForFirestore(shoppingList);
      await updateShoppingList(currentListId, { items: sanitizedItems });
      setSaveStatus('saved');
      loadSavedLists();
      console.log('Manual save completed:', currentListId);
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
      setCurrentListName(newName);
      setSaveStatus('saved');
      loadSavedLists();
      console.log('List renamed to:', newName);
    } catch (err) {
      console.error('Rename list failed:', err);
      alert('Failed to rename list. Please try again.');
      setSaveStatus('unsaved');
    }
  };

  // Handler for rename from SavedShoppingLists panel
  const handlePanelRename = (listId, currentName) => {
    // If renaming a different list, load it first
    if (listId !== currentListId) {
      handleLoadExistingList(listId);
      // Give it a moment to load, then show rename modal
      setTimeout(() => {
        setShowRenameModal(true);
      }, 100);
    } else {
      // Renaming current list
      setShowRenameModal(true);
    }
  };

  // Handler for delete from SavedShoppingLists panel
  const handlePanelDelete = (listId) => {
    // If deleting the current list, clear auto-save timer and state
    if (listId === currentListId) {
      // CRITICAL: Clear auto-save timer first to prevent race condition
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Now clear the state
      setCurrentListId(null);
      setCurrentListName('');
      setShoppingList([]);
      setSaveStatus('saved');
    }
    // Refresh the saved lists
    loadSavedLists();
  };

  // Handler for delete from empty state
  const handleDeleteFromEmptyState = async (listId, listName) => {
    if (!window.confirm(`Are you sure you want to delete "${listName}"?`)) {
      return;
    }

    try {
      await deleteShoppingList(listId);
      loadSavedLists();
      console.log('List deleted successfully:', listId);
    } catch (error) {
      console.error('Error deleting list:', error);
      alert('Failed to delete list. Please try again.');
    }
  };

  const handleClearList = () => {
    // Check if list has unsaved changes
    if (saveStatus === 'unsaved' || saveStatus === 'saving') {
      const confirmClear = window.confirm(
        'This list has unsaved changes. Are you sure you want to clear it? Unsaved items will be lost.'
      );
      if (!confirmClear) return;
    } else {
      const confirmClear = window.confirm(
        'Are you sure you want to clear this list and start fresh?'
      );
      if (!confirmClear) return;
    }

    // Set flag to prevent auto-regeneration from meal plan
    isClearingRef.current = true;

    // Clear the list
    setShoppingList([]);
    setCurrentListId(null);
    setCurrentListName('');
    setSaveStatus('saved');

    // Clear auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // Clear meal plan from location state to prevent auto-regeneration
    // Replace current history entry to clear the mealPlan state
    navigate('/shopping-list', { replace: true, state: {} });

    // Reset clearing flag after navigation completes
    setTimeout(() => {
      isClearingRef.current = false;
    }, 100);

    console.log('Shopping list cleared successfully');
  };

  const handleSaveAsNewList = async (newName) => {
    try {
      setSaveStatus('saving');

      // Sanitize items before saving
      const sanitizedItems = sanitizeForFirestore(shoppingList);

      const newId = await createShoppingList({
        name: newName,
        items: sanitizedItems,
        type: 'standalone',
        source: currentListId ? 'Copied from existing list' : 'Created from meal plan'
      });
      setCurrentListId(newId);
      setCurrentListName(newName);
      setSaveStatus('saved');
      loadSavedLists();

      const message = currentListId
        ? `New list "${newName}" created successfully!`
        : `List "${newName}" saved successfully!`;
      alert(message);
    } catch (err) {
      console.error('Save as new list failed:', err);
      alert('Failed to save list. Please try again.');
      setSaveStatus('unsaved');
    }
  };

  /* -------------------- recipe integration -------------------- */
  const handleRecipeAdd = async ({ recipe, servings }) => {
    if (!recipe?.ingredients?.length) return;
    const ratio = servings / (recipe.servings || 1);

    const items = recipe.ingredients.map((ing) => ({
      name: ing.ingredientId || 'Unknown',
      quantity: Math.round(((ing.amount || 1) * ratio) * 10) / 10,
      unit: ing.unit || 'items',
      category: 'Recipe Ingredients',
      estimatedCost: 0,
      completed: false,
      alreadyHave: false,
      notes: `From ${recipe.name} (${servings} servings)`,
      id: `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    }));

    if (currentListId) {
      for (const it of items) {
        try {
          await addItemToList(currentListId, it);
        } catch (err) {
          console.error('Add recipe items failed:', err);
        }
      }
    }

    setShoppingList((prev) => [...prev, ...items]);
  };

  /* -------------------- empty‑state JSX -------------------- */
  const renderEmptyState = () => (
    <div className={styles['empty-state']}>
      <h2>Your Shopping Lists</h2>

      <div className={styles['quick-actions']}>
        {Object.keys(mealPlan).length > 0 && (
          <button className={`${styles['action-button']} ${styles['primary-button']}`} onClick={() => setShoppingList([])}>
            Generate from Meal Plan
          </button>
        )}
        <button className={`${styles['action-button']} ${styles['secondary-button']}`} onClick={() => setShowRecipeModal(true)}>
          Add Recipe
        </button>
      </div>

      <div className={styles['quick-categories']}>
        <h3>Quick Add Categories</h3>
        <div className={styles['category-grid']}>
          {SHOPPING_CATEGORIES.map((cat) => (
            <div key={cat.name} className={styles['category-card']}>
              <h4>{cat.name}</h4>
              <div className={styles['category-items']}>
                {cat.subcategories.map((sub) => (
                  <button
                    key={sub.name}
                    className={styles['quick-item-button']}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedSubcategory(sub);
                      setShowCategoriesModal(true);
                    }}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {savedLists.length > 0 && (
        <div className={styles['saved-lists']}>
          <h3>Your Saved Lists</h3>
          <div className={styles['saved-lists-grid']}>
            {savedLists.map((list) => (
              <div key={list.id} className={styles['saved-list-card']}>
                <h4>{list.name}</h4>
                <p>{list.items?.length || 0} items</p>
                <p className={styles['list-date']}>Updated: {list.updatedAt?.toLocaleDateString?.()}</p>
                <div className={styles['list-card-actions']}>
                  <button className={styles['load-list-button']} onClick={() => handleLoadExistingList(list.id)}>
                    Load List
                  </button>
                  <button
                    className={styles['delete-list-button']}
                    onClick={() => handleDeleteFromEmptyState(list.id, list.name)}
                    title="Delete this list"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* -------------------- render -------------------- */
  if (Object.keys(mealPlan).length === 0 && shoppingList.length === 0) {
    return (
      <div className={styles['shopping-list-page']}>
        <Header />
        <div style={{ height: '80px' }} />
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

        {/* global modals – empty state */}
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
      </div>
    );
  }

  // Save status badge component
  const SaveStatusBadge = () => {
    if (!currentListId) return null;

    const statusConfig = {
      saving: { text: 'Saving...', color: '#f0ad4e', icon: '↻' },
      saved: { text: 'Saved', color: '#5cb85c', icon: '✓' },
      unsaved: { text: 'Unsaved', color: '#d9534f', icon: '!' }
    };

    const config = statusConfig[saveStatus];

    return (
      <span
        className={styles['save-status-badge']}
        style={{ color: config.color }}
      >
        {config.icon} {config.text}
      </span>
    );
  };

  return (
    <div className={styles['shopping-list-page']}>
      <Header />
      <div style={{ height: '80px' }} />
      <div className={styles['list-header']}>
        <div className={styles['header-content']}>
          <h1>
            {currentListName || 'Your Shopping List'}
          </h1>
          <SaveStatusBadge />
        </div>
        <div className={styles['header-actions']}>
          <button
            className={styles['preferences-button']}
            onClick={() => setShowPreferences(true)}
            title="Product Preferences"
          >
            <Settings size={20} />
          </button>
          <label className={styles['smart-toggle']}>
            <input
              type="checkbox"
              checked={enableSmartMatching}
              onChange={toggleSmartMatching}
            />
            <Package size={16} />
            <span>Smart Matching</span>
          </label>
        </div>
      </div>

      {isMatchingProducts && (
        <div className={styles['matching-indicator']}>
          <div className={styles['matching-spinner']}></div>
          <span>Finding best products...</span>
        </div>
      )}

      {/* Rename Toast after Auto-save */}
      {showRenameToast && justAutoSaved && (
        <div className={styles['rename-toast']}>
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

      {shoppingList.length === 0 && Object.keys(mealPlan).length > 0 ? (
        // Meal plan exists - show generator to extract ingredients
        <ShoppingListGenerator mealPlan={mealPlan} onListGenerated={handleListGenerated} />
      ) : shoppingList.length === 0 ? (
        // No meal plan and no list - show empty state with saved lists
        <EmptyState
          onCreateNew={handleCreateNewList}
          onLoadTemplate={() => setShowTemplateLibrary(true)}
          onGenerateFromMealPlan={() => navigate('/meal-planner')}
          onViewSaved={() => {
            // Navigate to saved lists section (future feature)
            alert('Saved lists feature coming soon!');
          }}
          savedLists={savedLists}
          onLoadList={handleLoadExistingList}
          savedListsCount={savedLists.length}
          hasTemplates={false}
        />
      ) : (
        <>
          {/* Phase 1: Quick Add Bar - always visible when list exists */}
          <QuickAddBar
            onItemAdd={handleQuickAddItem}
            recentItems={recentIngredients}
          />

          {/* Phase 1: Common Items Bar */}
          <CommonItemsBar
            items={commonItems}
            onItemClick={handleCommonItemClick}
          />

          <div className={styles['shopping-list-container']}>
            {shoppingList.map((item) => (
            enableSmartMatching ? (
              <SmartShoppingListItem
                key={item.id}
                item={item}
                onProductSelect={handleProductSelect}
                onQuantityChange={handleQuantityChange}
                onNoteChange={handleNoteChange}
                onToggleHave={handleAlreadyHaveToggle}
                onClick={() => { setEditingItem(item); setShowEditModal(true); }}
              />
            ) : (
              <ShoppingItem
                key={item.id}
                item={item}
                onQuantityChange={handleQuantityChange}
                onNoteChange={handleNoteChange}
                onToggleHave={handleAlreadyHaveToggle}
                onClick={() => { setEditingItem(item); setShowEditModal(true); }}
              />
            )
          ))}

          </div>
        </>
      )}

      {/* Bottom action bar - clean and minimal */}
      {shoppingList.length > 0 && (
        <div className={styles['bottom-action-bar']}>
          <button
            className={styles['icon-button']}
            onClick={() => setShowCategoriesModal(true)}
            title="Browse Categories"
          >
            <Package size={20} />
          </button>
          <button
            className={styles['icon-button']}
            onClick={() => setShowRecipeModal(true)}
            title="Add Recipe"
          >
            <FileText size={20} />
          </button>
          <button
            className={styles['clear-list-button']}
            onClick={handleClearList}
            title="Clear List"
          >
            Clear List
          </button>
        </div>
      )}

      <BottomNav />

      {/* Saved Shopping Lists Panel */}
      <SavedShoppingLists
        savedLists={savedLists}
        onLoadList={handleLoadExistingList}
        onDeleteList={handlePanelDelete}
        onRenameList={handlePanelRename}
        currentListId={currentListId}
      />

      {/* global modals – main branch */}
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

      {/* Save and Rename modals */}
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

      {/* Product Preferences Panel */}
      {showPreferences && (
        <ProductPreferencesSettings
          onClose={() => setShowPreferences(false)}
        />
      )}

      {/* Phase 1: Template Library Modal */}
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

      {/* Phase 1: Create Template Modal */}
      {showCreateTemplate && (
        <div className={styles['modal-overlay']} onClick={() => setShowCreateTemplate(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <CreateTemplateModal
              currentItems={shoppingList}
              onClose={() => setShowCreateTemplate(false)}
              onTemplateSaved={() => {
                // Refresh common items after saving template
                getCommonItems(8).then(setCommonItems);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingListPage;
