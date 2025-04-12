import React, { useState } from 'react';
import { processRecipeImage } from '../services/ocrService';

const OcrTester = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  // Add a log message
  const addLog = (message) => {
    setLogs(prevLogs => [...prevLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Handle file selection
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
      addLog(`File selected: ${file.name}`);
    }
  };

  // Process the selected image
  const handleProcessImage = async () => {
    if (!selectedFile) {
      setError('Please select an image file first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    
    try {
      addLog('Starting OCR processing...');
      
      // Process the image
      const recipe = await processRecipeImage(selectedFile);
      
      addLog('OCR processing completed successfully');
      setResult(recipe);
    } catch (err) {
      addLog(`Error: ${err.message}`);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>OCR Service Tester</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        <button 
          onClick={handleProcessImage} 
          disabled={!selectedFile || isProcessing}
          style={{ 
            marginLeft: '10px',
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedFile && !isProcessing ? 'pointer' : 'not-allowed'
          }}
        >
          {isProcessing ? 'Processing...' : 'Process Image'}
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Result display */}
      {result && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h2>Extracted Recipe</h2>
          <div style={{ marginBottom: '10px' }}>
            <strong>Title:</strong> {result.title}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Prep Time:</strong> {result.prepTime}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Cook Time:</strong> {result.cookTime}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Servings:</strong> {result.servings}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Ingredients:</strong>
            <ul>
              {Array.isArray(result.ingredients) ? 
                result.ingredients.map((ingredient, index) => (
                  <li key={index}>{ingredient}</li>
                )) : 
                <li>No ingredients found</li>
              }
            </ul>
          </div>
          <div>
            <strong>Instructions:</strong>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              fontFamily: 'inherit',
              backgroundColor: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px'
            }}>
              {result.instructions}
            </pre>
          </div>
        </div>
      )}
      
      {/* Logs display */}
      <div style={{ marginTop: '20px' }}>
        <h3>Processing Logs</h3>
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '10px', 
          borderRadius: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          fontFamily: 'monospace'
        }}>
          {logs.length > 0 ? 
            logs.map((log, index) => (
              <div key={index}>{log}</div>
            )) : 
            <div>No logs yet. Process an image to see logs.</div>
          }
        </div>
      </div>
    </div>
  );
};

export default OcrTester;