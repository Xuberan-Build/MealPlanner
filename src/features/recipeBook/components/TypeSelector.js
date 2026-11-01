import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  // Options must be strings; tolerate diet-type objects ({ name }) so bad data can't crash the page.
  const optionNames = useMemo(
    () => (Array.isArray(options) ? options : [])
      .map((o) => (typeof o === 'string' ? o : o && typeof o.name === 'string' ? o.name : ''))
      .filter(Boolean),
    [options]
  );
  const [filteredOptions, setFilteredOptions] = useState(optionNames);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(normalizeValue(value));
  }, [value]);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = optionNames.filter(option =>
        option.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(optionNames);
    }
  }, [inputValue, optionNames]);

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
