import React, { useState } from 'react';
import LazyReactQuill from './LazyReactQuill';
import 'react-quill/dist/quill.snow.css';
import instructionsFormatterService from '../../../../../services/instructionsFormatterService';
import styles from './InstructionsField.module.css';

const InstructionsField = ({ value, onChange, disabled = false }) => {
  const [isFormatting, setIsFormatting] = useState(false);
  
  // Get the appropriate value for the editor
  const editorValue = value.instructionsRichText || value.instructions || value || '';
  
  // Format configuration for the rich text editor
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['clean'] // Remove formatting button
    ],
  };
  
  // Define formats that will be allowed
  const formats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet'
  ];

  // Handle editor content change
  const handleEditorChange = (content) => {
    // Convert HTML to plain text for storage compatibility
    const plainText = content.replace(/<(.|\n)*?>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Pass both the rich text and plain text
    onChange('instructions', plainText, { richText: content });
  };

  // AI-powered smart formatting
  const handleSmartFormat = async () => {
    const textValue = typeof editorValue === 'string' ? editorValue : (editorValue?.instructions || '');
if (!textValue.trim()) return;
    
    setIsFormatting(true);
    
    try {
      // Get plain text version for AI processing
      const plainText = textValue.replace(/<(.|\n)*?>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Format using AI
      const formattedHtml = await instructionsFormatterService.formatInstructions(plainText);
      
      if (formattedHtml) {
        // Update with AI-formatted content
        const newPlainText = instructionsFormatterService.htmlToPlainText(formattedHtml);
        onChange('instructions', newPlainText, { richText: formattedHtml });
      }
    } catch (error) {
      console.error('Error formatting instructions:', error);
      // Show user-friendly error message
      alert('Unable to format instructions automatically. Please format manually.');
    } finally {
      setIsFormatting(false);
    }
  };

  return (
    <div className={styles.formField}>
      <div className={styles.labelContainer}>
        <label className={styles.label}>
          Instructions
        </label>
        
        <button
          type="button"
          onClick={handleSmartFormat}
          disabled={disabled || isFormatting || !(typeof editorValue === 'string' ? editorValue : (editorValue?.instructions || '')).trim()}
          className={styles.formatButton}
        >
          {isFormatting ? (
            <>
              <span className={styles.spinner}></span>
              Formatting...
            </>
          ) : (
            <>
              ✨ Smart Format
            </>
          )}
        </button>
      </div>
      
      <div className={styles.editorContainer}>
        <LazyReactQuill
          value={editorValue}
          onChange={handleEditorChange}
          modules={modules}
          formats={formats}
          placeholder="Enter recipe instructions... Use the Smart Format button to automatically organize steps and highlight key details."
          className={styles.richTextEditor}
          readOnly={disabled}
        />
      </div>
      
      <p className={styles.helperText}>
        Type your instructions and use <strong>Smart Format</strong> to automatically organize steps, bold temperatures and times, and improve readability.
      </p>
    </div>
  );
};

export default InstructionsField; 