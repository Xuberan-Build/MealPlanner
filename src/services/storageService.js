import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

export function getRecipeImagePath(recipeId, type = 'original') {
    return `recipe-images/${recipeId}/${type}_${uuidv4()}`;
  }

export async function uploadRecipeImage(file, recipeId) {
  try {
    const filename = `${uuidv4()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const imagePath = `recipe-images/${recipeId}/${filename}`;
    const storageRef = ref(storage, imagePath);

    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return {
      original: downloadURL,
      path: imagePath
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
}

export async function deleteRecipeImage(imagePath) {
  try {
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image');
  }
}

export function validateImageFile(file) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Please upload a JPEG, PNG, or WebP image.');
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Please upload an image smaller than 5MB.');
  }

  return true;
}
