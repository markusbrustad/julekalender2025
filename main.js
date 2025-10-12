// main.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut
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
//import { initializeAppCheck, ReCaptchaEnterpriseProvider } 
  //from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app-check.js";

//const appCheck = initializeAppCheck(app, {
  //provider: new ReCaptchaEnterpriseProvider("6LdtqecrAAAAAILyMpgNE_fvf7BJdd6ShTvH4_t5"),
  //isTokenAutoRefreshEnabled: true,
});

const app = initializeApp(firebaseConfig);

// (Optional) App Check – uncomment if enabled in Console
// const appCheck = initializeAppCheck(app, {
//   provider: new ReCaptchaEnterpriseProvider("YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY"),
//   isTokenAutoRefreshEnabled: true,
// });

const auth = getAuth(app);
const db = getFirestore(app);

// Ensure auth state persists on this device
await setPersistence(auth, browserLocalPersistence);

/* ------------------ Small DOM helpers ------------------ */
const $ = (id) => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const showView = (id) => {
  document.querySelectorAll(".view").forEach(v => v.style.display = "none");
  const el = $(id);
  if (el) el.style.display = "block";
};

/* ------------------ Username helpers ------------------ */
function normalizeUsername(u) { return (u || "").trim().toLowerCase(); }
function isUsernameValid(u) { return /^[a-zA-Z0-9_-]{3,20}$/.test(u); }
function synthEmailFromUsername(u) { return `${u}@advent.local`; } // synthetic only

/* ------------------ Session policy: 24h relogin ------------------ */
const DAY_MS = 24 * 60 * 60 * 1000;

function markJustLoggedIn() {
  try { localStorage.setItem("advent_last_login_ts", String(Date.now())); } catch {}
}

function needsReauth(user) {
  try {
    const last = user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : null;
    if (last && (Date.now() - last > DAY_MS)) return true;
  } catch {}
  const local = parseInt(localStorage.getItem("advent_last_login_ts") || "0", 10);
  return (Date.now() - local) > DAY_MS;
}

/* ------------------ Router ------------------ */
function handleRoute() {
  const hash = location.hash || "#/";

  // #/leaderboard
  if (hash.startsWith("#/leaderboard")) {
    showView("leaderboard");
    loadLeaderboard().catch(console.error);
    return;
  }

  // #/day/5 or #/task/12 (1-24)
  const m = hash.match(/^#\/(?:day|task)\/(\d{1,2})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    if (day >= 1 && day <= 24) {
      // Hook this into your actual task loading/rendering:
      // e.g., loadTask(day);
      const title = $("taskTitle");
      if (title) title.textContent = `Dag ${day}`;
      showView("task");
      return;
    }
  }

  // Home
  if (hash === "#/" || hash === "") {
    showView("home");
    return;
  }

  // Fallback -> home (not login)
  showView("home");
}

window.addEventListener("hashchange", handleRoute);
if (!location.hash) location.hash = "#/";

/* ------------------ Leaderboard ------------------ */
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

/* ------------------ Points helper ------------------ */
// Call after a correct answer: await addPointsForUser(points);
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

/* ------------------ Tabs (login/signup) ------------------ */
function showSignIn(){ $("signInForm").style.display="block"; $("signUpForm").style.display="none"; }
function showSignUp(){ $("signInForm").style.display="none"; $("signUpForm").style.display="block"; }
$("tabSignIn")?.addEventListener("click", showSignIn);
$("tabSignUp")?.addEventListener("click", showSignUp);

/* ------------------ Sign up (username + password, no email) ------------------ */
$("btnSignUp")?.addEventListener("click", async () => {
  const raw = $("signupUsername")?.value || "";
  const password = $("signupPassword")?.value || "";
  const errEl = $("signupError");

  const username = normalizeUsername(raw);
  if (!isUsernameValid(username)) { errEl.textContent = "Ugyldig brukernavn (3–20 tegn, bokstaver/tall/_/-)."; return; }
  if (!password || password.length < 6) { errEl.textContent = "Passord må ha minst 6 tegn."; return; }

  try {
    // Create auth user using synthetic email derived from username
    const email = synthEmailFromUsername(username);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Display name == username
    await updateProfile(user, { displayName: username });

    // Persist username mapping + profile
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
    location.hash = "#/";
    handleRoute();
    errEl.textContent = "";
    showSignIn();
  } catch (e) {
    if (e?.code === "auth/email-already-in-use") {
      errEl.textContent = "Brukernavnet er allerede i bruk.";
    } else if (e?.message) {
      errEl.textContent = e.message;
    } else {
      errEl.textContent = "Klarte ikke å opprette bruker.";
    }
  }
});

/* ------------------ Sign in (username + password) ------------------ */
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
    location.hash = location.hash || "#/";
    handleRoute();
    errEl.textContent = "";
  } catch (e) {
    errEl.textContent = "Feil brukernavn eller passord.";
  }
});

/* ------------------ Logout ------------------ */
$("btnLogout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setText("scoreLine", "Totale poeng: 0");
    showView("login");
    showSignIn();
    location.hash = "#/";
  } catch (e) {
    console.error("Logout feilet:", e);
  }
});

/* ------------------ Auth state -> UI & 24h rule ------------------ */
onAuthStateChanged(auth, async (user) => {
  // Toggle logout button
  const btn = $("btnLogout");
  if (btn) btn.style.display = user ? "inline-block" : "none";

  if (user) {
    // Enforce 24-hour re-auth
    if (needsReauth(user)) {
      await signOut(auth);
      showView("login");
      showSignIn();
      return;
    }
    // Signed in and fresh
    handleRoute();
  } else {
    // Not signed in
    showView("login");
    showSignIn();
  }
});

/* ------------------ Initial render ------------------ */
handleRoute();
