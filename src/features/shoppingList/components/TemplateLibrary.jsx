import React, { useState, useEffect } from 'react';
import { FileText, Trash2, X } from 'lucide-react';
import { getUserTemplates, loadTemplate, deleteTemplate } from '../../../services/shoppingListTemplateService';
import styles from './TemplateLibrary.module.css';

const TemplateLibrary = ({ onLoadTemplate, onClose, onCreateNew }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const userTemplates = await getUserTemplates();
      setTemplates(userTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = async (templateId) => {
    try {
      const template = await loadTemplate(templateId);
      onLoadTemplate(template);
      onClose();
    } catch (error) {
      console.error('Error loading template:', error);
      alert('Failed to load template');
    }
  };

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!window.confirm(`Delete "${templateName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <h2>Shopping List Templates</h2>
        <button className={styles.closeButton} onClick={onClose}>
          <X size={24} />
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className={styles.empty}>
          <FileText size={48} className={styles.emptyIcon} />
          <h3>No Templates Yet</h3>
          <p>Create a shopping list and save it as a template to reuse later.</p>
          <button className={styles.createButton} onClick={onCreateNew}>
            Create First Template
          </button>
        </div>
      ) : (
        <div className={styles.templateList}>
          {templates.map(template => (
            <div
              key={template.id}
              className={`${styles.templateCard} ${selectedTemplate === template.id ? styles.selected : ''}`}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className={styles.templateHeader}>
                <FileText size={20} />
                <h3>{template.name}</h3>
              </div>

              <div className={styles.templateMeta}>
                <span>{template.items.length} items</span>
                {template.usageCount > 0 && (
                  <span>• Used {template.usageCount} times</span>
                )}
              </div>

              <div className={styles.templateActions}>
                <button
                  className={styles.loadButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadTemplate(template.id);
                  }}
                >
                  Load Template
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.id, template.name);
                  }}
                  title="Delete template"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateLibrary;
