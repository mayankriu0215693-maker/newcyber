/**
 * MAA ENTERPRISES — CENTRALIZED AUTHENTICATION & ROLE ACCESS GUARD (js/auth.js)
 * Implements Firebase v10+ Modular Authentication and Firestore-backed Admin verification.
 * Prevents client-side security race conditions and updates navbar state across all pages.
 */

import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  doc, 
  getDoc,
  isFirebaseConfigured
} from "./firebase-config.js";
import { showToast } from "./app.js";

let currentUser = null;
let currentIsAdmin = false;
let authInitialized = false;
const authListeners = [];

/**
 * Check if the given authenticated user is an authorized administrator.
 * Verifies with Firestore collection "admins/{uid}"
 * @param {Object} user 
 * @returns {Promise<boolean>}
 */
export async function checkAdminRole(user) {
  if (!user || !user.uid) return false;

  // 1. If Firebase is configured, check Firestore "admins" collection
  if (isFirebaseConfigured && db) {
    try {
      const adminDocRef = doc(db, "admins", user.uid);
      const adminDocSnap = await getDoc(adminDocRef);
      if (adminDocSnap.exists()) {
        const data = adminDocSnap.data();
        if (data.active !== false) {
          return true;
        }
      }
    } catch (err) {
      console.warn("[Auth] Firestore admin document check notice:", err.message);
    }
  }

  // 2. Check local fallback admin session (for local development / staging verification)
  const localAdminSession = localStorage.getItem("maa_admin_session");
  if (localAdminSession) {
    try {
      const parsed = JSON.parse(localAdminSession);
      if (parsed && parsed.email === user.email && parsed.isAdmin === true) {
        return true;
      }
    } catch (e) {}
  }

  return false;
}

/**
 * Sign in Admin or Staff user with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user: Object, isAdmin: boolean, message: string}>}
 */
export async function loginAdminUser(email, password) {
  if (!email || !password) {
    throw new Error("Please provide both email address and password.");
  }

  const cleanEmail = email.trim().toLowerCase();

  // If Firebase is configured, authenticate via Firebase Modular Auth
  if (isFirebaseConfigured && auth) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;
      const isAdmin = await checkAdminRole(user);
      
      currentUser = user;
      currentIsAdmin = isAdmin;
      
      if (isAdmin) {
        localStorage.setItem("maa_admin_session", JSON.stringify({
          uid: user.uid,
          email: user.email,
          isAdmin: true,
          timestamp: Date.now()
        }));
      }

      return { success: true, user, isAdmin, message: "Authentication successful." };
    } catch (error) {
      let friendlyMessage = "Authentication failed. Please verify your credentials.";
      if (error.code === "auth/invalid-email") friendlyMessage = "The email address format is invalid.";
      else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        friendlyMessage = "Invalid email or password. Please try again.";
      } else if (error.code === "auth/too-many-requests") {
        friendlyMessage = "Access temporarily disabled due to multiple failed login attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        friendlyMessage = "Network connection issue. Please check your internet connection.";
      }
      throw new Error(friendlyMessage);
    }
  } else {
    // Local fallback for local development / testing
    if (cleanEmail === "admin@maaenterprises.com" && password.length >= 6) {
      const mockUser = {
        uid: "admin_local_uid_001",
        email: cleanEmail,
        displayName: "Center Admin (Rajesh Kumar)"
      };
      currentUser = mockUser;
      currentIsAdmin = true;
      localStorage.setItem("maa_admin_session", JSON.stringify({
        uid: mockUser.uid,
        email: mockUser.email,
        isAdmin: true,
        timestamp: Date.now()
      }));
      return { success: true, user: mockUser, isAdmin: true, message: "Local staff session started." };
    } else {
      throw new Error("Invalid credentials. (Note: When Firebase project credentials are configured, accounts are authenticated via Firebase Auth).");
    }
  }
}

/**
 * Log out current authenticated user
 */
export async function logoutUser() {
  try {
    if (auth) {
      await signOut(auth);
    }
  } catch (err) {
    console.warn("[Auth] Sign out warning:", err.message);
  }
  currentUser = null;
  currentIsAdmin = false;
  localStorage.removeItem("maa_admin_session");
  showToast("You have been logged out successfully.", "info");
  updateHeaderAuthUI(null, false);
  
  if (window.location.pathname.includes("admin.html")) {
    setTimeout(() => {
      window.location.href = "login.html";
    }, 500);
  }
}

