import React, { useState, useEffect } from 'react';
import WeightTracker from './WeightTracker';
import WeightLogModal from './WeightLogModal';
import GoalsCard from './GoalsCard';
import CreateGoalModal from './CreateGoalModal';
import MeasurementsLog from './MeasurementsLog';
import MeasurementsModal from './MeasurementsModal';
import ProgressPhotos from './ProgressPhotos';
import PhotoUploadModal from './PhotoUploadModal';
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
  };

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h1 className={styles.title}>Health Journey</h1>
        <p className={styles.subtitle}>
          Track your progress, set goals, and celebrate your transformation
        </p>
      </div>

      <div className={styles.content}>
        {/* Weight Tracking */}
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
