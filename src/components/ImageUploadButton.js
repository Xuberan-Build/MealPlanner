import React, { useRef, useState } from 'react';
import { uploadRecipeImage, validateImageFile, getRecipeImagePath } from '../services/storageService';

const ImageUploadButton = ({ recipeId, onUploadSuccess, onUploadError }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      validateImageFile(file);

      const imagePath = getRecipeImagePath(recipeId);
      const { url } = await uploadRecipeImage(file, imagePath);
      onUploadSuccess?.({ url, path: imagePath });
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={isUploading}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Uploading...
          </span>
        ) : (
          'Upload Recipe Image'
        )}
      </button>
    </div>
  );
};

export default ImageUploadButton;
