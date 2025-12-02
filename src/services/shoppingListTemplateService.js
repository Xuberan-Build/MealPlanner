import { db, auth } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  increment,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Create a new shopping list template
 * @param {Object} template - {name, items: [{name, quantity, unit, category}]}
 * @returns {Promise<string>} Template ID
 */
export const createTemplate = async (template) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const templateRef = doc(collection(db, 'shoppingListTemplates'));

    const templateData = {
      userId,
      name: template.name,
      items: template.items || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      usageCount: 0
    };

    await setDoc(templateRef, templateData);
    console.log(`✅ Created template: ${template.name}`);

    return templateRef.id;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
};

/**
 * Get all templates for current user
 * @returns {Promise<Array>} Array of template objects with IDs
 */
export const getUserTemplates = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const templatesRef = collection(db, 'shoppingListTemplates');
    const q = query(
      templatesRef,
      where('userId', '==', userId),
      orderBy('usageCount', 'desc')
    );

    const snapshot = await getDocs(q);

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📋 Retrieved ${templates.length} templates`);
    return templates;
  } catch (error) {
    console.error('Error getting templates:', error);
    return [];
  }
};

/**
 * Load a template into active shopping list
 * @param {string} templateId - Template document ID
 * @returns {Promise<Object>} Template data
 */
export const loadTemplate = async (templateId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const templateRef = doc(db, 'shoppingListTemplates', templateId);
    const templateDoc = await getDoc(templateRef);

    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }

    const template = templateDoc.data();

    // Verify ownership
    if (template.userId !== userId) {
      throw new Error('Not authorized to access this template');
    }

    // Increment usage count
    await setDoc(templateRef, {
      usageCount: increment(1),
      lastUsed: serverTimestamp()
    }, { merge: true });

    console.log(`✅ Loaded template: ${template.name}`);
    return {
      id: templateDoc.id,
      ...template
    };
  } catch (error) {
    console.error('Error loading template:', error);
    throw error;
  }
};

/**
 * Update an existing template
 * @param {string} templateId - Template ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateTemplate = async (templateId, updates) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const templateRef = doc(db, 'shoppingListTemplates', templateId);
    const templateDoc = await getDoc(templateRef);

    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }

    if (templateDoc.data().userId !== userId) {
      throw new Error('Not authorized to update this template');
    }

    await setDoc(templateRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log(`✅ Updated template: ${templateId}`);
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
};

/**
 * Delete a template
 * @param {string} templateId - Template ID
 * @returns {Promise<void>}
 */
export const deleteTemplate = async (templateId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const templateRef = doc(db, 'shoppingListTemplates', templateId);
    const templateDoc = await getDoc(templateRef);

    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }

    if (templateDoc.data().userId !== userId) {
      throw new Error('Not authorized to delete this template');
    }

    await deleteDoc(templateRef);
    console.log(`✅ Deleted template: ${templateId}`);
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};
