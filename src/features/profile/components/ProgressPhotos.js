import React, { useState, useEffect } from 'react';
import { getProgressPhotos, updatePhotoPrivacy, deleteProgressPhoto } from '../../../services/healthJourneyService';
import styles from './ProgressPhotos.module.css';

/**
 * ProgressPhotos Component
 *
 * Displays and manages progress photos with comparison tools
 */
const ProgressPhotos = ({ userId, onUploadPhoto }) => {
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [viewFilter, setViewFilter] = useState('all'); // all, front, side, back
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, [userId]);

  const loadPhotos = async () => {
    try {
      setIsLoading(true);
      const fetchedPhotos = await getProgressPhotos(userId);
      setPhotos(fetchedPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoSelect = (photoId) => {
    if (selectedPhotos.includes(photoId)) {
      setSelectedPhotos(selectedPhotos.filter(id => id !== photoId));
    } else if (selectedPhotos.length < 2) {
      setSelectedPhotos([...selectedPhotos, photoId]);
    } else {
      // Replace oldest selection
      setSelectedPhotos([selectedPhotos[1], photoId]);
    }
  };

  const handleCompare = () => {
    if (selectedPhotos.length === 2) {
      setShowComparison(true);
    }
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedPhotos([]);
    setShowComparison(false);
  };

  const handlePrivacyChange = async (photoId, visibility) => {
    try {
      await updatePhotoPrivacy(userId, photoId, visibility);
      loadPhotos(); // Reload to show updated privacy
    } catch (error) {
      console.error('Error updating photo privacy:', error);
    }
  };

  const filteredPhotos = viewFilter === 'all'
    ? photos
    : photos.filter(photo => photo.type === viewFilter);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading photos...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Progress Photos</h2>
        <div className={styles.headerActions}>
          {photos.length > 1 && (
            <button
              className={compareMode ? styles.compareModeActive : styles.compareButton}
              onClick={toggleCompareMode}
            >
              {compareMode ? '✓ Compare Mode' : '🔀 Compare'}
            </button>
          )}
          <button className={styles.uploadButton} onClick={onUploadPhoto}>
            + Upload Photo
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📸</div>
          <h3>No Progress Photos Yet</h3>
          <p>Visual progress is powerful motivation. Start tracking your transformation!</p>
          <button className={styles.createButton} onClick={onUploadPhoto}>
            Upload First Photo
          </button>
          <div className={styles.privacyNote}>
            <span>🔒</span> Photos are private by default
          </div>
        </div>
      ) : (
        <>
          {compareMode && (
            <div className={styles.compareInstructions}>
              <p>Select 2 photos to compare ({selectedPhotos.length}/2 selected)</p>
              {selectedPhotos.length === 2 && (
                <button className={styles.compareNowButton} onClick={handleCompare}>
                  Compare Selected
                </button>
              )}
            </div>
          )}

          {showComparison && selectedPhotos.length === 2 && (
            <PhotoComparison
              photos={photos.filter(p => selectedPhotos.includes(p.id))}
              onClose={() => setShowComparison(false)}
            />
          )}

          <div className={styles.filterTabs}>
            <button
              className={viewFilter === 'all' ? styles.activeTab : styles.tab}
              onClick={() => setViewFilter('all')}
            >
              All ({photos.length})
            </button>
            <button
              className={viewFilter === 'front' ? styles.activeTab : styles.tab}
              onClick={() => setViewFilter('front')}
            >
              Front ({photos.filter(p => p.type === 'front').length})
            </button>
            <button
              className={viewFilter === 'side' ? styles.activeTab : styles.tab}
              onClick={() => setViewFilter('side')}
            >
              Side ({photos.filter(p => p.type === 'side').length})
            </button>
            <button
              className={viewFilter === 'back' ? styles.activeTab : styles.tab}
              onClick={() => setViewFilter('back')}
            >
              Back ({photos.filter(p => p.type === 'back').length})
            </button>
          </div>

          <div className={styles.photoGrid}>
            {filteredPhotos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                compareMode={compareMode}
                isSelected={selectedPhotos.includes(photo.id)}
                onSelect={() => handlePhotoSelect(photo.id)}
                onPrivacyChange={(visibility) => handlePrivacyChange(photo.id, visibility)}
                onReload={loadPhotos}
                userId={userId}
              />
            ))}
          </div>

          {filteredPhotos.length === 0 && (
            <div className={styles.noResults}>
              <p>No {viewFilter} photos yet</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * PhotoCard Component
 *
 * Individual photo card with metadata and actions
 */
const PhotoCard = ({ photo, compareMode, isSelected, onSelect, onPrivacyChange, onReload, userId }) => {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
      try {
        setIsDeleting(true);
        await deleteProgressPhoto(userId, photo.id);
        onReload();
      } catch (error) {
        console.error('Error deleting photo:', error);
        alert('Failed to delete photo. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleClick = () => {
    if (compareMode) {
      onSelect();
    } else {
      setShowActions(!showActions);
    }
  };

  const privacyOptions = [
    { value: 'private', label: '🔒 Private', description: 'Only you' },
    { value: 'coach', label: '👤 Coach Only', description: 'You and your coach' },
    { value: 'public', label: '🌐 Public', description: 'Anyone can see' }
  ];

  return (
    <div
      className={`${styles.photoCard} ${isSelected ? styles.selectedCard : ''}`}
      onClick={handleClick}
    >
      {compareMode && (
        <div className={styles.selectOverlay}>
          <div className={styles.selectCheckbox}>
            {isSelected ? '☑' : '☐'}
          </div>
        </div>
      )}

      <div className={styles.photoWrapper}>
        <img
          src={photo.url}
          alt={`Progress photo from ${new Date(photo.date).toLocaleDateString()}`}
          className={styles.photo}
        />
        <div className={styles.photoBadge}>
          {photo.type.charAt(0).toUpperCase() + photo.type.slice(1)}
        </div>
      </div>

      <div className={styles.photoInfo}>
        <div className={styles.photoDate}>
          {new Date(photo.date).toLocaleDateString()}
        </div>
        {photo.weight && (
          <div className={styles.photoWeight}>
            {photo.weight} lbs
          </div>
        )}
      </div>

      {photo.notes && (
        <div className={styles.photoNotes}>
          {photo.notes}
        </div>
      )}

      {showActions && !compareMode && (
        <div className={styles.photoActions}>
          <div className={styles.privacySection}>
            <div className={styles.privacyLabel}>Privacy:</div>
            <select
              value={photo.visibility || 'private'}
              onChange={(e) => {
                e.stopPropagation();
                onPrivacyChange(e.target.value);
              }}
              className={styles.privacySelect}
              onClick={(e) => e.stopPropagation()}
            >
              {privacyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className={styles.deleteButton}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : '🗑 Delete'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * PhotoComparison Component
 *
 * Side-by-side photo comparison
 */
const PhotoComparison = ({ photos, onClose }) => {
  if (photos.length !== 2) return null;

  const [photo1, photo2] = photos.sort((a, b) => new Date(a.date) - new Date(b.date));

  const daysBetween = Math.floor(
    (new Date(photo2.date) - new Date(photo1.date)) / (1000 * 60 * 60 * 24)
  );

  const weightChange = photo1.weight && photo2.weight
    ? photo2.weight - photo1.weight
    : null;

  return (
    <div className={styles.comparisonModal}>
      <div className={styles.comparisonHeader}>
        <h3>Photo Comparison</h3>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
      </div>

      <div className={styles.comparisonStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Time Period</div>
          <div className={styles.statValue}>{daysBetween} days</div>
        </div>
        {weightChange !== null && (
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Weight Change</div>
            <div className={`${styles.statValue} ${weightChange < 0 ? styles.weightLoss : styles.weightGain}`}>
              {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} lbs
            </div>
          </div>
        )}
      </div>

      <div className={styles.comparisonGrid}>
        <div className={styles.comparisonPhoto}>
          <div className={styles.comparisonLabel}>Before</div>
          <img src={photo1.url} alt="Before" className={styles.compareImage} />
          <div className={styles.comparisonMeta}>
            <div>{new Date(photo1.date).toLocaleDateString()}</div>
            {photo1.weight && <div>{photo1.weight} lbs</div>}
          </div>
        </div>

        <div className={styles.comparisonArrow}>→</div>

        <div className={styles.comparisonPhoto}>
          <div className={styles.comparisonLabel}>After</div>
          <img src={photo2.url} alt="After" className={styles.compareImage} />
          <div className={styles.comparisonMeta}>
            <div>{new Date(photo2.date).toLocaleDateString()}</div>
            {photo2.weight && <div>{photo2.weight} lbs</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressPhotos;
