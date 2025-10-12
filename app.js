// Advent Calendar App - Works without Firebase
const TZ = 'Europe/Oslo';

// Brukerhåndtering og leaderboard
let currentUser = null;
let leaderboard = [];

// Generer unik bruker-ID (6-sifret tall)
function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hent eller opprett bruker
function getCurrentUser() {
  const userId = localStorage.getItem('advent25_userId');
  const nickname = localStorage.getItem('advent25_nickname');
  
  if (userId && nickname) {
    return { id: userId, nickname: nickname };
  }
  return null;
}

// Lagre brukerdata
function saveUser(userId, nickname) {
  localStorage.setItem('advent25_userId', userId);
  localStorage.setItem('advent25_nickname', nickname);
  currentUser = { id: userId, nickname: nickname };
}

// Oppdater leaderboard (local version for now)
async function updateLeaderboard() {
  if (!currentUser) return;
  
  console.log('Leaderboard update (local mode):', {
    id: currentUser.id,
    nickname: currentUser.nickname,
    points: computeTotalPoints(),
    completedDays: Object.values(getDone()).filter(Boolean).length
  });
}

// Hent leaderboard (local version for now)
async function getLeaderboard() {
  console.log('Getting leaderboard (local mode)');
  return [];
}

/*
  IMAGES IN TASKS
  ----------------
  Add one or more images per task via the new optional `images` field:
  images: [
    { src: 'images/day1-1.jpg', alt: 'Nordlys over byen', caption: 'Ledetråd #1' },
    { src: 'images/day1-2.jpg', alt: 'Ishavskatedralen', caption: 'Ledetråd #2' }
  ]
  Absolute URLs, relative paths, or data URLs are supported. Alt is recommended.
*/

// 24 redigerbare oppgaver — nå med valgfrie bilder[]
const TASKS = [
  { day: 1,  title: 'Dag 1: Hvilken norsk by?',  html: '<p>Hvilken norsk by skal vi frem til her?</p>',  answers: ['Tromsø'], points: 4, hint: 'Også kalt nordens Paris',
    images: [
      { src: "images/day1.jpg", alt: "Nordlys over Tromsø", caption: "Ledetråd: Nordlys over byen" }
    ]
  },
  { day: 2,  title: 'Dag 2: Oppgave',  html: '<p>Oppgave 2 beskrivelse</p>',  answers: ['eksempel'], points: 2 },
  { day: 3,  title: 'Dag 3: Oppgave',  html: '<p>Oppgave 3 beskrivelse</p>',  answers: ['eksempel'], points: 3 },
  { day: 4,  title: 'Dag 4: Oppgave',  html: '<p>Oppgave 4 beskrivelse</p>',  answers: ['eksempel'], points: 4 },
  { day: 5,  title: 'Dag 5: Oppgave',  html: '<p>Oppgave 5 beskrivelse</p>',  answers: ['eksempel'], points: 5 },
  { day: 6,  title: 'Dag 6: Oppgave',  html: '<p>Oppgave 6 beskrivelse</p>',  answers: ['eksempel'], points: 6, hint: 'Også kalt nordens Paris' },
  { day: 7,  title: 'Dag 7: Oppgave',  html: '<p>Oppgave 7 beskrivelse</p>',  answers: ['eksempel'], points: 7 },
  { day: 8,  title: 'Dag 8: Oppgave',  html: '<p>Oppgave 8 beskrivelse</p>',  answers: ['eksempel'], points: 8 },
  { day: 9,  title: 'Dag 9: Oppgave',  html: '<p>Oppgave 9 beskrivelse</p>',  answers: ['eksempel'], points: 9 },
  { day: 10, title: 'Dag 10: Oppgave', html: '<p>Oppgave 10 beskrivelse</p>', answers: ['eksempel'], points: 10 },
  { day: 11, title: 'Dag 11: Oppgave', html: '<p>Oppgave 11 beskrivelse</p>', answers: ['eksempel'], points: 1 },
  { day: 12, title: 'Dag 12: Oppgave', html: '<p>Oppgave 12 beskrivelse</p>', answers: ['eksempel'], points: 2 },
  { day: 13, title: 'Dag 13: Oppgave', html: '<p>Oppgave 13 beskrivelse</p>', answers: ['eksempel'], points: 3 },
  { day: 14, title: 'Dag 14: Oppgave', html: '<p>Oppgave 14 beskrivelse</p>', answers: ['eksempel'], points: 4 },
  { day: 15, title: 'Dag 15: Oppgave', html: '<p>Oppgave 15 beskrivelse</p>', answers: ['eksempel'], points: 5 },
  { day: 16, title: 'Dag 16: Oppgave', html: '<p>Oppgave 16 beskrivelse</p>', answers: ['eksempel'], points: 6 },
  { day: 17, title: 'Dag 17: Oppgave', html: '<p>Oppgave 17 beskrivelse</p>', answers: ['eksempel'], points: 7 },
  { day: 18, title: 'Dag 18: Oppgave', html: '<p>Oppgave 18 beskrivelse</p>', answers: ['eksempel'], points: 8 },
  { day: 19, title: 'Dag 19: Oppgave', html: '<p>Oppgave 19 beskrivelse</p>', answers: ['eksempel'], points: 9 },
  { day: 20, title: 'Dag 20: Oppgave', html: '<p>Oppgave 20 beskrivelse</p>', answers: ['eksempel'], points: 10 },
  { day: 21, title: 'Dag 21: Oppgave', html: '<p>Oppgave 21 beskrivelse</p>', answers: ['eksempel'], points: 1 },
  { day: 22, title: 'Dag 22: Oppgave', html: '<p>Oppgave 22 beskrivelse</p>', answers: ['eksempel'], points: 2 },
  { day: 23, title: 'Dag 23: Oppgave', html: '<p>Oppgave 23 beskrivelse</p>', answers: ['eksempel'], points: 3 },
  { day: 24, title: 'Dag 24: Oppgave', html: '<p>Oppgave 24 beskrivelse</p>', answers: ['eksempel'], points: 4 }
];

