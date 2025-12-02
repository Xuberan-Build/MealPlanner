import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { createTemplate } from '../../../services/shoppingListTemplateService';
import styles from './CreateTemplateModal.module.css';

const CreateTemplateModal = ({ currentItems, onClose, onTemplateSaved }) => {
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name');
      return;
    }

    if (currentItems.length === 0) {
      setError('Cannot save empty template');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const template = {
        name: templateName.trim(),
        items: currentItems.map(item => ({
          name: item.name,
          quantity: item.quantity || '',
          unit: item.unit || '',
          category: item.category || 'Other'
        }))
      };

      const templateId = await createTemplate(template);
      console.log('✅ Template saved:', templateId);

      if (onTemplateSaved) {
        onTemplateSaved(templateId);
      }

      onClose();
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <h2>Save as Template</h2>
        <button className={styles.closeButton} onClick={onClose}>
          <X size={24} />
        </button>
      </div>

      <div className={styles.content}>
        <p className={styles.description}>
          Save this shopping list as a reusable template.
          You'll be able to load it with one click in the future.
        </p>

        <div className={styles.formGroup}>
          <label htmlFor="templateName">Template Name</label>
          <input
            id="templateName"
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Weekly Staples, Dinner Party"
            className={styles.input}
            autoFocus
          />
        </div>

        <div className={styles.itemsPreview}>
          <p className={styles.previewLabel}>
            This template will include {currentItems.length} items:
          </p>
          <div className={styles.itemsList}>
            {currentItems.slice(0, 5).map((item, index) => (
              <div key={index} className={styles.item}>
                • {item.name}
              </div>
            ))}
            {currentItems.length > 5 && (
              <div className={styles.item}>
                ... and {currentItems.length - 5} more
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <div className={styles.actions}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplateModal;
