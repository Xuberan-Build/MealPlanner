import React, { useState, useMemo } from 'react';
import { useDietTypes, useDietTypePreferences, useDietTypeSearch } from '../../hooks/useDietTypes';
import { Heart, Search, Plus, Edit2, Trash2, Eye, EyeOff, X } from 'lucide-react';
import './DietTypeManager.css';

/**
 * DietTypeManager - Main interface for managing diet types
 * Features:
 * - View all diet types (system + custom)
 * - Create new custom diet types
 * - Edit/delete custom diet types
 * - Favorite/hide diet types
 * - Search and filter
 */
const DietTypeManager = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'favorites', 'custom', 'system'
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [newDietType, setNewDietType] = useState({ name: '', description: '' });

  // Hooks
  const {
    dietTypes: allDietTypes,
    loading,
    error,
    totalCount,
    visibleCount,
    favoritesCount,
    customCount,
    createDietType,
    updateDietType,
    deleteDietType,
    canEditDietType,
    canDeleteDietType
  } = useDietTypes({ visibleOnly: false });

  const {
    toggleFavorite,
    toggleHidden,
    isFavorite,
    isHidden
  } = useDietTypePreferences();

  const {
    searchTerm,
    setSearchTerm,
    results: searchResults,
    isSearching,
    clearSearch
  } = useDietTypeSearch();

  // Filter diet types based on active tab
  const filteredDietTypes = useMemo(() => {
    let types = searchTerm ? searchResults : allDietTypes;

    switch (activeTab) {
      case 'favorites':
        return types.filter(dt => isFavorite(dt.id));
      case 'custom':
        return types.filter(dt => dt.createdBy !== 'system');
      case 'system':
        return types.filter(dt => dt.createdBy === 'system');
      case 'all':
      default:
        return types;
    }
  }, [activeTab, allDietTypes, searchResults, searchTerm, isFavorite]);

  // Handle create new diet type
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newDietType.name.trim()) return;

    try {
      await createDietType(newDietType);
      setNewDietType({ name: '', description: '' });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create diet type:', error);
      alert(error.message || 'Failed to create diet type');
    }
  };

  // Handle update diet type
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingType) return;

    try {
      await updateDietType(editingType.id, {
        name: editingType.name,
        description: editingType.description
      });
      setEditingType(null);
    } catch (error) {
      console.error('Failed to update diet type:', error);
      alert(error.message || 'Failed to update diet type');
    }
  };

  // Handle delete diet type
  const handleDelete = async (dietType) => {
    const affectedCount = dietType.recipeCount || 0;
    const confirmMsg = affectedCount > 0
      ? `This will archive "${dietType.name}" and affect ${affectedCount} recipe(s). Continue?`
      : `Archive "${dietType.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDietType(dietType.id);
    } catch (error) {
      console.error('Failed to delete diet type:', error);
      alert(error.message || 'Failed to delete diet type');
    }
  };

  if (loading) {
    return (
      <div className="diet-type-manager-overlay">
        <div className="diet-type-manager">
          <div className="loading-state">Loading diet types...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="diet-type-manager-overlay" onClick={onClose}>
      <div className="diet-type-manager" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="manager-header">
          <h2>Manage Diet Types</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="manager-search">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search diet types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-search" onClick={clearSearch}>
                <X size={16} />
              </button>
            )}
          </div>
          {isSearching && <span className="search-indicator">Searching...</span>}
        </div>

        {/* Tabs */}
        <div className="manager-tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({totalCount})
          </button>
          <button
            className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            Favorites ({favoritesCount})
          </button>
          <button
            className={`tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom ({customCount})
          </button>
          <button
            className={`tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            System ({totalCount - customCount})
          </button>
        </div>

        {/* Create Button */}
        {!showCreateForm && (
          <div className="manager-actions">
            <button
              className="create-button"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus size={18} />
              Create Custom Diet Type
            </button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="create-form">
            <h3>Create New Diet Type</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={newDietType.name}
                  onChange={(e) => setNewDietType({ ...newDietType, name: e.target.value })}
                  placeholder="e.g., Mediterranean"
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={newDietType.description}
                  onChange={(e) => setNewDietType({ ...newDietType, description: e.target.value })}
                  placeholder="Brief description of this diet type..."
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-button">
                  Create
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewDietType({ name: '', description: '' });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Diet Types List */}
        <div className="diet-types-list">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {filteredDietTypes.length === 0 ? (
            <div className="empty-state">
              {searchTerm ? (
                <>
                  <p>No diet types match "{searchTerm}"</p>
                  <button className="clear-search-button" onClick={clearSearch}>
                    Clear Search
                  </button>
                </>
              ) : (
                <p>No diet types found</p>
              )}
            </div>
          ) : (
            filteredDietTypes.map((dietType) => {
              const isEditing = editingType?.id === dietType.id;
              const canEdit = canEditDietType(dietType);
              const canDelete = canDeleteDietType(dietType);
              const favorite = isFavorite(dietType.id);
              const hidden = isHidden(dietType.id);
              const isSystem = dietType.createdBy === 'system';

              return (
                <div
                  key={dietType.id}
                  className={`diet-type-item ${hidden ? 'hidden-type' : ''} ${isSystem ? 'system-type' : 'custom-type'}`}
                >
                  {isEditing ? (
                    // Edit Mode
                    <form onSubmit={handleUpdate} className="edit-form">
                      <div className="form-group">
                        <input
                          type="text"
                          value={editingType.name}
                          onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                          maxLength={50}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="form-group">
                        <textarea
                          value={editingType.description || ''}
                          onChange={(e) => setEditingType({ ...editingType, description: e.target.value })}
                          maxLength={500}
                          rows={2}
                          placeholder="Description (optional)"
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="save-button">Save</button>
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => setEditingType(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    // View Mode
                    <>
                      <div className="diet-type-info">
                        <div className="diet-type-header">
                          <h4>{dietType.name}</h4>
                          {isSystem && <span className="system-badge">System</span>}
                          {hidden && <span className="hidden-badge">Hidden</span>}
                        </div>
                        {dietType.description && (
                          <p className="diet-type-description">{dietType.description}</p>
                        )}
                        <div className="diet-type-meta">
                          <span className="recipe-count">
                            {dietType.recipeCount || 0} recipe{dietType.recipeCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="diet-type-actions">
                        <button
                          className={`icon-button ${favorite ? 'active' : ''}`}
                          onClick={() => toggleFavorite(dietType.id)}
                          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
                        </button>

                        <button
                          className={`icon-button ${hidden ? 'active' : ''}`}
                          onClick={() => toggleHidden(dietType.id)}
                          title={hidden ? 'Show' : 'Hide'}
                        >
                          {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>

                        {canEdit && (
                          <button
                            className="icon-button"
                            onClick={() => setEditingType(dietType)}
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            className="icon-button delete"
                            onClick={() => handleDelete(dietType)}
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="manager-footer">
          <p>
            Showing {filteredDietTypes.length} of {totalCount} diet types
            {visibleCount < totalCount && ` • ${totalCount - visibleCount} hidden`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DietTypeManager;
