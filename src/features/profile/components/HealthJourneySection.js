import React, { useState, useEffect } from 'react';
import WeightTracker from './WeightTracker';
import WeightLogModal from './WeightLogModal';
import GoalsCard from './GoalsCard';
import CreateGoalModal from './CreateGoalModal';
import MeasurementsLog from './MeasurementsLog';
import MeasurementsModal from './MeasurementsModal';
import ProgressPhotos from './ProgressPhotos';
import PhotoUploadModal from './PhotoUploadModal';
import FoodJournalCard from './FoodJournalCard';
import FoodJournalEntryModal from './FoodJournalEntryModal';
import { getWeightStats } from '../../../services/healthJourneyService';
import styles from './HealthJourneySection.module.css';

/**
 * HealthJourneySection Component
 *
 * Main wrapper component for all health journey tracking features
 * Manages modals and coordinates between sub-components
 */
const HealthJourneySection = ({ userId }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [currentWeight, setCurrentWeight] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    loadCurrentWeight();
  }, [userId]);

  const loadCurrentWeight = async () => {
    try {
      const stats = await getWeightStats(userId);
      if (stats && stats.current) {
        setCurrentWeight(stats.current);
      }
    } catch (error) {
      console.error('Error loading current weight:', error);
    }
  };

  const handleModalSuccess = () => {
    // Trigger refresh of all components
    setRefreshKey(prev => prev + 1);
    loadCurrentWeight();
  };

  const openModal = (modalName) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
    setEditingEntry(null); // Clear editing entry when closing
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setActiveModal('foodJournal');
  };

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h1 className={styles.title}>Wellness Journey</h1>
        <p className={styles.subtitle}>
          Track how food makes you feel, monitor your progress, and discover what works best for you
        </p>
      </div>

      <div className={styles.content}>
        {/* Food & Wellness Journal - Primary Feature */}
        <FoodJournalCard
          key={`foodJournal-${refreshKey}`}
          userId={userId}
          onAddEntry={() => {
            setEditingEntry(null); // Clear any editing state
            openModal('foodJournal');
          }}
          onEditEntry={handleEditEntry}
        />

        {/* Weight Tracking - De-emphasized */}
        <WeightTracker
          key={`weight-${refreshKey}`}
          userId={userId}
          onLogWeight={() => openModal('weightLog')}
        />

        {/* Goals & Milestones */}
        <GoalsCard
          key={`goals-${refreshKey}`}
          userId={userId}
          onCreateGoal={() => openModal('createGoal')}
        />

        {/* Body Measurements */}
        <MeasurementsLog
          key={`measurements-${refreshKey}`}
          userId={userId}
          onLogMeasurements={() => openModal('measurements')}
        />

        {/* Progress Photos */}
        <ProgressPhotos
          key={`photos-${refreshKey}`}
          userId={userId}
          onUploadPhoto={() => openModal('photoUpload')}
        />
      </div>

      {/* Modals */}
      <FoodJournalEntryModal
        isOpen={activeModal === 'foodJournal'}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        userId={userId}
        editEntry={editingEntry}
      />

      <WeightLogModal
        isOpen={activeModal === 'weightLog'}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        userId={userId}
      />

      <CreateGoalModal
        isOpen={activeModal === 'createGoal'}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        userId={userId}
        currentWeight={currentWeight}
      />

      <MeasurementsModal
        isOpen={activeModal === 'measurements'}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        userId={userId}
      />

      <PhotoUploadModal
        isOpen={activeModal === 'photoUpload'}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        userId={userId}
        currentWeight={currentWeight}
      />
    </div>
  );
};

export default HealthJourneySection;
