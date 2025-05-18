import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import Quill styles
import styles from './InstructionsField.module.css';

const InstructionsField = ({ value, onChange, disabled = false }) => {
  // Get the appropriate value for the editor
  // If we have rich text stored, use that, otherwise use the plain text
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
    // This removes HTML tags but preserves line breaks
    const plainText = content.replace(/<(.|\n)*?>/g, '')
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Pass both the rich text and plain text
    onChange('instructions', plainText, { richText: content });
  };

  return (
    <div className={styles.formField}>
      <label className={styles.label}>
        Instructions
        <span className={styles.required}>*</span>
      </label>
      
      <div className={styles.editorContainer}>
        <ReactQuill
          value={editorValue}
          onChange={handleEditorChange}
          modules={modules}
          formats={formats}
          placeholder="Enter recipe instructions..."
          className={styles.richTextEditor}
          readOnly={disabled}
        />
      </div>
      
      <p className={styles.helperText}>
        Use formatting tools to organize your instructions into steps
      </p>
    </div>
  );
};

export default InstructionsField;
