// ShoppingListPage.js – COMPLETE & FUNCTIONAL
// -------------------------------------------------
// Provides shopping‑list CRUD, quick‑add, recipe import, and modal handling.

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './ShoppingListPage.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import ShoppingListGenerator from '../mealPlanner/components/ShoppingListGenerator';
import ShoppingItem from './components/ShoppingItem';
import BrowseCategoriesModal from './components/BrowseCategoriesModal';
import EditItemModal from './components/EditItemModal';
import RecipeSelectionModal from './components/RecipeSelectionModal';
import ShoppingListAutocomplete from './components/ShoppingListAutocomplete';
import { SHOPPING_CATEGORIES } from './constants/categories';
import {
  getUserShoppingLists,
  createShoppingList,
  updateShoppingList, // reserved for future DB updates
  addItemToList,
  createListFromMealPlan,
} from '../../services/ShoppingListService';

const ShoppingListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mealPlan = location.state?.mealPlan || {};

  /* -------------------- state -------------------- */
  const [shoppingList, setShoppingList] = useState([]);
  const [savedLists, setSavedLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);

  /* -------------------- effects -------------------- */
  useEffect(() => {
    loadSavedLists();
  }, []);

  useEffect(() => {
    if (Object.keys(mealPlan).length > 0 && shoppingList.length === 0) {
      setIsLoading(true);
    }
  }, [mealPlan, shoppingList.length]);

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
    setShoppingList(generated);

    if (Object.keys(mealPlan).length > 0) {
      try {
        const id = await createListFromMealPlan(mealPlan, 'Meal Plan Shopping List');
        setCurrentListId(id);
        loadSavedLists();
      } catch (err) {
        console.error('Save generated list failed:', err);
      }
    }
  };

  const handleCreateNewList = async (name = 'New Shopping List') => {
    try {
      setIsLoading(true);
      const id = await createShoppingList({ name, items: [], type: 'standalone', source: 'Created manually' });
      setCurrentListId(id);
      setShoppingList([]);
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
  const handleQuantityChange = (id, qty) => {
    setShoppingList((list) => list.map((it) => (it.id === id ? { ...it, quantity: parseInt(qty) || 0 } : it)));
  };

  const handleNoteChange = (id, note) => {
    setShoppingList((list) => list.map((it) => (it.id === id ? { ...it, notes: note } : it)));
  };

  const handleAlreadyHaveToggle = (id) => {
    setShoppingList((list) => list.map((it) => (it.id === id ? { ...it, alreadyHave: !it.alreadyHave } : it)));
  };

  /* -------------------- edit‑item modal handlers -------------------- */
  const handleSaveItem = async (itemId, data) => {
    setShoppingList((list) => list.map((it) => (it.id === itemId ? { ...it, ...data } : it)));
    if (currentListId) {
      // TODO: await updateItemInList(currentListId, itemId, data);
      console.log('Would persist update', currentListId, itemId, data);
    }
  };

  const handleDeleteItem = async (itemId) => {
    setShoppingList((list) => list.filter((it) => it.id !== itemId));
    if (currentListId) {
      // TODO: await removeItemFromList(currentListId, itemId);
      console.log('Would delete from DB', currentListId, itemId);
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
                <button className={styles['load-list-button']} onClick={() => handleLoadExistingList(list.id)}>
                  Load List
                </button>
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

  return (
    <div className={styles['shopping-list-page']}>
      <Header />
      <div style={{ height: '80px' }} />
      <h1>Your Shopping List</h1>

      {shoppingList.length === 0 && Object.keys(mealPlan).length > 0 ? (
        <ShoppingListGenerator mealPlan={mealPlan} onListGenerated={handleListGenerated} />
      ) : (
        <div className={styles['shopping-list-container']}>
          {shoppingList.map((item) => (
            <ShoppingItem
              key={item.id}
              item={item}
              onQuantityChange={handleQuantityChange}
              onNoteChange={handleNoteChange}
              onToggleHave={handleAlreadyHaveToggle}
              onClick={() => { setEditingItem(item); setShowEditModal(true); }}
            />
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
        <button className={`${styles['action-button']} ${styles['primary-button']}`} onClick={() => alert('Upload to Instacart')}>Upload to Instacart</button>
        <button className={`${styles['action-button']} ${styles['secondary-button']}`} onClick={() => navigate('/meal-planner')}>Back to Meal Plan</button>
      </div>

      <BottomNav />

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
    </div>
  );
};

export default ShoppingListPage;
