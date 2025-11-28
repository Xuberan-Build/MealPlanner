import React, { useState, useEffect } from 'react';
import { getGoals, completeMilestone, completeGoal } from '../../../services/healthJourneyService';
import styles from './GoalsCard.module.css';

/**
 * GoalsCard Component
 *
 * Displays user's health goals and milestone progress
 */
const GoalsCard = ({ userId, onCreateGoal }) => {
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, completed, all

  useEffect(() => {
    loadGoals();
  }, [userId, filter]);

  const loadGoals = async () => {
    try {
      setIsLoading(true);
      const fetchedGoals = await getGoals(userId, filter);
      setGoals(fetchedGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteMilestone = async (goalId, milestoneId) => {
    try {
      await completeMilestone(userId, goalId, milestoneId);
      loadGoals(); // Reload to show updated state
    } catch (error) {
      console.error('Error completing milestone:', error);
    }
  };

  const handleCompleteGoal = async (goalId) => {
    try {
      await completeGoal(userId, goalId);
      loadGoals(); // Reload to show updated state
    } catch (error) {
      console.error('Error completing goal:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading goals...</p>
      </div>
    );
  }

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Goals & Milestones</h2>
        <button className={styles.addButton} onClick={onCreateGoal}>
          + New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎯</div>
          <h3>Set Your First Goal</h3>
          <p>Goals help you stay motivated and track your progress</p>
          <button className={styles.createButton} onClick={onCreateGoal}>
            Create Goal
          </button>
        </div>
      ) : (
        <>
          <div className={styles.filterTabs}>
            <button
              className={filter === 'active' ? styles.activeTab : styles.tab}
              onClick={() => setFilter('active')}
            >
              Active ({activeGoals.length})
            </button>
            <button
              className={filter === 'completed' ? styles.activeTab : styles.tab}
              onClick={() => setFilter('completed')}
            >
              Completed ({completedGoals.length})
            </button>
          </div>

          <div className={styles.goalsList}>
            {goals.map(goal => (
              <GoalItem
                key={goal.id}
                goal={goal}
                onCompleteMilestone={handleCompleteMilestone}
                onCompleteGoal={handleCompleteGoal}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * GoalItem Component
 *
 * Individual goal card with milestones
 */
const GoalItem = ({ goal, onCompleteMilestone, onCompleteGoal }) => {
  const milestones = goal.milestones || [];
  const completedMilestones = milestones.filter(m => m.achieved).length;
  const totalMilestones = milestones.length;
  const progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const isGoalCompleted = goal.status === 'completed';
  const setByCoach = goal.setBy === 'coach';

  return (
    <div className={`${styles.goalCard} ${isGoalCompleted ? styles.completedGoal : ''}`}>
      <div className={styles.goalHeader}>
        <div className={styles.goalTitle}>
          {isGoalCompleted && <span className={styles.completedBadge}>✓</span>}
          <h3>{goal.title}</h3>
        </div>
        {setByCoach && (
          <span className={styles.coachBadge}>
            👤 Coach Goal
          </span>
        )}
      </div>

      {goal.description && (
        <p className={styles.goalDescription}>{goal.description}</p>
      )}

      <div className={styles.goalStats}>
        {goal.startWeight && goal.targetWeight && (
          <div className={styles.weightGoal}>
            <span className={styles.statLabel}>Target:</span>
            <span className={styles.statValue}>
              {goal.startWeight} lbs → {goal.targetWeight} lbs
            </span>
          </div>
        )}
        {goal.deadline && (
          <div className={styles.deadline}>
            <span className={styles.statLabel}>Deadline:</span>
            <span className={styles.statValue}>
              {new Date(goal.deadline).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {goal.notes && (
        <div className={styles.coachNotes}>
          <strong>Coach Notes:</strong> {goal.notes}
        </div>
      )}

      {milestones.length > 0 && (
        <div className={styles.milestones}>
          <div className={styles.milestonesHeader}>
            <span className={styles.milestonesTitle}>
              Milestones ({completedMilestones}/{totalMilestones})
            </span>
            <span className={styles.milestonesProgress}>
              {Math.round(progress)}%
            </span>
          </div>

          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className={styles.milestonesList}>
            {milestones.map((milestone, index) => (
              <MilestoneItem
                key={milestone.id || index}
                milestone={milestone}
                goalId={goal.id}
                onComplete={onCompleteMilestone}
                disabled={isGoalCompleted}
              />
            ))}
          </div>
        </div>
      )}

      {!isGoalCompleted && completedMilestones === totalMilestones && totalMilestones > 0 && (
        <button
          className={styles.completeGoalButton}
          onClick={() => onCompleteGoal(goal.id)}
        >
          🎉 Mark Goal as Complete
        </button>
      )}
    </div>
  );
};

/**
 * MilestoneItem Component
 *
 * Individual milestone within a goal
 */
const MilestoneItem = ({ milestone, goalId, onComplete, disabled }) => {
  const isAchieved = milestone.achieved;

  return (
    <div className={`${styles.milestone} ${isAchieved ? styles.achievedMilestone : ''}`}>
      <button
        className={styles.milestoneCheckbox}
        onClick={() => !isAchieved && !disabled && onComplete(goalId, milestone.id)}
        disabled={isAchieved || disabled}
      >
        {isAchieved ? '✓' : '○'}
      </button>
      <div className={styles.milestoneContent}>
        <span className={styles.milestoneTarget}>
          {milestone.weight ? `${milestone.weight} lbs` : milestone.target}
        </span>
        {milestone.description && (
          <span className={styles.milestoneDescription}>{milestone.description}</span>
        )}
        {isAchieved && milestone.date && (
          <span className={styles.milestoneDate}>
            Achieved {new Date(milestone.date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default GoalsCard;
