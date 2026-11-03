// src/hooks/useIngredientDictionary.js
//
// Applies the shared ingredient dictionary for the whole app: the cached copy immediately
// (so lists built right away already use it), then a fresh copy once the user is signed in.

import { useEffect, useState } from 'react';
import {
  applyCachedIngredientDictionary,
  loadIngredientDictionary,
} from '../services/ingredientDictionaryService';

export function useIngredientDictionary(isAuthenticated) {
  // Lazy initializer: runs once, synchronously, on first render.
  useState(() => applyCachedIngredientDictionary());

  useEffect(() => {
    if (isAuthenticated) loadIngredientDictionary();
  }, [isAuthenticated]);
}

export default useIngredientDictionary;
