/**
 * MAA ENTERPRISES — FIREBASE MODULAR SDK CONFIGURATION (v10.8.0)
 * Production-ready configuration using official Firebase CDN ES Modules.
 * 
 * Instructions:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Create or select your project: 'maa-enterprises-portal'
 * 3. Add a Web App and copy your credentials into the 'firebaseConfig' object below.
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Client configuration (Safe to include in frontend client build)
// Replace placeholders with your Firebase project credentials from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyPlaceholder_MaaEnterprises_APIKey",
  authDomain: "maa-enterprises-portal.firebaseapp.com",
  projectId: "maa-enterprises-portal",
  storageBucket: "maa-enterprises-portal.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

let app;
let auth;
let db;
let isFirebaseConfigured = false;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Check if real config or placeholder
  if (!firebaseConfig.apiKey.includes('Placeholder')) {
    isFirebaseConfigured = true;
  }
} catch (error) {
  console.warn("[Maa Enterprises] Firebase initialization notice (Operating in resilient offline/hybrid mode):", error.message);
}

// Export modular instances and SDK methods
export {
  app,
  auth,
  db,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
};
