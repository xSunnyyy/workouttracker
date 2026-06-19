// =========================================
// Firebase wiring — Auth (Google) + Firestore sync.
// Loaded as an ES module from the gstatic CDN — no build step.
// Exposes window.CloudSync for the rest of the app to call.
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged, browserPopupRedirectResolver,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, getDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1qvjXjkOY6Pm-FQhIT7qlxdyN53aFvIk",
  authDomain: "workouttracker-13f43.firebaseapp.com",
  projectId: "workouttracker-13f43",
  storageBucket: "workouttracker-13f43.firebasestorage.app",
  messagingSenderId: "554382322726",
  appId: "1:554382322726:web:5e5d34ab7b75b218670ae7",
  measurementId: "G-GS4KW3TBTK",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// ----- internal state
let currentUser = null;
let authResolved = false;
let unsubscribeSnapshot = null;
const listeners = { auth: [], cloud: [] };

// ----- helpers
function notifyAuth() {
  listeners.auth.forEach((cb) => { try { cb(currentUser); } catch (e) { console.error(e); } });
}
function notifyCloud(state) {
  listeners.cloud.forEach((cb) => { try { cb(state); } catch (e) { console.error(e); } });
}
function userDocRef(uid) {
  // users/{uid}/state/main — matches the security rule users/{uid}/{document=**}
  return doc(db, 'users', uid, 'state', 'main');
}

// Strip values Firestore can't store (undefined, functions).
function sanitize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize).filter((v) => v !== undefined);
  const out = {};
  Object.entries(value).forEach(([k, v]) => {
    if (v === undefined) return;
    if (typeof v === 'function') return;
    out[k] = sanitize(v);
  });
  return out;
}

// ----- public API
window.CloudSync = {
  ready: false,
  isAuthed() { return !!currentUser; },
  user() { return currentUser; },

  onAuth(cb) {
    listeners.auth.push(cb);
    if (authResolved) cb(currentUser);
  },
  onCloudUpdate(cb) {
    listeners.cloud.push(cb);
  },

  async signIn() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (err) {
      // Popups often fail inside installed PWAs / iOS Safari — fall back to redirect.
      const fallback = ['auth/popup-blocked', 'auth/popup-closed-by-user',
                        'auth/cancelled-popup-request',
                        'auth/operation-not-supported-in-this-environment'];
      if (fallback.includes(err.code)) {
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  },

  async signOut() {
    await signOut(auth);
  },

  async pull() {
    if (!currentUser) return null;
    const snap = await getDoc(userDocRef(currentUser.uid));
    return snap.exists() ? snap.data() : null;
  },

  async push(state) {
    if (!currentUser) return;
    const payload = sanitize(state);
    payload.updatedAt = serverTimestamp();
    await setDoc(userDocRef(currentUser.uid), payload);
  },
};

// Handle the redirect-back path on mobile / PWA
getRedirectResult(auth).catch((err) => console.warn('Redirect result error:', err));

// Subscribe to auth changes; (re)wire the Firestore listener accordingly.
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authResolved = true;
  window.CloudSync.ready = true;

  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  if (user) {
    unsubscribeSnapshot = onSnapshot(userDocRef(user.uid), (snap) => {
      // Ignore our own pending writes — they'll come back, but our local state
      // already reflects them so re-applying would just cause unnecessary repaints.
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists()) notifyCloud(snap.data());
    }, (err) => {
      console.warn('Cloud sync listener error:', err);
    });
  }

  notifyAuth();
});