// Persistence (2025) - nå med bruker-spesifikke nøkler
function getUserStorageKey(baseKey) {
  return currentUser ? `${baseKey}_${currentUser.id}` : baseKey;
}

const LS_DONE = 'advent25_done';
const LS_ANSWERS = 'advent25_useranswers';
const LS_HINTS = 'advent25_hintsused';

const getDone = () => { try { return JSON.parse(localStorage.getItem(getUserStorageKey(LS_DONE)) || '{}'); } catch { return {}; } };
const setDone = (m) => localStorage.setItem(getUserStorageKey(LS_DONE), JSON.stringify(m));
const getUserAnswers = () => { try { return JSON.parse(localStorage.getItem(getUserStorageKey(LS_ANSWERS)) || '{}'); } catch { return {}; } };
const setUserAnswers = (m) => localStorage.setItem(getUserStorageKey(LS_ANSWERS), JSON.stringify(m));
const getHints = () => { try { return JSON.parse(localStorage.getItem(getUserStorageKey(LS_HINTS)) || '{}'); } catch { return {}; } };
const setHints = (m) => localStorage.setItem(getUserStorageKey(LS_HINTS), JSON.stringify(m));

// Helpers
const norm = (s) => (s ?? '').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const isCorrect = (day, value) => {
  const t = TASKS.find(x => x.day === day);
  if (!t) return false;
  const expected = Array.isArray(t.answers) ? t.answers : [t.answers];
  const v = norm(value);
  return expected.some(ans => norm(ans) === v);
};
const getBasePoints = (day) => (TASKS.find(t => t.day === day)?.points ?? 0);
const isHintUsed = (day) => !!getHints()[day];
const getAwardPoints = (day) => isHintUsed(day) ? Math.round(getBasePoints(day) * 0.5) : getBasePoints(day);

// Elements
const grid = document.getElementById('grid');
const todayText = document.getElementById('todayText');
const dateInfo = document.getElementById('dateInfo');
const scoreLine = document.getElementById('scoreLine');
const mediaWrap = document.getElementById('taskMedia');

// Pre-calc max possible points for display
const MAX_POINTS = TASKS.reduce((s, t) => s + (t.points || 0), 0);

function computeTotalPoints() {
  const done = getDone();
  return Object.entries(done).reduce((sum, [k, v]) => v ? sum + getAwardPoints(Number(k)) : sum, 0);
}

