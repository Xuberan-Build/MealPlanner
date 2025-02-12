/**
 * Preprocesses an image for better OCR results
 * @param {File} imageFile - The original image file
 * @returns {Promise<Blob>} Processed image blob
 */
export async function preprocessImage(imageFile) {
    // Create a temporary image element
    const img = new Image();
    const imageUrl = URL.createObjectURL(imageFile);

    return new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas dimensions
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw and enhance image
        ctx.drawImage(img, 0, 0);

        // Apply image enhancements
        ctx.filter = 'contrast(1.2) brightness(1.1)';
        ctx.drawImage(img, 0, 0);

        // Clean up URL
        URL.revokeObjectURL(imageUrl);

        // Convert to blob
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Failed to load image for preprocessing'));
      };

      img.src = imageUrl;
    });
  }
