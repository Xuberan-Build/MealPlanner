import React, { useState, useRef, useEffect } from 'react';
import styles from './TypeSelector.module.css';

const TypeSelector = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select or type...',
  label,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Normalize value - handle both string and array (for backwards compatibility)
  const normalizeValue = (val) => {
    if (!val) return '';
    if (Array.isArray(val)) {
      // If array, use first item or empty string
      return val.length > 0 ? val[0] : '';
    }
    return String(val);
  };
  const [inputValue, setInputValue] = useState(normalizeValue(value));
  const [filteredOptions, setFilteredOptions] = useState(options);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(normalizeValue(value));
  }, [value]);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [inputValue, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleOptionClick = (option) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const showDropdown = isOpen && (filteredOptions.length > 0 || inputValue.trim());

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={styles.input}
        />
        {showDropdown && (
          <ul className={styles.dropdown}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <li
                  key={index}
                  className={styles.option}
                  onClick={() => handleOptionClick(option)}
                >
                  {option}
                </li>
              ))
            ) : (
              <li className={styles.optionNew}>
                Create new: "{inputValue}"
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TypeSelector;
