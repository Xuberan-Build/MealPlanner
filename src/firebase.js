// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBF8fq60g6feJVajlBnQJEBRwkrlgIX8sc",
  authDomain: "meal-planner-v1-9be19.firebaseapp.com",
  databaseURL: "https://meal-planner-v1-9be19-default-rtdb.firebaseio.com",
  projectId: "meal-planner-v1-9be19",
  storageBucket: "meal-planner-v1-9be19.appspot.com",
  messagingSenderId: "560827460340",
  appId: "1:560827460340:web:7b88aad6136b89d5fa4ca1",
  measurementId: "G-FZTKHMBBCT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore and export it
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
