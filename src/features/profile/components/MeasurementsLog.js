import React, { useState, useEffect } from 'react';
import { getMeasurementsHistory, compareMeasurements } from '../../../services/healthJourneyService';
import styles from './MeasurementsLog.module.css';

/**
 * MeasurementsLog Component
 *
 * Displays body measurements history with comparison tools
 */
const MeasurementsLog = ({ userId, onLogMeasurements }) => {
  const [measurements, setMeasurements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    loadMeasurements();
  }, [userId]);

  const loadMeasurements = async () => {
    try {
      setIsLoading(true);
      const history = await getMeasurementsHistory(userId);
      setMeasurements(history);
    } catch (error) {
      console.error('Error loading measurements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedEntries.length === 2) {
      try {
        const result = await compareMeasurements(userId, selectedEntries[0], selectedEntries[1]);
        setComparison(result);
      } catch (error) {
        console.error('Error comparing measurements:', error);
      }
    }
  };

  const toggleSelectEntry = (entryId) => {
    if (selectedEntries.includes(entryId)) {
      setSelectedEntries(selectedEntries.filter(id => id !== entryId));
    } else if (selectedEntries.length < 2) {
      setSelectedEntries([...selectedEntries, entryId]);
    } else {
      // Replace oldest selection
      setSelectedEntries([selectedEntries[1], entryId]);
    }
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedEntries([]);
    setComparison(null);
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading measurements...</p>
      </div>
    );
  }

  const currentMeasurements = measurements.length > 0 ? measurements[0] : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Body Measurements</h2>
        <div className={styles.headerActions}>
          {measurements.length > 1 && (
            <button
              className={compareMode ? styles.compareModeActive : styles.compareButton}
              onClick={toggleCompareMode}
            >
              {compareMode ? '✓ Compare Mode' : '📊 Compare'}
            </button>
          )}
          <button className={styles.logButton} onClick={onLogMeasurements}>
            + Log Measurements
          </button>
        </div>
      </div>

      {measurements.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📏</div>
          <h3>No Measurements Yet</h3>
          <p>Track your body measurements to see progress over time</p>
          <button className={styles.createButton} onClick={onLogMeasurements}>
            Log First Measurement
          </button>
        </div>
      ) : (
        <>
          {!compareMode && currentMeasurements && (
            <CurrentMeasurements measurements={currentMeasurements} />
          )}

          {compareMode && (
            <div className={styles.compareInstructions}>
              <p>Select 2 entries to compare ({selectedEntries.length}/2 selected)</p>
              {selectedEntries.length === 2 && (
                <button className={styles.compareNowButton} onClick={handleCompare}>
                  Compare Selected
                </button>
              )}
            </div>
          )}

          {comparison && (
            <ComparisonView comparison={comparison} onClose={() => setComparison(null)} />
          )}

          <div className={styles.historySection}>
            <h3>Measurement History</h3>
            <div className={styles.historyList}>
              {measurements.map((entry, index) => (
                <MeasurementEntry
                  key={entry.id}
                  entry={entry}
                  isLatest={index === 0}
                  compareMode={compareMode}
                  isSelected={selectedEntries.includes(entry.id)}
                  onSelect={() => toggleSelectEntry(entry.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * CurrentMeasurements Component
 *
 * Displays the most recent measurements in a grid
 */
const CurrentMeasurements = ({ measurements }) => {
  const measurementFields = [
    { key: 'chest', label: 'Chest', unit: 'in' },
    { key: 'waist', label: 'Waist', unit: 'in' },
    { key: 'hips', label: 'Hips', unit: 'in' },
    { key: 'leftArm', label: 'Left Arm', unit: 'in' },
    { key: 'rightArm', label: 'Right Arm', unit: 'in' },
    { key: 'leftThigh', label: 'Left Thigh', unit: 'in' },
    { key: 'rightThigh', label: 'Right Thigh', unit: 'in' },
    { key: 'neck', label: 'Neck', unit: 'in' },
    { key: 'shoulders', label: 'Shoulders', unit: 'in' },
    { key: 'calves', label: 'Calves', unit: 'in' }
  ];

  const activeMeasurements = measurementFields.filter(
    field => measurements.measurements[field.key] !== undefined && measurements.measurements[field.key] !== null
  );

  return (
    <div className={styles.currentSection}>
      <div className={styles.sectionHeader}>
        <h3>Current Measurements</h3>
        <span className={styles.date}>
          {new Date(measurements.date).toLocaleDateString()}
        </span>
      </div>
      <div className={styles.measurementsGrid}>
        {activeMeasurements.map(field => (
          <div key={field.key} className={styles.measurementCard}>
            <div className={styles.measurementLabel}>{field.label}</div>
            <div className={styles.measurementValue}>
              {measurements.measurements[field.key]} {field.unit}
            </div>
          </div>
        ))}
      </div>
      {measurements.notes && (
        <div className={styles.notes}>
          <strong>Notes:</strong> {measurements.notes}
        </div>
      )}
    </div>
  );
};

/**
 * MeasurementEntry Component
 *
 * Individual entry in the history list
 */
const MeasurementEntry = ({ entry, isLatest, compareMode, isSelected, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const measurementFields = [
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'hips', label: 'Hips' },
    { key: 'leftArm', label: 'Left Arm' },
    { key: 'rightArm', label: 'Right Arm' },
    { key: 'leftThigh', label: 'Left Thigh' },
    { key: 'rightThigh', label: 'Right Thigh' },
    { key: 'neck', label: 'Neck' },
    { key: 'shoulders', label: 'Shoulders' },
    { key: 'calves', label: 'Calves' }
  ];

  const activeMeasurements = measurementFields.filter(
    field => entry.measurements[field.key] !== undefined && entry.measurements[field.key] !== null
  );

  const handleClick = () => {
    if (compareMode) {
      onSelect();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`${styles.entryCard} ${isLatest ? styles.latestEntry : ''} ${isSelected ? styles.selectedEntry : ''}`}
      onClick={handleClick}
    >
      <div className={styles.entryHeader}>
        <div className={styles.entryDate}>
          {compareMode && (
            <span className={styles.checkbox}>
              {isSelected ? '☑' : '☐'}
            </span>
          )}
          <span className={styles.dateText}>
            {new Date(entry.date).toLocaleDateString()}
          </span>
          {isLatest && <span className={styles.latestBadge}>Latest</span>}
        </div>
        {!compareMode && (
          <span className={styles.expandIcon}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {(isExpanded || compareMode) && (
        <div className={styles.entryDetails}>
          <div className={styles.measurementsList}>
            {activeMeasurements.map(field => (
              <div key={field.key} className={styles.measurementRow}>
                <span className={styles.rowLabel}>{field.label}:</span>
                <span className={styles.rowValue}>{entry.measurements[field.key]} in</span>
              </div>
            ))}
          </div>
          {entry.notes && (
            <div className={styles.entryNotes}>
              <strong>Notes:</strong> {entry.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * ComparisonView Component
 *
 * Shows side-by-side comparison of two measurement entries
 */
const ComparisonView = ({ comparison, onClose }) => {
  if (!comparison) return null;

  const { entry1, entry2, differences } = comparison;

  const measurementFields = [
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'hips', label: 'Hips' },
    { key: 'leftArm', label: 'Left Arm' },
    { key: 'rightArm', label: 'Right Arm' },
    { key: 'leftThigh', label: 'Left Thigh' },
    { key: 'rightThigh', label: 'Right Thigh' },
    { key: 'neck', label: 'Neck' },
    { key: 'shoulders', label: 'Shoulders' },
    { key: 'calves', label: 'Calves' }
  ];

  const activeDifferences = measurementFields.filter(
    field => differences[field.key] !== undefined && differences[field.key] !== null
  );

  return (
    <div className={styles.comparisonModal}>
      <div className={styles.comparisonHeader}>
        <h3>Comparison Results</h3>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
      </div>

      <div className={styles.comparisonDates}>
        <div className={styles.comparisonDate}>
          <span className={styles.dateLabel}>From:</span>
          <span>{new Date(entry1.date).toLocaleDateString()}</span>
        </div>
        <div className={styles.comparisonArrow}>→</div>
        <div className={styles.comparisonDate}>
          <span className={styles.dateLabel}>To:</span>
          <span>{new Date(entry2.date).toLocaleDateString()}</span>
        </div>
      </div>

      <div className={styles.comparisonTable}>
        <div className={styles.tableHeader}>
          <div className={styles.tableCell}>Measurement</div>
          <div className={styles.tableCell}>Before</div>
          <div className={styles.tableCell}>After</div>
          <div className={styles.tableCell}>Change</div>
        </div>

        {activeDifferences.map(field => {
          const diff = differences[field.key];
          const isIncrease = diff > 0;
          const isDecrease = diff < 0;

          return (
            <div key={field.key} className={styles.tableRow}>
              <div className={styles.tableCell}>{field.label}</div>
              <div className={styles.tableCell}>
                {entry1.measurements[field.key] || '-'} in
              </div>
              <div className={styles.tableCell}>
                {entry2.measurements[field.key] || '-'} in
              </div>
              <div className={`${styles.tableCell} ${styles.changeCell}`}>
                <span className={isIncrease ? styles.increase : isDecrease ? styles.decrease : styles.noChange}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} in
                  {isIncrease && ' ↑'}
                  {isDecrease && ' ↓'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MeasurementsLog;
