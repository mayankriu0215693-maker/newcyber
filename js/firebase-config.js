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
  apiKey: "AIzaSyA7NwBPiIbB4rbQVo83yJIxq0O2q58FnOw",
  authDomain: "maa-enterprises-new.firebaseapp.com",
  projectId: "maa-enterprises-new",
  storageBucket: "maa-enterprises-new.firebasestorage.app",
  messagingSenderId: "166006975603",
  appId: "1:166006975603:web:e9dd8c9ddd40011374ce06",
  measurementId: "G-SDBFZR8VMF"
};
let app = null;
let auth = null;
let db = null;
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
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('Placeholder')) {
    isFirebaseConfigured = true;
  }
} catch (error) {
  console.warn("[Maa Enterprises] Firebase initialization notice (Operating in resilient offline/hybrid mode):", error.message);
}

// Attach to global window.FirebaseApp for unified access across all scripts
if (typeof window !== 'undefined') {
  window.FirebaseApp = {
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
