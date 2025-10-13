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

/* ---------- Small helpers ---------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const showView = (id) => {
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

/* ---------- SIMPLE CONTENT LAYER (placeholders so you can see it working) ---------- */
// If you have real tasks elsewhere (e.g., tasks.js), you can swap this out.
const TASKS = Array.from({ length: 24 }, (_, i) => {
  const d = i + 1;
  return {
    title: `Dag ${d}`,
    body: `Oppgave for dag ${d}. (Dette er en placeholder-tekst. Bytt ut med ekte innhold.)`,
    hint: `Hint for dag ${d} (valgfritt).`,
  };
});

/* Build the 24 day tiles into #grid */
function renderHomeGrid() {
  const grid = $("grid");
  if (!grid) return;

  // If an external grid renderer exists (from your old app.js), use that instead
  if (typeof window.renderGrid === "function") {
    window.renderGrid(); // your own implementation
    return;
  }

  grid.innerHTML = ""; // clear
  for (let day = 1; day <= 24; day++) {
    const a = document.createElement("a");
    a.href = `#/day/${day}`;
    a.className = "door";
    a.setAttribute("aria-label", `Åpne dag ${day}`);
    a.innerHTML = `
      <div class="door-inner">
        <div class="door-num">${day}</div>
        <div class="door-status">Åpen</div>
      </div>`;
    grid.appendChild(a);
  }
}

/* Fill the Task view for a given day */
function loadTask(day) {
  const t = TASKS[day - 1] || { title: `Dag ${day}`, body: "Ingen oppgave definert enda.", hint: "" };

  setText("taskTitle", t.title);
  const body = $("taskBody");
  if (body) body.innerHTML = `<p>${t.body}</p>`;

  // Optional media
  const media = $("taskMedia");
  if (media) media.innerHTML = "";

  // Hint UI
  const hintCard = $("hintCard");
  const hintBtn = $("hintBtn");
  const hintText = $("hintText");
  if (t.hint && hintCard && hintBtn && hintText) {
    hintCard.style.display = "block";
    hintText.style.display = "none";
    hintBtn.onclick = () => {
      hintText.textContent = t.hint;
      hintText.style.display = "block";
      // Your scoring: halve points here if you want
    };
  } else if (hintCard) {
    hintCard.style.display = "none";
  }

  // Answer area (leave your check logic in another module if you have it)
  setText("answerStatus", "Skriv inn svaret og trykk Sjekk (eller trykk Enter).");

  // Prev/Next links
  const prev = $("prevLink");
  const next = $("nextLink");
  if (prev) prev.href = day > 1 ? `#/day/${day - 1}` : "#/";
  if (next) next.href = day < 24 ? `#/day/${day + 1}` : "#/";
}

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
      loadTask(day);
      showView("task");
      return;
    }
  }

  if (hash === "#/" || hash === "") {
    showView("home");
    renderHomeGrid(); // <— make sure grid is built when home shows
    return;
  }

  // Fallback -> home
  showView("home");
  renderHomeGrid();
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

/* ---------- Points helper (exported) ---------- */
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
  // Make sure decorative overlays never block clicks
  const snow = $("snow"); if (snow) snow.style.pointerEvents = "none";

  // Init Firebase
  app = initializeApp(firebaseConfig);
  // Optional App Check
  // initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider("YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY"), isTokenAutoRefreshEnabled: true });

  auth = getAuth(app);
  db = getFirestore(app);

  // Persist login on this device
  setPersistence(auth, browserLocalPersistence).catch(console.error);

  // Tabs (login/signup)
  $("tabSignIn")?.addEventListener("click", (e) => { e?.preventDefault?.(); $("signInForm").style.display="block"; $("signUpForm").style.display="none"; });
  $("tabSignUp")?.addEventListener("click", (e) => { e?.preventDefault?.(); $("signInForm").style.display="none"; $("signUpForm").style.display="block"; });

  // Sign up
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
      const cred = await signUp(email, password, username);
      if (cred) afterAuthSuccess();
      errEl.textContent = "";
    } catch (e2) {
      if (e2?.code === "auth/email-already-in-use") errEl.textContent = "Brukernavnet er allerede i bruk.";
      else errEl.textContent = e2?.message || "Klarte ikke å opprette bruker.";
    }
  });

  // Sign in
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
      afterAuthSuccess();
      errEl.textContent = "";
    } catch {
      errEl.textContent = "Feil brukernavn eller passord.";
    }
  });

  // Logout
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

  // Auth state + 24h policy
  onAuthStateChanged(auth, async (user) => {
    const btn = $("btnLogout");
    if (btn) btn.style.display = user ? "inline-block" : "none";

    if (user) {
      if (!localStorage.getItem("advent_last_login_ts")) markJustLoggedIn();
      if (needsReauth(user)) {
        await signOut(auth);
        showView("login");
        $("signInForm").style.display="block"; $("signUpForm").style.display="none";
        return;
      }
      showView("home");
      renderHomeGrid();      // <— ensure grid is built on auth re-hydrate
      handleRoute();
    } else {
      showView("login");
      $("signInForm").style.display="block"; $("signUpForm").style.display="none";
    }
  });

  // Router wiring
  window.addEventListener("hashchange", handleRoute);
  if (!location.hash) location.hash = "#/";
  // Initial draw (unauth will show login; auth rehydrate will call renderHomeGrid)
  handleRoute();
});

/* ---------- helpers that need Firebase ---------- */
async function signUp(email, password, username) {
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
  return cred;
}

function afterAuthSuccess() {
  markJustLoggedIn();
  setText("scoreLine", "Totale poeng: 0");
  if (!location.hash) location.hash = "#/";
  showView("home");
  renderHomeGrid();   // <— grid right away
  handleRoute();
}

