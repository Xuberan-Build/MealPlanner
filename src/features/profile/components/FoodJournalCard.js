import React, { useState, useEffect } from 'react';
import { getFoodJournalEntries, getFoodInsights, deleteFoodJournalEntry } from '../../../services/healthJourneyService';
import styles from './FoodJournalCard.module.css';

/**
 * FoodJournalCard Component
 *
 * Displays recent food journal entries and insights
 */
const FoodJournalCard = ({ userId, onAddEntry, onEditEntry }) => {
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7); // days
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadJournalData();
  }, [userId, timeRange]);

  const loadJournalData = async () => {
    try {
      setIsLoading(true);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      const journalEntries = await getFoodJournalEntries(userId, { startDate, endDate });
      const journalInsights = await getFoodInsights(userId);

      setEntries(journalEntries);
      setInsights(journalInsights);
    } catch (error) {
      console.error('Error loading journal data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEnergyLabel = (level) => {
    if (level === null) return 'N/A';
    if (level >= 4) return 'High';
    if (level >= 3) return 'Good';
    if (level >= 2) return 'Low';
    return 'Very Low';
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    try {
      setDeletingId(entryId);
      await deleteFoodJournalEntry(userId, entryId);
      await loadJournalData(); // Refresh data
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (entry) => {
    if (onEditEntry) {
      onEditEntry(entry);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading journal...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Food & Wellness Journal</h2>
        </div>
        <div className={styles.emptyState}>
          <h3>Start Your Food Journal</h3>
          <p>Track how different foods make you feel and discover what works best for your body</p>
          <button className={styles.addButton} onClick={onAddEntry}>
            Log Your First Entry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Food & Wellness Journal</h2>
        <div className={styles.timeRangeSelector}>
          <button
            className={timeRange === 7 ? styles.active : ''}
            onClick={() => setTimeRange(7)}
          >
            7D
          </button>
          <button
            className={timeRange === 30 ? styles.active : ''}
            onClick={() => setTimeRange(30)}
          >
            30D
          </button>
          <button
            className={timeRange === 90 ? styles.active : ''}
            onClick={() => setTimeRange(90)}
          >
            90D
          </button>
        </div>
      </div>

      {insights && (
        <div className={styles.insights}>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Avg Energy</span>
            <span className={styles.insightValue}>
              {insights.averageEnergy?.toFixed(1) || 'N/A'}/5
            </span>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Total Entries</span>
            <span className={styles.insightValue}>{insights.totalEntries}</span>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Positive</span>
            <span className={styles.insightValue}>{insights.positiveReactions}</span>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>To Avoid</span>
            <span className={styles.insightValue}>{insights.negativeReactions}</span>
          </div>
        </div>
      )}

      <div className={styles.entriesList}>
        <h3>Recent Entries</h3>
        {entries.slice(0, 5).map((entry) => (
          <div key={entry.id} className={styles.entryCard}>
            <div className={styles.entryHeader}>
              <div>
                <span className={styles.entryMeal}>{entry.mealName || 'Meal Entry'}</span>
                <span className={styles.entryDate}>
                  {new Date(entry.date).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.entryActions}>
                <button
                  className={styles.editButton}
                  onClick={() => handleEdit(entry)}
                  disabled={deletingId === entry.id}
                  title="Edit entry"
                >
                  Edit
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  title="Delete entry"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className={styles.entryDetails}>
              {entry.energyAfter && (
                <span className={styles.entryEnergy}>
                  Energy: {getEnergyLabel(entry.energyAfter)}
                </span>
              )}
              {entry.physicalFeelings && entry.physicalFeelings.length > 0 && (
                <span className={styles.entryFeelings}>
                  {entry.physicalFeelings.join(', ')}
                </span>
              )}
            </div>
            {entry.notes && (
              <p className={styles.entryNotes}>{entry.notes}</p>
            )}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button className={styles.addButton} onClick={onAddEntry}>
          Add Journal Entry
        </button>
      </div>
    </div>
  );
};

export default FoodJournalCard;
