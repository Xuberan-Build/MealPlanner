import React from 'react';
import { exportRecipesToCSV, importRecipesFromCSV } from '../../../../services/csvService'; // Import CSV services

const CsvImportExport = ({ onImportComplete }) => {
  // Function to export recipes to CSV
  const handleExport = async () => {
    try {
      await exportRecipesToCSV(); // Call the export function from the service
      console.log('Recipes exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    }
  };

  // Function to handle file input for CSV import
  const handleImport = async (event) => {
    const file = event.target.files[0]; // Get the uploaded CSV file
    if (!file) return;

    try {
      const importedRecipes = await importRecipesFromCSV(file); // Call the import function
      onImportComplete(importedRecipes); // Notify the parent component about the import
      alert('Recipes imported successfully');
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Failed to import CSV');
    }
  };

  return (
    <div className="csv-button-container">
      <button onClick={handleExport} className="csv-button">
        Export CSV
      </button>

      {/* Input for file upload */}
      <input
        type="file"
        accept=".csv"
        onChange={handleImport}
        style={{ display: 'none' }} // Hide the file input visually
        id="csv-upload"
      />
      <label htmlFor="csv-upload" className="csv-button">
        Import CSV
      </label>
    </div>
  );
};

export default CsvImportExport;
