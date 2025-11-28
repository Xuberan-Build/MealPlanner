import React, { useState } from 'react';
import { createGoal } from '../../../services/healthJourneyService';
import styles from './CreateGoalModal.module.css';

/**
 * CreateGoalModal Component
 *
 * Modal for creating new health goals with milestones
 */
const CreateGoalModal = ({ isOpen, onClose, onSuccess, userId, currentWeight }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startWeight: currentWeight || '',
    targetWeight: '',
    deadline: '',
    notes: ''
  });
  const [milestones, setMilestones] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Goal info, 2: Milestones

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateMilestones = () => {
    const { startWeight, targetWeight } = formData;

    if (!startWeight || !targetWeight) return;

    const start = parseFloat(startWeight);
    const target = parseFloat(targetWeight);
    const difference = Math.abs(start - target);

    // Create milestones every 5 lbs
    const milestoneInterval = 5;
    const numberOfMilestones = Math.floor(difference / milestoneInterval);

    if (numberOfMilestones === 0) return;

    const generatedMilestones = [];
    const isWeightLoss = start > target;

    for (let i = 1; i <= numberOfMilestones; i++) {
      const milestoneWeight = isWeightLoss
        ? start - (milestoneInterval * i)
        : start + (milestoneInterval * i);

      if ((isWeightLoss && milestoneWeight > target) || (!isWeightLoss && milestoneWeight < target)) {
        generatedMilestones.push({
          id: `milestone_${Date.now()}_${i}`,
          weight: milestoneWeight,
          target: `${milestoneWeight} lbs`,
          description: `Week ${i * 2}`,
          achieved: false
        });
      }
    }

    setMilestones(generatedMilestones);
  };

  const addCustomMilestone = () => {
    setMilestones(prev => [
      ...prev,
      {
        id: `milestone_${Date.now()}`,
        weight: '',
        target: '',
        description: '',
        achieved: false
      }
    ]);
  };

  const updateMilestone = (id, field, value) => {
    setMilestones(prev => prev.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const removeMilestone = (id) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Please enter a goal title');
      return;
    }

    if (formData.targetWeight && (!formData.startWeight || formData.startWeight <= 0)) {
      setError('Please enter your starting weight');
      return;
    }

    try {
      setIsSubmitting(true);

      const goalData = {
        ...formData,
        milestones: milestones.filter(m => m.weight || m.target)
      };

      await createGoal(userId, goalData);

      // Reset form
      setFormData({
        title: '',
        description: '',
        startWeight: currentWeight || '',
        targetWeight: '',
        deadline: '',
        notes: ''
      });
      setMilestones([]);
      setStep(1);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error creating goal:', err);
      setError('Failed to create goal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setStep(1);
      onClose();
    }
  };

  const goToMilestones = () => {
    if (!formData.title.trim()) {
      setError('Please enter a goal title');
      return;
    }
    setError(null);
    generateMilestones();
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Create New Goal</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className={styles.stepIndicator}>
          <div className={`${styles.stepDot} ${step >= 1 ? styles.activeStep : ''}`}>1</div>
          <div className={styles.stepLine} />
          <div className={`${styles.stepDot} ${step >= 2 ? styles.activeStep : ''}`}>2</div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {step === 1 && (
            <div className={styles.stepContent}>
              <div className={styles.formGroup}>
                <label htmlFor="title" className={styles.label}>
                  Goal Title <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Lose 20 lbs for summer"
                  className={styles.input}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description" className={styles.label}>
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="What do you want to achieve and why?"
                  rows="3"
                  className={styles.textarea}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="startWeight" className={styles.label}>
                    Starting Weight (lbs)
                  </label>
                  <input
                    type="number"
                    id="startWeight"
                    name="startWeight"
                    value={formData.startWeight}
                    onChange={handleInputChange}
                    placeholder="Current weight"
                    step="0.1"
                    min="0"
                    className={styles.input}
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="targetWeight" className={styles.label}>
                    Target Weight (lbs)
                  </label>
                  <input
                    type="number"
                    id="targetWeight"
                    name="targetWeight"
                    value={formData.targetWeight}
                    onChange={handleInputChange}
                    placeholder="Goal weight"
                    step="0.1"
                    min="0"
                    className={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="deadline" className={styles.label}>
                  Target Date (optional)
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className={styles.input}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="notes" className={styles.label}>
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any additional details or motivation..."
                  rows="2"
                  className={styles.textarea}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepContent}>
              <div className={styles.milestonesIntro}>
                <h3>Break it into milestones</h3>
                <p>Small wins keep you motivated along the way</p>
              </div>

              {milestones.length > 0 ? (
                <div className={styles.milestonesList}>
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id} className={styles.milestoneItem}>
                      <span className={styles.milestoneNumber}>{index + 1}</span>
                      <input
                        type="number"
                        value={milestone.weight}
                        onChange={(e) => updateMilestone(milestone.id, 'weight', e.target.value)}
                        placeholder="Weight"
                        step="0.1"
                        className={styles.milestoneInput}
                        disabled={isSubmitting}
                      />
                      <input
                        type="text"
                        value={milestone.description}
                        onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                        placeholder="Description (e.g., Week 2)"
                        className={styles.milestoneInput}
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className={styles.removeMilestone}
                        onClick={() => removeMilestone(milestone.id)}
                        disabled={isSubmitting}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.noMilestones}>
                  <p>No milestones yet. Add some to track your progress!</p>
                </div>
              )}

              <button
                type="button"
                className={styles.addMilestoneButton}
                onClick={addCustomMilestone}
                disabled={isSubmitting}
              >
                + Add Milestone
              </button>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            {step === 1 ? (
              <>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.nextButton}
                  onClick={goToMilestones}
                  disabled={isSubmitting}
                >
                  Next: Milestones →
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Goal'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGoalModal;
