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

/* ---------- Small helpers ---------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const showView = (id) => {
  // Hard hide all, then show target (prevents hidden views covering the page)
  document.querySelectorAll(".view").forEach(v => { v.style.display = "none"; v.classList.remove("is-active"); });
  const el = $(id);
  if (el) { el.style.display = "block"; el.classList.add("is-active"); }
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
function handleRoute() {
  const hash = location.hash || "#/";

  if (hash.startsWith("#/leaderboard")) {
    showView("leaderboard");
    loadLeaderboard().catch(console.error);
    return;
  }

  const m = hash.match(/^#\/(?:day|task)\/(\d{1,2})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    if (day >= 1 && day <= 24) {
      const title = $("taskTitle");
      if (title) title.textContent = `Dag ${day}`;
      // TODO: loadTask(day) if you have per-day content to render
      showView("task");
      return;
    }
  }

  if (hash === "#/" || hash === "") {
    showView("home");
    return;
  }

  // Fallback to home (not login)
  showView("home");
}

/* ---------- Leaderboard ---------- */
async function loadLeaderboard() {
  const list = $("leaderboardList");
  if (!list) return;
  list.innerHTML = "";
  const q = query(collection(db, "users"), orderBy("totalPoints", "desc"), limit(50));
  const snap = await getDocs(q);
  let rank = 1;
  snap.forEach(docSnap => {
    const u = docSnap.data();
    if (u.public !== false) {
      const li = document.createElement("li");
      const name = u.username || "(ukjent)";
      const pts = Number.isFinite(u.totalPoints) ? u.totalPoints : 0;
      li.textContent = `${rank}. ${name} — ${pts} poeng`;
      list.appendChild(li);
      rank++;
    }
  });
}

/* ---------- Points helper ---------- */
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

/* ---------- Firebase instances ---------- */
let app, auth, db;

/* ---------- Init after DOM is ready ---------- */
window.addEventListener("DOMContentLoaded", () => {
  // Defensive: make sure decorative overlays never block clicks
  const snow = $("snow");
  if (snow) snow.style.pointerEvents = "none";

  // Init Firebase
  app = initializeApp(firebaseConfig);

  // Optional App Check (uncomment if enabled in Console)
  // initializeAppCheck(app, {
  //   provider: new ReCaptchaEnterpriseProvider("YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY"),
  //   isTokenAutoRefreshEnabled: true,
  // });

  auth = getAuth(app);
  db = getFirestore(app);

  // Persist login on this device (no top-level await)
  setPersistence(auth, browserLocalPersistence).catch(console.error);

  /* ----- Tabs (Logg inn / Registrer) ----- */
  $("tabSignIn")?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    $("signInForm").style.display="block"; $("signUpForm").style.display="none";
  });
  $("tabSignUp")?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    $("signInForm").style.display="none"; $("signUpForm").style.display="block";
  });

  /* ----- Sign up (username + password, no email) ----- */
  $("btnSignUp")?.addEventListener("click", async (e) => {
    e?.preventDefault?.();
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

      // Mark session start and flip to main immediately
      markJustLoggedIn();
      setText("scoreLine", "Totale poeng: 0");
      if (!location.hash) location.hash = "#/";
      showView("home");
      handleRoute();
      errEl.textContent = "";

      // Default back to sign-in tab for next time
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
    } catch (e2) {
      if (e2?.code === "auth/email-already-in-use") {
        errEl.textContent = "Brukernavnet er allerede i bruk.";
      } else {
        errEl.textContent = e2?.message || "Klarte ikke å opprette bruker.";
      }
    }
  });

  /* ----- Sign in (username + password) ----- */
  $("btnSignIn")?.addEventListener("click", async (e) => {
    e?.preventDefault?.();
    const raw = ($("signinUsername")?.value || "").trim();
    const password = $("signinPassword")?.value || "";
    const errEl = $("loginError");
    const username = normalizeUsername(raw);

    if (!isUsernameValid(username)) { errEl.textContent = "Sjekk brukernavn."; return; }
    if (!password) { errEl.textContent = "Skriv inn passord."; return; }

    try {
      const email = synthEmailFromUsername(username);
      await signInWithEmailAndPassword(auth, email, password);

      // Mark session start and flip to main immediately
      markJustLoggedIn();
      setText("scoreLine", "Totale poeng: 0");
      if (!location.hash) location.hash = "#/";
      showView("home");
      handleRoute();
      errEl.textContent = "";
    } catch {
      errEl.textContent = "Feil brukernavn eller passord.";
    }
  });

  /* ----- Logout ----- */
  $("btnLogout")?.addEventListener("click", async (e) => {
    e?.preventDefault?.();
    try {
      await signOut(auth);
      setText("scoreLine", "Totale poeng: 0");
      showView("login");
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
      location.hash = "#/";
    } catch (err) {
      console.error("Logout feilet:", err);
    }
  });

  /* ----- Auth state + 24h policy ----- */
  onAuthStateChanged(auth, async (user) => {
    const btn = $("btnLogout");
    if (btn) btn.style.display = user ? "inline-block" : "none";

    if (user) {
      // If first appearance and no local timestamp, set it
      if (!localStorage.getItem("advent_last_login_ts")) {
        markJustLoggedIn();
      }

      if (needsReauth(user)) {
        await signOut(auth);
        showView("login");
        $("signInForm").style.display="block"; $("signUpForm").style.display="none";
        return;
      }

      // Signed in and fresh → render current route
      showView("home");
      handleRoute();
    } else {
      showView("login");
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
    }
  });

  /* ----- Router wiring at startup ----- */
  window.addEventListener("hashchange", handleRoute);
  if (!location.hash) location.hash = "#/";
  handleRoute();
});