/**
 * Send password reset email
 * @param {string} email 
 */
export async function resetAdminPassword(email) {
  if (!email) throw new Error("Please enter your registered email address.");
  if (isFirebaseConfigured && auth) {
    await sendPasswordResetEmail(auth, email.trim());
    return true;
  } else {
    throw new Error("Firebase Auth is not yet connected to a live project. Please contact technical support.");
  }
}

/**
 * Centralized Auth State Listener
 * Resolves auth state properly without race conditions
 * @param {Function} callback 
 */
export function initAuthListener(callback) {
  if (typeof callback === "function") {
    authListeners.push(callback);
  }

  if (auth && typeof onAuthStateChanged === "function") {
    onAuthStateChanged(auth, async (user) => {
      authInitialized = true;
      if (user) {
        currentUser = user;
        currentIsAdmin = await checkAdminRole(user);
      } else {
        const localSession = localStorage.getItem("maa_admin_session");
        if (localSession) {
          try {
            const parsed = JSON.parse(localSession);
            currentUser = { uid: parsed.uid, email: parsed.email };
            currentIsAdmin = parsed.isAdmin === true;
          } catch (e) {
            currentUser = null;
            currentIsAdmin = false;
          }
        } else {
          currentUser = null;
          currentIsAdmin = false;
        }
      }

      updateHeaderAuthUI(currentUser, currentIsAdmin);

      authListeners.forEach(fn => {
        try { fn(currentUser, currentIsAdmin); } catch (e) { console.error(e); }
      });
    });
  } else {
    authInitialized = true;
    const localSession = localStorage.getItem("maa_admin_session");
    if (localSession) {
      try {
        const parsed = JSON.parse(localSession);
        currentUser = { uid: parsed.uid, email: parsed.email };
        currentIsAdmin = parsed.isAdmin === true;
      } catch (e) {
        currentUser = null;
        currentIsAdmin = false;
      }
    }
    updateHeaderAuthUI(currentUser, currentIsAdmin);
    if (typeof callback === "function") {
      callback(currentUser, currentIsAdmin);
    }
  }
}

/**
 * Update Header Navigation Authentication State dynamically across all pages
 * @param {Object|null} user 
 * @param {boolean} isAdmin 
 */
export function updateHeaderAuthUI(user, isAdmin) {
  const adminBtns = document.querySelectorAll(".header-admin-btn, .mobile-admin-btn");
  adminBtns.forEach(btn => {
    if (user && isAdmin) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
        <span>Dashboard</span>
      `;
      btn.href = "admin.html";
      btn.classList.add("btn-admin-active");
    } else {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>Admin Portal</span>
      `;
      btn.href = "login.html";
      btn.classList.remove("btn-admin-active");
    }
  });
}

/**
 * Protected Page Guard for Admin Dashboard (admin.html)
 * Solves the authentication race condition by showing a loading screen
 * until Firebase Auth state is definitely resolved.
 * @param {Function} onAuthorizedCallback 
 */
export function requireAdminAuth(onAuthorizedCallback) {
  const loadingOverlay = document.getElementById("adminAuthLoading");
  const unauthorizedScreen = document.getElementById("adminUnauthorized");
  const dashboardContent = document.getElementById("adminDashboardContent");

  function renderState(authorized, user) {
    if (loadingOverlay) loadingOverlay.style.display = "none";
    
    if (authorized) {
      if (unauthorizedScreen) unauthorizedScreen.style.display = "none";
      if (dashboardContent) dashboardContent.style.display = "block";
      if (typeof onAuthorizedCallback === "function") {
        onAuthorizedCallback(user);
      }
    } else {
      if (dashboardContent) dashboardContent.style.display = "none";
      if (unauthorizedScreen) unauthorizedScreen.style.display = "flex";
    }
  }

  initAuthListener(async (user, isAdmin) => {
    if (user && isAdmin) {
      renderState(true, user);
    } else {
      renderState(false, null);
    }
  });
}