function renderGrid() {
  const done = getDone();
  grid.innerHTML = '';
  TASKS.forEach(t => {
    const isDone = !!done[t.day];
    const a = document.createElement('a');
    a.href = `#/day/${t.day}`;
    a.className = `door unlocked ${isDone ? 'done' : ''}`;
    a.setAttribute('aria-label', `Dag ${t.day} ${isDone ? 'fullført' : 'åpen'}`);
        a.innerHTML = `
          <span class="badge">${isDone ? 'Fullført' : 'Åpen'}</span>
          ${isDone ? '<span class="check">✓</span>' : `<span class="num">${t.day}</span>`}
          <span class="pts">${getAwardPoints(t.day)} p${getAwardPoints(t.day) === 1 ? '' : ''}</span>
          <div class="ribbon"></div>
        `;
    grid.appendChild(a);
  });

  const total = computeTotalPoints();
  const userInfo = currentUser ? ` (${currentUser.nickname})` : '';
  scoreLine.textContent = `Totale poeng: ${total} / ${MAX_POINTS}${userInfo}`;
  todayText.textContent = 'Redigeringsmodus: alle dager er for øyeblikket åpne. Grønn = besvart riktig.';
  dateInfo.textContent = 'Alle dager låst opp for redigering (Europe/Oslo).';
}

// Router & task view
const views = { home: document.getElementById('home'), task: document.getElementById('task'), login: document.getElementById('login'), leaderboard: document.getElementById('leaderboard') };
const taskTitle = document.getElementById('taskTitle');
const taskBody = document.getElementById('taskBody');
const answerInput = document.getElementById('answerInput');
const checkBtn = document.getElementById('checkBtn');
const answerStatus = document.getElementById('answerStatus');
const prevLink = document.getElementById('prevLink');
const nextLink = document.getElementById('nextLink');
const hintCard = document.getElementById('hintCard');
const hintBtn = document.getElementById('hintBtn');
const hintText = document.getElementById('hintText');
const hintNote = document.getElementById('hintNote');

function show(view) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  if (views[view]) views[view].classList.add('active');
  if (view === 'home') document.title = 'Adventskalender 25';
}

function route() {
  // Always check for current user first
  currentUser = getCurrentUser();
  
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) { 
    if (!currentUser) {
      show('login');
      return;
    }
    show('home'); 
    renderGrid(); 
    return; 
  }
  const m = hash.match(/^day\/(\d{1,2})$/);
  if (m) { renderTask(Number(m[1])); return; }
  if (hash === 'leaderboard') { show('leaderboard'); renderLeaderboard(); return; }
  show('home'); renderGrid();
}

function renderTask(n) {
  const t = TASKS.find(x => x.day === n);
  if (!t) { location.hash = '#/'; return; }
  show('task');

  prevLink.href = `#/day/${Math.max(1, n - 1)}`;
  nextLink.href = `#/day/${Math.min(24, n + 1)}`;

  taskTitle.textContent = t.title;
  taskBody.innerHTML = `${t.html}<p><em>Verdi: ${getAwardPoints(n)} poeng${getAwardPoints(n) === 1 ? '' : ''}${isHintUsed(n) ? ' (hint brukt)' : ''}</em></p>`;
  document.title = `${t.title} • Adventskalender`;

  // Render images for the task (if any)
  mediaWrap.innerHTML = '';
  if (Array.isArray(t.images) && t.images.length) {
    const parts = t.images.map((im, i) => {
      const alt = (im.alt ?? `Oppgave bilde ${i+1}`).replace(/"/g,'&quot;');
      const cap = im.caption ? `<figcaption>${im.caption}</figcaption>` : '';
      // Display image directly without clickable link
      return `
        <figure>
          <img src="${im.src}" loading="lazy" alt="${alt}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xMjAgODBIMTgwVjEyMEgxMjBWODBaIiBmaWxsPSIjREVFMkU2Ii8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTA1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Qzc1N0QiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkltYWdlIG5vdCBmb3VuZDwvdGV4dD4KPC9zdmc+'; this.onerror=null;" />
          ${cap}
        </figure>
      `;
    });
    mediaWrap.innerHTML = parts.join('');
  }

  // Hint UI
  if (t.hint) {
    hintCard.style.display = '';
    const used = isHintUsed(n);
    hintText.style.display = used ? '' : 'none';
    hintText.textContent = used ? t.hint : '';
    hintBtn.style.display = used ? 'none' : '';
        hintNote.textContent = 'Å avsløre et hint halverer poengene for denne dagen (rundet til nærmeste hele tall).';
        hintBtn.onclick = () => {
          if (confirm('Avslør hintet? Dette vil halvere poengene for denne dagen.')) {
            const h = getHints();
            h[n] = true;
            setHints(h);
            renderTask(n);
            renderGrid();
            updateLeaderboard();
          }
        };
  } else {
    hintCard.style.display = 'none';
  }

  const answersMap = getUserAnswers();
  answerInput.value = answersMap[n] || '';
  if (answersMap[n] && isCorrect(n, answersMap[n])) {
    answerStatus.textContent = '✅ Riktig! Denne dagen er merket som fullført.';
    answerStatus.className = 'status ok';
  } else {
    answerStatus.textContent = 'Skriv inn svaret og trykk Sjekk (eller trykk Enter).';
    answerStatus.className = 'status';
  }

  checkBtn.onclick = () => tryCheck(n);
  answerInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); tryCheck(n); } };
}

