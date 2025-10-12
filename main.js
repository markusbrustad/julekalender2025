// main.js (ES module)

/* ------------------ Firebase imports ------------------ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";

// (Optional but recommended) App Check – enable in Firebase Console first.
// import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app-check.js";

import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/** 0) INIT **/
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLWIzECjP6-MQPHfSZo0bK8yeVMgRQAXY",
  authDomain: "julekalender-f3dcd.firebaseapp.com",
  projectId: "julekalender-f3dcd",
  storageBucket: "julekalender-f3dcd.firebasestorage.app",
  messagingSenderId: "601016214749",
  appId: "1:601016214749:web:0ef3a57589d12cde45e734",
  measurementId: "G-J5RF50Q048"
};
//ReCaptcha
//import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app-check.js";


//const appCheck = initializeAppCheck(app, {
//  provider: new ReCaptchaEnterpriseProvider("6LdtqecrAAAAAILyMpgNE_fvf7BJdd6ShTvH4_t5"),
//  isTokenAutoRefreshEnabled: true,
//});

/* ---------- Globals / helpers ---------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const showView = (id) => {
  // Use the same view system as app.js
  document.querySelectorAll(".view").forEach(v => v.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
};
const normalizeUsername = (u) => (u || "").trim().toLowerCase();
const isUsernameValid = (u) => /^[a-zA-Z0-9_-]{3,20}$/.test(u);
const synthEmailFromUsername = (u) => `${u}@advent.local`;
const markJustLoggedIn = () => { try { localStorage.setItem("advent_last_login_ts", String(Date.now())); } catch {} };
const needsReauth = (user) => {
  try {
    const last = user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : null;
    if (last && (Date.now() - last > DAY_MS)) return true;
  } catch {}
  const local = parseInt(localStorage.getItem("advent_last_login_ts") || "0", 10);
  return (Date.now() - local) > DAY_MS;
};

/* ---------- Router ---------- */
// Router functionality moved to app.js to avoid conflicts

/* ---------- Leaderboard ---------- */
async function loadLeaderboard() {
  const list = $("leaderboardList");
  if (!list) return;
  list.innerHTML = "";
  
  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  
  if (!auth || !db) {
    list.innerHTML = '<p style="text-align: center; color: var(--warn);">Firebase ikke initialisert ennå</p>';
    return;
  }
  
  try {
    const q = query(collection(db, "users"), orderBy("totalPoints", "desc"), limit(50));
    const snap = await getDocs(q);
    let rank = 1;
    
    snap.forEach(docSnap => {
      const u = docSnap.data();
      if (u.public !== false) {
        const li = document.createElement("li");
        li.className = "leaderboard-item";
        
        // Check if this is the current user
        if (window.firebaseUser && u.uid === window.firebaseUser.uid) {
          li.classList.add("current-user");
        }
        
        const name = u.username || "(ukjent)";
        const pts = Number.isFinite(u.totalPoints) ? u.totalPoints : 0;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        
        li.innerHTML = `
          <div class="rank">${medal} ${rank}</div>
          <div class="user-info">
            <div class="nickname">${name}</div>
            <div class="user-id">ID: ${u.uid ? u.uid.substring(0, 8) + '...' : 'N/A'}</div>
          </div>
          <div class="stats">
            <div class="points">${pts} p</div>
            <div class="completed">Firebase</div>
          </div>
        `;
        
        list.appendChild(li);
        rank++;
      }
    });
    
    if (rank === 1) {
      list.innerHTML = '<p style="text-align: center; color: var(--muted);">Ingen spillere ennå!</p>';
    }
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
    list.innerHTML = '<p style="text-align: center; color: var(--warn);">Feil ved lasting av leaderboard</p>';
  }
}

// Make loadLeaderboard globally accessible for app.js
window.loadLeaderboard = loadLeaderboard;

/* ---------- Public helper for scoring ---------- */
export async function addPointsForUser(points) {
  const user = auth.currentUser;
  if (!user) throw new Error("Ikke logget inn.");
  const ref = doc(db, "users", user.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Profil ikke funnet.");
    const data = snap.data();
    const curr = Number.isFinite(data.totalPoints) ? data.totalPoints : 0;
    tx.set(ref, { totalPoints: curr + points, lastSeenAt: serverTimestamp() }, { merge: true });
  });
  const line = $("scoreLine");
  if (line) {
    const m = /(\d+)/.exec(line.textContent || "");
    const curr = m ? parseInt(m[1], 10) : 0;
    line.textContent = `Totale poeng: ${curr + points}`;
  }
}

// Make addPointsForUser globally accessible for app.js
window.addPointsForUser = addPointsForUser;

// Function to update total points in Firebase
async function updateTotalPoints(totalPoints) {
  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  
  if (!auth || !db) {
    console.error('Firebase not initialized yet');
    return;
  }
  
  const user = auth.currentUser;
  if (!user) {
    console.error('No Firebase user found');
    return;
  }
  
  const ref = doc(db, "users", user.uid);
  
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      
      // If user document doesn't exist, create it
      if (!snap.exists()) {
        console.log('Creating new user document in Firebase');
        tx.set(ref, {
          uid: user.uid,
          username: user.displayName || 'Unknown',
          totalPoints: totalPoints,
          public: true,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp()
        });
      } else {
        // Update existing user
        tx.set(ref, { 
          totalPoints: totalPoints, 
          lastSeenAt: serverTimestamp() 
        }, { merge: true });
      }
    });
    
    console.log('Successfully updated Firebase with total points:', totalPoints);
  } catch (error) {
    console.error('Failed to update Firebase points:', error);
    throw error;
  }
}

