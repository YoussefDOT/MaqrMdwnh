// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, get, onDisconnect, set, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUxJmhqzUuhRWS5jL-87IRzhBvzDc5OHQ",
  authDomain: "mdwnh-digital-s.firebaseapp.com",
  databaseURL: "https://mdwnh-digital-s-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mdwnh-digital-s",
  storageBucket: "mdwnh-digital-s.firebasestorage.app",
  messagingSenderId: "581682259149",
  appId: "1:581682259149:web:95498ed08d5f6ca01b3584",
  measurementId: "G-00F3S4CJZ6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const auth = getAuth(app);
export const authReady = signInAnonymously(auth).catch(() => {});

// ── Secondary app: the POINTS database (a separate Firebase project) ────────────
// Read-only from here, and read ONLY on demand (one `get('players')` when the
// fireplace view opens — never a live listener). It's a different project, so it
// needs its own named app instance; `getDatabase(app)` would hit the main DB.
const pointsApp = initializeApp({
    apiKey: "AIzaSyDVNQ5Nh8JpaOZIb6bhou6x2JAvjn8Ik4U",
    authDomain: "mdwnhpoints.firebaseapp.com",
    databaseURL: "https://mdwnhpoints-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mdwnhpoints",
    storageBucket: "mdwnhpoints.firebasestorage.app",
    messagingSenderId: "225704093916",
    appId: "1:225704093916:web:a1455885c84101b6b02c19"
}, 'points');
const pointsDatabase = getDatabase(pointsApp);

export { database, pointsDatabase, ref, onValue, update, get, onDisconnect, set, remove, runTransaction };
