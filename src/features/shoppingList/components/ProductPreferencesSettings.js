/**
 * ProductPreferencesSettings
 *
 * Settings component for managing user product preferences:
 * - Dietary restrictions
 * - Preferred brands
 * - Preferred stores
 * - Shopping habits
 */

import React, { useState, useEffect } from 'react';
import styles from './ProductPreferencesSettings.module.css';
import {
  getUserPreferences,
  updateDietaryRestrictions,
  addPreferredBrand,
  removePreferredBrand,
  addPreferredStore,
  setPrimaryStore,
  updateShoppingHabits
} from '../../../services/userProductPreferencesService';
import { Check, X, Plus, Trash2, Star } from 'lucide-react';

const ProductPreferencesSettings = ({ onClose }) => {
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('dietary'); // dietary, brands, stores, habits

  // Form states
  const [newBrand, setNewBrand] = useState('');
  const [newStore, setNewStore] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const prefs = await getUserPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDietaryChange = async (restriction, value) => {
    try {
      setIsSaving(true);
      const updated = {
        ...preferences.dietaryRestrictions,
        [restriction]: value
      };
      await updateDietaryRestrictions(updated);
      setPreferences({
        ...preferences,
        dietaryRestrictions: updated
      });
    } catch (error) {
      console.error('Error updating dietary restrictions:', error);
      alert('Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBrand = async () => {
    if (!newBrand.trim()) return;

    try {
      setIsSaving(true);
      await addPreferredBrand(newBrand.trim());
      await loadPreferences();
      setNewBrand('');
    } catch (error) {
      console.error('Error adding brand:', error);
      alert('Failed to add brand');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveBrand = async (brand) => {
    try {
      setIsSaving(true);
      await removePreferredBrand(brand);
      await loadPreferences();
    } catch (error) {
      console.error('Error removing brand:', error);
      alert('Failed to remove brand');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStore = async () => {
    if (!newStore.trim()) return;

    try {
      setIsSaving(true);
      await addPreferredStore({
        name: newStore.trim(),
        priority: (preferences.preferredStores?.length || 0) + 1
      });
      await loadPreferences();
      setNewStore('');
    } catch (error) {
      console.error('Error adding store:', error);
      alert('Failed to add store');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimaryStore = async (storeName) => {
    try {
      setIsSaving(true);
      await setPrimaryStore(storeName);
      await loadPreferences();
    } catch (error) {
      console.error('Error setting primary store:', error);
      alert('Failed to set primary store');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHabitsChange = async (habit, value) => {
    try {
      setIsSaving(true);
      const updated = {
        ...preferences.shoppingHabits,
        [habit]: value
      };
      await updateShoppingHabits(updated);
      setPreferences({
        ...preferences,
        shoppingHabits: updated
      });
    } catch (error) {
      console.error('Error updating shopping habits:', error);
      alert('Failed to update habits');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !preferences) {
    return (
      <div className={styles.settingsContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.header}>
        <h2>Product Preferences</h2>
        <button className={styles.closeButton} onClick={onClose}>
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'dietary' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('dietary')}
        >
          Dietary
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'brands' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('brands')}
        >
          Brands
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stores' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          Stores
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'habits' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('habits')}
        >
          Habits
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Dietary Restrictions Tab */}
        {activeTab === 'dietary' && (
          <div className={styles.tabContent}>
            <p className={styles.tabDescription}>
              Select your dietary restrictions to filter product recommendations
            </p>

            <div className={styles.optionsList}>
              {Object.entries({
                organic: 'Organic',
                nonGMO: 'Non-GMO',
                glutenFree: 'Gluten-Free',
                vegan: 'Vegan',
                vegetarian: 'Vegetarian',
                kosher: 'Kosher',
                halal: 'Halal',
                dairyFree: 'Dairy-Free',
                nutFree: 'Nut-Free'
              }).map(([key, label]) => (
                <label key={key} className={styles.checkboxOption}>
                  <input
                    type="checkbox"
                    checked={preferences.dietaryRestrictions?.[key] || false}
                    onChange={(e) => handleDietaryChange(key, e.target.checked)}
                    disabled={isSaving}
                  />
                  <span className={styles.checkboxLabel}>{label}</span>
                  {preferences.dietaryRestrictions?.[key] && (
                    <Check size={18} className={styles.checkIcon} />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Preferred Brands Tab */}
        {activeTab === 'brands' && (
          <div className={styles.tabContent}>
            <p className={styles.tabDescription}>
              Add brands you prefer. Products from these brands will be prioritized.
            </p>

            <div className={styles.addItemForm}>
              <input
                type="text"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="e.g., Organic Valley, King Arthur..."
                className={styles.addInput}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddBrand();
                  }
                }}
                disabled={isSaving}
              />
              <button
                onClick={handleAddBrand}
                className={styles.addButton}
                disabled={!newBrand.trim() || isSaving}
              >
                <Plus size={20} />
                Add
              </button>
            </div>

            <div className={styles.itemsList}>
              {preferences.preferredBrands && preferences.preferredBrands.length > 0 ? (
                preferences.preferredBrands.map((brand, index) => (
                  <div key={index} className={styles.listItem}>
                    <span>{brand}</span>
                    <button
                      onClick={() => handleRemoveBrand(brand)}
                      className={styles.removeButton}
                      disabled={isSaving}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>No preferred brands added yet</p>
              )}
            </div>
          </div>
        )}

        {/* Preferred Stores Tab */}
        {activeTab === 'stores' && (
          <div className={styles.tabContent}>
            <p className={styles.tabDescription}>
              Add your favorite stores. We'll check availability and pricing for these stores.
            </p>

            <div className={styles.addItemForm}>
              <input
                type="text"
                value={newStore}
                onChange={(e) => setNewStore(e.target.value)}
                placeholder="e.g., Trader Joe's, Whole Foods..."
                className={styles.addInput}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddStore();
                  }
                }}
                disabled={isSaving}
              />
              <button
                onClick={handleAddStore}
                className={styles.addButton}
                disabled={!newStore.trim() || isSaving}
              >
                <Plus size={20} />
                Add
              </button>
            </div>

            <div className={styles.itemsList}>
              {preferences.preferredStores && preferences.preferredStores.length > 0 ? (
                preferences.preferredStores.map((store, index) => (
                  <div key={index} className={styles.listItem}>
                    <span>{store.name}</span>
                    <button
                      onClick={() => handleSetPrimaryStore(store.name)}
                      className={`${styles.starButton} ${preferences.primaryStore === store.name ? styles.primary : ''}`}
                      disabled={isSaving}
                      title="Set as primary store"
                    >
                      <Star size={18} fill={preferences.primaryStore === store.name ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>No preferred stores added yet</p>
              )}
            </div>

            {preferences.primaryStore && (
              <div className={styles.primaryStoreInfo}>
                <Star size={16} />
                <span>Primary store: <strong>{preferences.primaryStore}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Shopping Habits Tab */}
        {activeTab === 'habits' && (
          <div className={styles.tabContent}>
            <p className={styles.tabDescription}>
              Tell us about your shopping habits to improve recommendations
            </p>

            <div className={styles.optionsList}>
              {Object.entries({
                buyInBulk: 'I prefer buying in bulk',
                priceConscious: 'I prioritize lower prices',
                qualityConscious: 'I prioritize quality over price',
                brandLoyal: 'I stick to brands I trust',
                prefersOrganic: 'I prefer organic products'
              }).map(([key, label]) => (
                <label key={key} className={styles.checkboxOption}>
                  <input
                    type="checkbox"
                    checked={preferences.shoppingHabits?.[key] || false}
                    onChange={(e) => handleHabitsChange(key, e.target.checked)}
                    disabled={isSaving}
                  />
                  <span className={styles.checkboxLabel}>{label}</span>
                  {preferences.shoppingHabits?.[key] && (
                    <Check size={18} className={styles.checkIcon} />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saving Indicator */}
      {isSaving && (
        <div className={styles.savingIndicator}>
          <div className={styles.smallSpinner}></div>
          <span>Saving...</span>
        </div>
      )}
    </div>
  );
};

export default ProductPreferencesSettings;
