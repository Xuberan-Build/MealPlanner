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
import { Trash2, Package, Settings } from 'lucide-react';
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

  // Auto-save timer ref
  const autoSaveTimerRef = useRef(null);

  /* -------------------- effects -------------------- */
  useEffect(() => {
    loadSavedLists();
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
    // If smart matching is disabled, use original logic
    if (!enableSmartMatching) {
      setShoppingList(generated);

      if (Object.keys(mealPlan).length > 0) {
        try {
          const id = await createListFromMealPlan(mealPlan, 'Meal Plan Shopping List');
          setCurrentListId(id);
          setCurrentListName('Meal Plan Shopping List');
          setSaveStatus('saved');
          loadSavedLists();
        } catch (err) {
          console.error('Save generated list failed:', err);
        }
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

      // Save to database
      if (Object.keys(mealPlan).length > 0) {
        try {
          const id = await createListFromMealPlan(mealPlan, 'Smart Shopping List');
          // Sanitize items before saving to prevent undefined value errors
          const sanitizedItems = sanitizeForFirestore(enhancedItems);
          await updateShoppingList(id, { items: sanitizedItems });
          setCurrentListId(id);
          setCurrentListName('Smart Shopping List');
          setSaveStatus('saved');
          loadSavedLists();
        } catch (err) {
          console.error('Save generated list failed:', err);
        }
      }
    } catch (err) {
      console.error('Error in smart list generation:', err);
      // Fallback to original list
      setShoppingList(generated);
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
      }
    } catch (err) {
      console.error('Load list failed:', err);
    } finally {
      setIsLoading(false);
    }
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
        <button className={`${styles['action-button']} ${styles['primary-button']}`} onClick={() => handleCreateNewList()}>
          Create New List
        </button>
        <button className={`${styles['action-button']} ${styles['secondary-button']}`} onClick={() => setShowRecipeModal(true)}>
          🍳 Add Recipe
        </button>
        {Object.keys(mealPlan).length > 0 && (
          <button className={`${styles['action-button']} ${styles['secondary-button']}`} onClick={() => setShoppingList([])}>
            Generate from Meal Plan
          </button>
        )}
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
          renderEmptyState()
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

      {shoppingList.length === 0 && Object.keys(mealPlan).length > 0 ? (
        <ShoppingListGenerator mealPlan={mealPlan} onListGenerated={handleListGenerated} />
      ) : (
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

          {/* quick‑add */}
          <div className={styles['quick-add-container']}>
            <div className={styles['quick-add-buttons']}>
              <div className={styles['add-options-row']}>
                <button className={styles['browse-categories-button']} onClick={() => setShowCategoriesModal(true)}>
                  Browse Categories
                </button>
                <button className={styles['add-recipe-button']} onClick={() => setShowRecipeModal(true)}>
                  Add Recipe
                </button>
              </div>

              {showQuickAdd ? (
                <div className={styles['quick-add-form']}>
                  <ShoppingListAutocomplete onItemAdd={handleQuickAddItem} placeholder="Enter item name..." autoFocus />
                  <div className={styles['quick-add-actions']}>
                    <button className={styles['cancel-button']} onClick={() => setShowQuickAdd(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className={styles['quick-add-trigger']} onClick={() => setShowQuickAdd(true)}>
                  Add Custom Item
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* bottom actions */}
      <div className={styles['action-buttons']}>
        {/* Save/Create actions */}
        {currentListId ? (
          <button
            className={`${styles['action-button']} ${styles['primary-button']}`}
            onClick={handleManualSave}
            disabled={saveStatus === 'saved'}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Changes'}
          </button>
        ) : (
          <button
            className={`${styles['action-button']} ${styles['primary-button']}`}
            onClick={() => setShowSaveModal(true)}
          >
            Save List
          </button>
        )}

        {/* Additional actions */}
        {currentListId && (
          <>
            <button
              className={`${styles['action-button']} ${styles['secondary-button']}`}
              onClick={() => setShowRenameModal(true)}
            >
              Rename
            </button>
            <button
              className={`${styles['action-button']} ${styles['secondary-button']}`}
              onClick={() => setShowSaveModal(true)}
            >
              Save As Copy
            </button>
          </>
        )}

        <button
          className={`${styles['action-button']} ${styles['secondary-button']}`}
          onClick={() => handleCreateNewList()}
        >
          Create New List
        </button>

        <button
          className={`${styles['action-button']} ${styles['secondary-button']}`}
          onClick={() => alert('Upload to Instacart')}
        >
          Upload to Instacart
        </button>

        <button
          className={`${styles['action-button']} ${styles['secondary-button']}`}
          onClick={() => navigate('/meal-planner')}
        >
          Back to Meal Plan
        </button>
      </div>

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
    </div>
  );
};

export default ShoppingListPage;