// Make updateTotalPoints globally accessible for app.js
window.updateTotalPoints = updateTotalPoints;

/* ---------- Firebase instances (created after DOM ready) ---------- */
let app, auth, db;

// Initialize global Firebase user variable
window.firebaseUser = null;

// Make Firebase instances globally accessible
window.firebaseAuth = null;
window.firebaseDb = null;

/* ---------- Init on DOM ready ---------- */
window.addEventListener("DOMContentLoaded", () => {
  // Ensure overlays never block clicks (just in case CSS didn't load yet)
  const snow = $("snow");
  if (snow) snow.style.pointerEvents = "none";

  // Init Firebase
  app = initializeApp(firebaseConfig);

  // (Optional) App Check
  // initializeAppCheck(app, {
  //   provider: new ReCaptchaEnterpriseProvider("YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY"),
  //   isTokenAutoRefreshEnabled: true,
  // });

  auth = getAuth(app);
  db = getFirestore(app);
  
  // Make Firebase instances globally accessible
  window.firebaseAuth = auth;
  window.firebaseDb = db;

  // Persistence without top-level await
  setPersistence(auth, browserLocalPersistence).catch(console.error);

  // Tabs
  $("tabSignIn")?.addEventListener("click", () => {
    $("signInForm").style.display="block"; $("signUpForm").style.display="none";
  });
  $("tabSignUp")?.addEventListener("click", () => {
    $("signInForm").style.display="none"; $("signUpForm").style.display="block";
  });

  // Sign up
  $("btnSignUp")?.addEventListener("click", async () => {
    const raw = $("signupUsername")?.value || "";
    const password = $("signupPassword")?.value || "";
    const errEl = $("signupError");
    const username = normalizeUsername(raw);

    if (!isUsernameValid(username)) { errEl.textContent = "Ugyldig brukernavn (3–20 tegn, bokstaver/tall/_/-)."; return; }
    if (!password || password.length < 6) { errEl.textContent = "Passord må ha minst 6 tegn."; return; }

    try {
      const email = synthEmailFromUsername(username);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      await updateProfile(user, { displayName: username });

      const unameRef = doc(db, "usernames", username);
      const userRef = doc(db, "users", user.uid);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(unameRef);
        if (snap.exists() && snap.data().uid !== user.uid) {
          throw new Error("Brukernavnet er tatt. Velg et annet.");
        }
        tx.set(unameRef, { uid: user.uid, createdAt: serverTimestamp() }, { merge: true });
        tx.set(userRef, {
          uid: user.uid,
          username,
          totalPoints: 0,
          public: true,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp()
        }, { merge: true });
      });

      markJustLoggedIn();
      setText("scoreLine", "Totale poeng: 0");
      if (!location.hash) location.hash = "#/";
      if (window.route) window.route();
      errEl.textContent = "";
      // Switch default tab back to sign-in for next visit
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
    } catch (e) {
      if (e?.code === "auth/email-already-in-use") {
        errEl.textContent = "Brukernavnet er allerede i bruk.";
      } else {
        errEl.textContent = e?.message || "Klarte ikke å opprette bruker.";
      }
    }
  });

  // Sign in
  $("btnSignIn")?.addEventListener("click", async () => {
    const raw = ($("signinUsername")?.value || "").trim();
    const password = $("signinPassword")?.value || "";
    const errEl = $("loginError");
    const username = normalizeUsername(raw);

    if (!isUsernameValid(username)) { errEl.textContent = "Sjekk brukernavn."; return; }
    if (!password) { errEl.textContent = "Skriv inn passord."; return; }

    try {
      const email = synthEmailFromUsername(username);
      await signInWithEmailAndPassword(auth, email, password);
      markJustLoggedIn();
      setText("scoreLine", "Totale poeng: 0");
      if (!location.hash) location.hash = "#/";
      if (window.route) window.route();
      errEl.textContent = "";
    } catch {
      errEl.textContent = "Feil brukernavn eller passord.";
    }
  });

  // Logout
  $("btnLogout")?.addEventListener("click", async () => {
    try {
      await signOut(auth);
      setText("scoreLine", "Totale poeng: 0");
      showView("login");
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
      location.hash = "#/";
    } catch (e) {
      console.error("Logout feilet:", e);
    }
  });

  // Auth state + 24h rule
  onAuthStateChanged(auth, async (user) => {
    const btn = $("btnLogout");
    if (btn) btn.style.display = user ? "inline-block" : "none";

    // Set global Firebase user for app.js
    window.firebaseUser = user;

    if (user) {
      if (needsReauth(user)) {
        await signOut(auth);
        showView("login");
        $("signInForm").style.display="block"; $("signUpForm").style.display="none";
        return;
      }
      // Let app.js handle routing
      if (window.route) window.route();
    } else {
      showView("login");
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
    }
  });

  // Router wiring handled by app.js
  if (!location.hash) location.hash = "#/";
});

