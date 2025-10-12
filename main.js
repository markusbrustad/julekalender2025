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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** Helpers **/
const $ = (id) => document.getElementById(id);
const showView = (id) => {
  document.querySelectorAll(".view").forEach(v => v.style.display = "none");
  const el = $(id);
  if (el) el.style.display = "block";
};
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };

function normalizeUsername(u) { return u.trim().toLowerCase(); }
function isUsernameValid(u) { return /^[a-zA-Z0-9_-]{3,20}$/.test(u); }
function synthEmailFromUsername(u) { return `${u}@advent.local`; } // synthetic only

// === Logout button ===
const logoutBtn = document.getElementById("btnLogout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      console.log("Bruker logget ut");
      // Hide button immediately
      logoutBtn.style.display = "none";
      // Reset view
      setText("scoreLine", "Totale poeng: 0");
      showView("login");
      showSignIn();
      location.hash = "#/login";
    } catch (err) {
      console.error("Logout feilet:", err);
    }
  });
}



/** Tabs **/
function showSignIn(){ $("signInForm").style.display="block"; $("signUpForm").style.display="none"; }
function showSignUp(){ $("signInForm").style.display="none"; $("signUpForm").style.display="block"; }
$("tabSignIn")?.addEventListener("click", showSignIn);
$("tabSignUp")?.addEventListener("click", showSignUp);

/** SIGN UP **/
$("btnSignUp")?.addEventListener("click", async () => {
  const raw = $("signupUsername")?.value || "";
  const password = $("signupPassword")?.value || "";
  const errEl = $("signupError");

  const username = normalizeUsername(raw);
  if (!isUsernameValid(username)) { errEl.textContent = "Ugyldig brukernavn (3–20 tegn, bokstaver/tall/_/-)."; return; }
  if (!password || password.length < 6) { errEl.textContent = "Passord må ha minst 6 tegn."; return; }

  try {
    // Try creating an auth user with a synthetic email derived from the username.
    // If it already exists, Firebase will return "email-already-in-use" => username taken.
    const email = synthEmailFromUsername(username);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Display name == username
    await updateProfile(user, { displayName: username });

    // Write username mapping and profile
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

    setText("scoreLine", "Totale poeng: 0");
    showView("home");
    location.hash = "#/";
    errEl.textContent = "";
    showSignIn(); // next time default to Logg inn
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

/** SIGN IN (username only) **/
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
    setText("scoreLine", "Totale poeng: 0");
    showView("home");
    location.hash = "#/";
    errEl.textContent = "";
  } catch (e) {
    errEl.textContent = "Feil brukernavn eller passord.";
  }
});

/** Leaderboard **/
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

/** Award points (by current user) **/
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

/** Routing **/
onAuthStateChanged(auth, (user) => {
  const btn = document.getElementById("btnLogout");
  if (btn) btn.style.display = user ? "inline-block" : "none";

  if (user) {
    showView("home");
  } else {
    showView("login");
    showSignIn();
  }
});


window.addEventListener("hashchange", () => {
  const hash = location.hash || "#/";
  if (hash.startsWith("#/leaderboard")) {
    showView("leaderboard");
    loadLeaderboard().catch(console.error);
  } else if (hash === "#/" || hash === "") {
    showView("home");
  } else {
    showView("login");
  }
});
if (!location.hash) location.hash = "#/";
if (location.hash.startsWith("#/leaderboard")) {
  showView("leaderboard");
  loadLeaderboard().catch(console.error);
} else if (location.hash === "#/") {
  showView("home");
} else {
  showView("login");
}