function tryCheck(day) {
  const val = answerInput.value;
  const user = getUserAnswers();
  user[day] = val;
  setUserAnswers(user);

  const d = getDone();
  if (isCorrect(day, val)) {
    d[day] = true;
    setDone(d);
    answerStatus.textContent = `✅ Riktig! +${getAwardPoints(day)} poeng${getAwardPoints(day)===1?'':' '}.`;
    answerStatus.className = 'status ok';
    renderGrid();
    updateLeaderboard();
  } else {
    d[day] = false;
    setDone(d);
    answerStatus.textContent = '❌ Ikke helt riktig. Prøv igjen!';
    answerStatus.className = 'status no';
    renderGrid();
  }
}

// Login system
function showLogin() {
  const userId = document.getElementById('userIdInput').value.trim();
  const nickname = document.getElementById('nicknameInput').value.trim();
  
  if (!userId || !nickname) {
    alert('Vennligst fyll inn både bruker-ID og kallenavn.');
    return;
  }
  
  if (userId.length !== 6 || !/^\d+$/.test(userId)) {
    alert('Bruker-ID må være et 6-sifret tall.');
    return;
  }
  
  if (nickname.length < 2 || nickname.length > 20) {
    alert('Kallenavn må være mellom 2 og 20 tegn.');
    return;
  }
  
  saveUser(userId, nickname);
  location.hash = '#/';
  show('home');
  renderGrid();
}

function generateNewUser() {
  const newUserId = generateUserId();
  document.getElementById('userIdInput').value = newUserId;
  document.getElementById('nicknameInput').focus();
}

// Leaderboard
async function renderLeaderboard() {
  const leaderboardData = await getLeaderboard();
  const leaderboardList = document.getElementById('leaderboardList');
  
  if (!leaderboardList) return;
  
  leaderboardList.innerHTML = '';
  
  if (leaderboardData.length === 0) {
    leaderboardList.innerHTML = '<p style="text-align: center; color: var(--muted);">Ingen spillere ennå! (Firebase ikke tilkoblet)</p>';
    return;
  }
  
  leaderboardData.forEach((user, index) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-item';
    if (currentUser && user.id === currentUser.id) {
      li.classList.add('current-user');
    }
    
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    
    li.innerHTML = `
      <div class="rank">${medal} ${rank}</div>
      <div class="user-info">
        <div class="nickname">${user.nickname}</div>
        <div class="user-id">ID: ${user.id}</div>
      </div>
      <div class="stats">
        <div class="points">${user.points} p</div>
        <div class="completed">${user.completedDays}/24</div>
      </div>
    `;
    
    leaderboardList.appendChild(li);
  });
}

// Initialize
console.log('🎄 Adventskalender 2025 - Starting in local mode');
window.addEventListener('hashchange', route);
route();

// Snow
function makeSnow() {
  const c = document.getElementById('snow');
  const count = Math.min(80, Math.max(35, Math.floor(window.innerWidth / 24)));
  c.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'flake';
    s.textContent = '❄';
    const size = 10 + Math.random() * 12; // px
    const left = Math.random() * 100;
    const dur = 8 + Math.random() * 12; // seconds
    const delay = -Math.random() * dur;
    s.style.left = left + 'vw';
    s.style.fontSize = size + 'px';
    s.style.animationDuration = dur + 's';
    s.style.animationDelay = delay + 's';
    s.style.opacity = 0.6 + Math.random() * 0.4;
    c.appendChild(s);
  }
}
makeSnow();
window.addEventListener('resize', () => { clearTimeout(window.__snowTimer); window.__snowTimer = setTimeout(makeSnow, 150); });