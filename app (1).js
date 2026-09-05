/* ============================================================
   TeenHQ — app.js
   Single-page app: hash router + data-driven content + tools.
   Adding more advice/prompts/challenges/compliments/study
   items = edit data.js only. No changes needed here.
   ============================================================ */


/* ---------------- storage helpers ---------------- */
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
};

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function niceDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem('teenhq-theme');
  const theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('teenhq-theme', next); } catch(e){}
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

/* ---------------- router ---------------- */
const ROUTES = [
  { test: h => h === '' || h === 'advice', render: renderAdviceHome },
  { test: h => h.startsWith('advice/'), render: h => renderAdviceDetail(h.slice('advice/'.length)) },
  { test: h => h === 'mood', render: renderMood },
  { test: h => h === 'journal', render: renderJournal },
  { test: h => h === 'water', render: renderWater },
  { test: h => h === 'sleep', render: renderSleep },
  { test: h => h === 'study', render: renderStudy },
  { test: h => h === 'habits', render: renderHabits },
  { test: h => h === 'goals', render: renderGoals },
  { test: h => h === 'budget', render: renderBudget },
  { test: h => h === 'fun', render: renderFunHub },
  { test: h => h === 'fun/compliments', render: () => renderSparkDeck('compliments') },
  { test: h => h === 'fun/prompts', render: () => renderSparkDeck('prompts') },
  { test: h => h === 'fun/challenges', render: () => renderSparkDeck('challenges') },
];

function currentHash() {
  return (location.hash || '').replace(/^#\/?/, '');
}
function nav(path) {
  location.hash = '#/' + path;
}
function router() {
  const h = currentHash();
  const match = ROUTES.find(r => r.test(h)) || ROUTES[0];
  match.render(h);
  updateActiveNav(h);
  closeMenus();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);

function updateActiveNav(h) {
  const section = h.split('/')[0] || 'advice';
  document.querySelectorAll('.nav-link[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });
}

const app = () => document.getElementById('app');

/* ---------------- header: explore dropdown + mobile menu ---------------- */
function toggleExplore(e) {
  e && e.stopPropagation();
  document.getElementById('explore-panel').classList.toggle('open');
}
function closeMenus() {
  const panel = document.getElementById('explore-panel');
  if (panel) panel.classList.remove('open');
  const mm = document.getElementById('mobile-menu');
  if (mm) mm.classList.remove('open');
}
document.addEventListener('click', (e) => {
  const panel = document.getElementById('explore-panel');
  const btn = document.getElementById('explore-btn');
  if (panel && panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn) {
    panel.classList.remove('open');
  }
});
function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
}

/* ============================================================
   ADVICE — library (filters, search, detail, journal-per-article)
   ============================================================ */
const ADVICE = TEENHQ_DATA.advice;
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'school', label: 'School' },
  { key: 'friends', label: 'Friends' },
  { key: 'dating', label: 'Dating' },
  { key: 'family', label: 'Family' },
  { key: 'growing-up', label: 'Growing Up' },
];
const CAT_COUNTS = {};
ADVICE.forEach(a => { CAT_COUNTS[a.category] = (CAT_COUNTS[a.category]||0)+1; });
CAT_COUNTS.all = ADVICE.length;

let adviceState = { cat: 'all', search: '' };

function catVar(cat){ return cat === 'growing-up' ? 'growing' : cat; }
function hookFor(article){
  const line = article.body.find(l => l.trim().length > 25) || article.body[0] || '';
  return line.length > 118 ? line.slice(0,115).trim() + '…' : line;
}
function matchesSearch(a, term){
  if(!term) return { hit: true, score: 0 };
  const t = term.toLowerCase();
  const title = a.title.toLowerCase();
  if (title.includes(t)) return { hit: true, score: title.startsWith(t) ? 2 : 1 };
  const hay = (a.body.join(' ') + ' ' + a.journal).toLowerCase();
  return { hit: hay.includes(t), score: 0 };
}

function renderAdviceHome() {
  adviceState = { cat: adviceState.cat || 'all', search: '' };
  app().innerHTML = `
    <div class="wrap">
      <section class="page-hero">
        <p class="page-eyebrow" id="hero-count">${ADVICE.length} things nobody sat you down and explained</p>
        <h1>life's a lot right now. let's talk about it.</h1>
        <p class="lede">Pick what's going on — school, friends, dating, family, or just growing up in general — and get the honest, big-sister version. No lectures. No "when I was your age."</p>
        <div class="filters" id="filters"></div>
        <div class="search-row"><input type="text" id="search" placeholder="or search what's on your mind…" autocomplete="off"></div>
        <p class="inline-cta">Wanna add TeenHQ to your home screen? <a href="#" onclick="event.preventDefault(); installApp();">Add to Home Screen →</a></p>
      </section>
      <section class="grid-section">
        <div class="grid-meta"><span id="grid-count"></span><span id="grid-cat-label"></span></div>
        <div class="grid" id="grid"></div>
      </section>
    </div>`;

  document.getElementById('filters').innerHTML = CATEGORIES.map(c => `
    <button class="bubble ${c.key===adviceState.cat?'active':''}" data-cat="${c.key}" onclick="setAdviceCat('${c.key}')">
      ${c.label} <span class="count">${CAT_COUNTS[c.key]||0}</span>
    </button>`).join('');

  document.getElementById('search').addEventListener('input', (e) => {
    adviceState.search = e.target.value;
    renderAdviceGrid();
  });

  renderAdviceGrid();
}
function setAdviceCat(cat){
  adviceState.cat = cat;
  document.querySelectorAll('#filters .bubble').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderAdviceGrid();
}
function setAdviceSearch(term){
  adviceState.search = term;
  document.getElementById('search').value = term;
  renderAdviceGrid();
}
function renderAdviceGrid(){
  const grid = document.getElementById('grid');
  const term = adviceState.search;
  let filtered = ADVICE
    .filter(a => adviceState.cat === 'all' || a.category === adviceState.cat)
    .map(a => ({ a, m: matchesSearch(a, term) }))
    .filter(x => x.m.hit)
    .sort((x,y) => y.m.score - x.m.score)
    .map(x => x.a);

  document.getElementById('grid-count').textContent = filtered.length + (filtered.length===1 ? ' article' : ' articles');
  document.getElementById('grid-cat-label').textContent = adviceState.cat==='all' ? 'everything' : CATEGORIES.find(c=>c.key===adviceState.cat).label.toLowerCase();

  if (filtered.length === 0) {
    const suggestions = ['friendship','school','confidence','parents','crushes','anxiety','growing up'];
    grid.innerHTML = `<div style="grid-column:1/-1;">
      <div class="empty-state">Hmm… we couldn't find exactly what you're looking for.</div>
      <p style="text-align:center;color:var(--ink-faint);font-size:0.85rem;margin-top:6px;">Try searching for something like:</p>
      <div class="suggestions">${suggestions.map(s => `<button class="suggestion-chip" onclick="setAdviceSearch('${s}')">${s}</button>`).join('')}</div>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(a => `
    <button class="card" style="--tag-color:var(--c-${catVar(a.category)})" onclick="nav('advice/${a.id}')">
      <span class="tag"><span class="num">${a.globalNum}</span> ${a.categoryLabel}</span>
      <h3>${esc(a.title)}</h3>
      <p>${esc(hookFor(a))}</p>
      <span class="read">Read this <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>`).join('');
}

function classifyLine(line){
  const t = line.trim();
  if(!t) return {type:'skip'};
  if(/^[☐🔴🟡🟢]/.test(t)) return {type:'checklist', text:t};
  if(/^[\p{Emoji}\s]+$/u.test(t) && t.length <= 6) return {type:'emoji', text:t};
  if(t.startsWith('"') && t.endsWith('"') && t.length < 90) return {type:'quote', text:t};
  if(t.endsWith(':')) return {type:'lead', text:t};
  const endsWithPunct = /[.!?…"”]$/.test(t);
  const wc = t.split(/\s+/).length;
  if(!endsWithPunct && t.length < 62 && wc >= 2) return {type:'subhead', text:t};
  if(!endsWithPunct && wc === 1 && t.length < 20) return {type:'connector', text:t};
  return {type:'p', text:t};
}
function renderBody(body){
  return body.map(line => {
    const c = classifyLine(line);
    if(c.type==='skip') return '';
    const cls = { emoji:'emoji-line', quote:'quote', subhead:'subhead', lead:'lead', connector:'connector', checklist:'checklist' }[c.type];
    return cls ? `<p class="${cls}">${esc(c.text)}</p>` : `<p>${esc(c.text)}</p>`;
  }).join('');
}

function renderAdviceDetail(id){
  const a = ADVICE.find(x => x.id === id);
  if (!a) {
    app().innerHTML = `
      <div class="wrap" style="padding:60px 0;">
        <div class="empty-state">Hmm… that article doesn't exist (or moved).</div>
        <div style="text-align:center;margin-top:18px;"><button class="btn" onclick="nav('advice')">Back to everything</button></div>
      </div>`;
    return;
  }
  const cv = catVar(a.category);
  const others = ADVICE.filter(x => x.category === a.category && x.id !== a.id).sort(() => Math.random()-0.5).slice(0,3);

  app().innerHTML = `
    <div class="wrap detail-wrap" style="padding:36px 0 20px;">
      <button class="back-btn" onclick="nav('advice')">
        <svg viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        back to everything
      </button>
      <div class="detail-header" style="--tag-color:var(--c-${cv})">
        <div class="detail-tag" style="--tag-color:var(--c-${cv})">${a.categoryLabel} · No. ${a.globalNum}</div>
        <h1>${esc(a.title)}</h1>
      </div>
      <div class="article-body">${renderBody(a.body)}</div>
      ${a.bigSister ? `<div class="sticky"><span class="sticky-label">Big Sister Note</span><p>${esc(a.bigSister)}</p></div>` : ''}
      <div class="cta-box"><p>Not sure how you're feeling today?</p><a href="#/mood">Check My Mood</a></div>
      ${a.journal ? `
      <div class="journal-card">
        <div class="journal-head"><span class="pencil">✏️</span><span class="label">Journal prompt</span></div>
        <p class="prompt">${esc(a.journal)}</p>
        <textarea id="journal-input" placeholder="write it out here — it stays on this device, just for you…"></textarea>
        <div class="journal-foot"><span class="saved" id="journal-saved">saved ✓</span><a href="#/journal">Want to keep writing? Open My Journal →</a></div>
      </div>` : ''}
      ${others.length ? `
      <div class="keep-reading">
        <h4>more on ${a.categoryLabel.toLowerCase()}</h4>
        <div class="kr-list">${others.map(o => `
          <button class="kr-item" style="--tag-color:var(--c-${cv})" onclick="nav('advice/${o.id}')">
            <span class="kr-num">${o.globalNum}</span><span class="kr-title">${esc(o.title)}</span>
          </button>`).join('')}</div>
      </div>` : ''}
    </div>`;

  setupArticleJournal(a.id);
}
function setupArticleJournal(articleId){
  const ta = document.getElementById('journal-input');
  if (!ta) return;
  const key = 'teenhq-article-journal-' + articleId;
  const saved = store.get(key, '');
  if (saved) ta.value = saved;
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      store.set(key, ta.value);
      const foot = document.getElementById('journal-saved');
      if (foot) { foot.classList.add('show'); setTimeout(() => foot.classList.remove('show'), 1800); }
    }, 500);
  });
}

/* ============================================================
   GENERIC SPARK DECK — compliments / prompts / challenges / study tips
   Fully data-driven: add items to TEENHQ_DATA.<key> in data.js.
   ============================================================ */
const SPARK_CONFIG = {
  compliments: { emoji: '✨', title: 'Compliments', eyebrow: 'a little something nice', lede: "Because sometimes you just need someone in your corner.", verb: 'compliment', shuffleLabel: 'Another one' },
  prompts:     { emoji: '💭', title: 'Journal Prompts', eyebrow: 'something to write about', lede: "Pick a page. There's no wrong way to fill it in.", verb: 'prompt', shuffleLabel: 'New prompt' },
  challenges:  { emoji: '🔥', title: 'What Should I Do Today', eyebrow: 'a little nudge', lede: "When you're bored, restless, or just want an idea — pick one.", verb: 'idea', shuffleLabel: 'Give me another' },
  studytips:   { emoji: '📚', title: 'Study Tips', eyebrow: 'quick wins', lede: "Small, practical things that actually help.", verb: 'tip', shuffleLabel: 'Next tip' },
};

function favKey(collection){ return 'teenhq-favorites-' + collection; }

function renderSparkDeck(collection, pickIndex){
  const cfg = SPARK_CONFIG[collection];
  const items = TEENHQ_DATA[collection];
  const favorites = new Set(store.get(favKey(collection), []));
  const idx = pickIndex !== undefined ? pickIndex : Math.floor(Math.random() * items.length);
  const item = items[idx];
  const isFav = favorites.has(item.id);

  app().innerHTML = `
    <div class="wrap spark-wrap">
      <section class="page-hero">
        <p class="page-eyebrow">${cfg.eyebrow}</p>
        <h1>${cfg.emoji} ${cfg.title}</h1>
        <p class="lede">${cfg.lede}</p>
      </section>
      <div class="spark-card" id="spark-card"><p>${esc(item.text)}</p></div>
      <div class="spark-actions">
        <button class="spark-btn primary" onclick="shuffleSpark('${collection}')">🔀 ${cfg.shuffleLabel}</button>
        <button class="spark-btn ${isFav?'liked':''}" id="fav-btn" onclick="toggleSparkFav('${collection}','${item.id}')">${isFav ? '♥ Saved' : '♡ Save this'}</button>
      </div>
      <div class="spark-list">
        <h4>all ${items.length} · browse</h4>
        <div id="spark-list-items">${renderSparkListItems(collection)}</div>
      </div>
    </div>`;
  app().dataset.sparkCollection = collection;
  app().dataset.sparkIndex = idx;
}
function renderSparkListItems(collection){
  const items = TEENHQ_DATA[collection];
  const favorites = new Set(store.get(favKey(collection), []));
  return items.map((it, i) => `
    <div class="spark-list-item">
      <span onclick="jumpSpark('${collection}', ${i})" style="cursor:pointer; flex:1;">${esc(it.text)}</span>
      <button class="fav-btn ${favorites.has(it.id)?'active':''}" onclick="toggleSparkFav('${collection}','${it.id}', true)">${favorites.has(it.id) ? '♥' : '♡'}</button>
    </div>`).join('');
}
function shuffleSpark(collection){
  const items = TEENHQ_DATA[collection];
  const curIdx = parseInt(app().dataset.sparkIndex, 10);
  let next = Math.floor(Math.random() * items.length);
  if (items.length > 1 && next === curIdx) next = (next + 1) % items.length;
  renderSparkDeck(collection, next);
}
function jumpSpark(collection, idx){
  renderSparkDeck(collection, idx);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toggleSparkFav(collection, itemId, skipRerenderCard){
  const key = favKey(collection);
  const favs = new Set(store.get(key, []));
  if (favs.has(itemId)) favs.delete(itemId); else favs.add(itemId);
  store.set(key, [...favs]);
  if (!skipRerenderCard) {
    const btn = document.getElementById('fav-btn');
    if (btn) {
      const active = favs.has(itemId);
      btn.classList.toggle('liked', active);
      btn.textContent = active ? '♥ Saved' : '♡ Save this';
    }
  }
  const list = document.getElementById('spark-list-items');
  if (list) list.innerHTML = renderSparkListItems(collection);
}

/* Study Hub = study tips deck + a simple focus timer */
function renderStudy(){
  renderSparkDeck('studytips');
  const wrap = document.querySelector('.spark-wrap');
  const timerHtml = `
    <div class="tool-panel" style="margin-top:10px;">
      <h3>⏱️ Focus Timer</h3>
      <p class="sub">A simple 25-minute focus session. Stay off your phone until it rings.</p>
      <div class="timer-display" id="timer-display">25:00</div>
      <div class="timer-controls">
        <button class="btn" id="timer-start" onclick="timerToggle()">Start</button>
        <button class="btn ghost" onclick="timerReset()">Reset</button>
      </div>
      <p class="sub" style="text-align:center;margin-top:14px;">Sessions completed: <strong id="session-count">${store.get('teenhq-study-sessions', 0)}</strong></p>
    </div>`;
  wrap.insertAdjacentHTML('afterbegin', timerHtml);
  const hero = wrap.querySelector('.page-hero');
  const panel = wrap.querySelector('.tool-panel');
  hero.insertAdjacentElement('afterend', panel);
  renderTimerDisplay();
}
let timerSeconds = store.get('teenhq-timer-remaining', 25*60);
let timerRunning = false;
let timerInterval = null;
function renderTimerDisplay(){
  const el = document.getElementById('timer-display');
  if (!el) return;
  const m = Math.floor(timerSeconds/60).toString().padStart(2,'0');
  const s = Math.floor(timerSeconds%60).toString().padStart(2,'0');
  el.textContent = `${m}:${s}`;
}
function timerToggle(){
  const btn = document.getElementById('timer-start');
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    if (btn) btn.textContent = 'Resume';
  } else {
    timerRunning = true;
    if (btn) btn.textContent = 'Pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      store.set('teenhq-timer-remaining', timerSeconds);
      renderTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        const done = store.get('teenhq-study-sessions', 0) + 1;
        store.set('teenhq-study-sessions', done);
        const sc = document.getElementById('session-count');
        if (sc) sc.textContent = done;
        timerSeconds = 25*60;
        store.set('teenhq-timer-remaining', timerSeconds);
        renderTimerDisplay();
        if (btn) btn.textContent = 'Start';
        alert("Session done! Nice focus. 🎉");
      }
    }, 1000);
  }
}
function timerReset(){
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = 25*60;
  store.set('teenhq-timer-remaining', timerSeconds);
  renderTimerDisplay();
  const btn = document.getElementById('timer-start');
  if (btn) btn.textContent = 'Start';
}

/* ============================================================
   FUN HUB
   ============================================================ */
function renderFunHub(){
  const tools = [
    { emoji:'✨', title:'Compliments', desc:'A little something nice, any time you need it.', path:'fun/compliments' },
    { emoji:'💭', title:'Journal Prompts', desc:'Pages worth filling in.', path:'fun/prompts' },
    { emoji:'🔥', title:'What Should I Do Today', desc:'For when you\'re bored or restless.', path:'fun/challenges' },
  ];
  app().innerHTML = `
    <div class="wrap">
      <section class="page-hero">
        <p class="page-eyebrow">just for fun</p>
        <h1>🎲 Fun Stuff</h1>
        <p class="lede">The lighter corner of TeenHQ.</p>
      </section>
      <div class="tool-grid">
        ${tools.map(t => `
          <button class="tool-card" onclick="nav('${t.path}')">
            <span class="emoji">${t.emoji}</span>
            <h3>${t.title}</h3>
            <p>${t.desc}</p>
          </button>`).join('')}
      </div>
    </div>`;
}

/* ============================================================
   TOOLS — Mood / Journal / Water / Sleep / Habits / Goals / Budget
   ============================================================ */
function toolPageShell(eyebrow, emoji, title, lede, bodyHtml){
  app().innerHTML = `
    <div class="wrap tool-page">
      <section class="page-hero">
        <p class="page-eyebrow">${eyebrow}</p>
        <h1>${emoji} ${title}</h1>
        <p class="lede">${lede}</p>
      </section>
      ${bodyHtml}
    </div>`;
}

/* ---- Mood ---- */
const MOODS = [
  { emoji:'😢', label:'Rough' }, { emoji:'😕', label:'Meh' }, { emoji:'😐', label:'Okay' },
  { emoji:'🙂', label:'Good' }, { emoji:'😄', label:'Great' },
];
function renderMood(){
  const log = store.get('teenhq-mood-log', []);
  toolPageShell('how are you, really', '😊', 'Mood Check', "No wrong answers. Just check in with yourself.", `
    <div class="tool-panel">
      <h3>Today</h3>
      <p class="sub">Pick what fits right now.</p>
      <div class="mood-row">
        ${MOODS.map(m => `<button class="mood-btn" title="${m.label}" onclick="logMood('${m.emoji}','${m.label}')">${m.emoji}</button>`).join('')}
      </div>
    </div>
    <div class="tool-panel">
      <h3>Recent check-ins</h3>
      <div id="mood-history">${renderMoodHistory(log)}</div>
    </div>`);
}
function renderMoodHistory(log){
  if (!log.length) return `<p class="sub">Nothing logged yet — your check-ins will show up here.</p>`;
  return [...log].reverse().slice(0,14).map(e => `
    <div class="history-item"><span>${e.emoji} ${e.label}</span><span class="h-date">${niceDate(e.date)}</span></div>`).join('');
}
function logMood(emoji, label){
  const log = store.get('teenhq-mood-log', []);
  log.push({ emoji, label, date: new Date().toISOString() });
  store.set('teenhq-mood-log', log);
  document.getElementById('mood-history').innerHTML = renderMoodHistory(log);
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.toggle('selected', b.title === label));
}

/* ---- Journal (freeform) ---- */
function renderJournal(){
  const entries = store.get('teenhq-journal-entries', []);
  toolPageShell('your space', '📓', 'Journal', "Write whatever's actually going on. It stays on this device.", `
    <div class="tool-panel">
      <h3>New entry</h3>
      <div class="row-input"><input id="j-title" placeholder="Title (optional)"></div>
      <div class="row-input"><textarea id="j-text" placeholder="What's on your mind?" style="width:100%;min-height:110px;border:1.5px solid var(--line);background:var(--paper);border-radius:12px;padding:12px 14px;font-family:inherit;font-size:0.95rem;color:var(--ink);outline:none;resize:vertical;"></textarea></div>
      <button class="btn" onclick="addJournalEntry()">Save entry</button>
    </div>
    <div id="journal-entries">${renderJournalEntries(entries)}</div>`);
}
function renderJournalEntries(entries){
  if (!entries.length) return `<p class="sub" style="text-align:center;">No entries yet. Your first one starts above.</p>`;
  return [...entries].reverse().map(e => `
    <div class="jentry">
      <div class="jdate">${niceDate(e.date)}</div>
      ${e.title ? `<div class="jtitle">${esc(e.title)}</div>` : ''}
      <div class="jtext">${esc(e.text)}</div>
      <div class="jentry-actions"><button class="btn danger" onclick="deleteJournalEntry('${e.id}')">Delete</button></div>
    </div>`).join('');
}
function addJournalEntry(){
  const titleEl = document.getElementById('j-title');
  const textEl = document.getElementById('j-text');
  const text = textEl.value.trim();
  if (!text) return;
  const entries = store.get('teenhq-journal-entries', []);
  entries.push({ id: uid(), title: titleEl.value.trim(), text, date: new Date().toISOString() });
  store.set('teenhq-journal-entries', entries);
  titleEl.value = ''; textEl.value = '';
  document.getElementById('journal-entries').innerHTML = renderJournalEntries(entries);
}
function deleteJournalEntry(id){
  let entries = store.get('teenhq-journal-entries', []);
  entries = entries.filter(e => e.id !== id);
  store.set('teenhq-journal-entries', entries);
  document.getElementById('journal-entries').innerHTML = renderJournalEntries(entries);
}

/* ---- Water ---- */
function renderWater(){
  const data = store.get('teenhq-water', {});
  const today = todayStr();
  if (data.date !== today) { data.date = today; data.count = 0; }
  if (!data.target) data.target = 8;
  store.set('teenhq-water', data);

  toolPageShell('stay on top of it', '💧', 'Water', "Small sips add up.", `
    <div class="tool-panel">
      <h3>Today</h3>
      <div class="counter-row">
        <button class="counter-btn" onclick="adjustWater(-1)">−</button>
        <div><div class="counter-value" id="water-count">${data.count}</div></div>
        <button class="counter-btn" onclick="adjustWater(1)">+</button>
      </div>
      <div class="counter-target">glasses of ${data.target} today</div>
      <div class="progress-track"><div class="progress-fill" id="water-fill" style="width:${Math.min(100, (data.count/data.target)*100)}%"></div></div>
    </div>
    <div class="tool-panel">
      <h3>Target</h3>
      <div class="row-input">
        <input type="number" id="water-target" min="1" max="20" value="${data.target}">
        <button class="btn ghost" onclick="setWaterTarget()">Update</button>
      </div>
    </div>`);
}
function adjustWater(delta){
  const data = store.get('teenhq-water', { date: todayStr(), count: 0, target: 8 });
  data.count = Math.max(0, data.count + delta);
  store.set('teenhq-water', data);
  document.getElementById('water-count').textContent = data.count;
  document.getElementById('water-fill').style.width = Math.min(100, (data.count/data.target)*100) + '%';
}
function setWaterTarget(){
  const val = parseInt(document.getElementById('water-target').value, 10) || 8;
  const data = store.get('teenhq-water', { date: todayStr(), count: 0, target: 8 });
  data.target = val;
  store.set('teenhq-water', data);
  renderWater();
}

/* ---- Sleep ---- */
function renderSleep(){
  const log = store.get('teenhq-sleep-log', []);
  const avg = log.length ? (log.reduce((s,e)=>s+e.hours,0)/log.length).toFixed(1) : '—';
  toolPageShell('rest matters', '😴', 'Sleep', "Log how much sleep you got — patterns matter more than any single night.", `
    <div class="tool-panel">
      <h3>Last night</h3>
      <div class="row-input">
        <input type="number" id="sleep-hours" min="0" max="14" step="0.5" placeholder="Hours slept, e.g. 7.5">
        <button class="btn" onclick="logSleep()">Log</button>
      </div>
    </div>
    <div class="tool-panel">
      <h3>Average</h3>
      <div class="counter-value" style="text-align:center;">${avg}${avg!=='—' ? '<span style="font-size:1rem;color:var(--ink-faint);"> hrs</span>' : ''}</div>
    </div>
    <div class="tool-panel">
      <h3>History</h3>
      <div id="sleep-history">${renderSleepHistory(log)}</div>
    </div>`);
}
function renderSleepHistory(log){
  if (!log.length) return `<p class="sub">No nights logged yet.</p>`;
  return [...log].reverse().slice(0,14).map(e => `
    <div class="history-item"><span>${e.hours} hrs</span><span class="h-date">${niceDate(e.date)}</span></div>`).join('');
}
function logSleep(){
  const val = parseFloat(document.getElementById('sleep-hours').value);
  if (isNaN(val)) return;
  const log = store.get('teenhq-sleep-log', []);
  log.push({ hours: val, date: new Date().toISOString() });
  store.set('teenhq-sleep-log', log);
  renderSleep();
}

/* ---- Habits ---- */
function renderHabits(){
  const habits = store.get('teenhq-habits', []);
  toolPageShell('small and steady', '🌱', 'Habits', "Check them off as you go. Streaks build from showing up daily.", `
    <div class="tool-panel">
      <h3>Add a habit</h3>
      <div class="row-input">
        <input id="habit-input" placeholder="e.g. Drink water, Stretch, Read">
        <button class="btn" onclick="addHabit()">Add</button>
      </div>
    </div>
    <div id="habits-list">${renderHabitsList(habits)}</div>`);
}
function renderHabitsList(habits){
  if (!habits.length) return `<p class="sub" style="text-align:center;">No habits yet — add your first one above.</p>`;
  const today = todayStr();
  return habits.map(h => {
    const doneToday = h.log && h.log.includes(today);
    return `
    <div class="list-item ${doneToday?'done':''}">
      <div class="li-main">
        <span class="check-circle ${doneToday?'checked':''}" onclick="toggleHabit('${h.id}')">${doneToday?'✓':''}</span>
        <span>${esc(h.name)}</span>
      </div>
      <span class="streak-badge">🔥 ${habitStreak(h)}</span>
      <button class="btn danger" onclick="deleteHabit('${h.id}')">✕</button>
    </div>`;
  }).join('');
}
function habitStreak(h){
  if (!h.log || !h.log.length) return 0;
  let streak = 0;
  let d = new Date();
  while (true) {
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (h.log.includes(key)) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}
function addHabit(){
  const input = document.getElementById('habit-input');
  const name = input.value.trim();
  if (!name) return;
  const habits = store.get('teenhq-habits', []);
  habits.push({ id: uid(), name, log: [] });
  store.set('teenhq-habits', habits);
  input.value = '';
  document.getElementById('habits-list').innerHTML = renderHabitsList(habits);
}
function toggleHabit(id){
  const habits = store.get('teenhq-habits', []);
  const h = habits.find(x => x.id === id);
  if (!h) return;
  const today = todayStr();
  h.log = h.log || [];
  if (h.log.includes(today)) h.log = h.log.filter(d => d !== today);
  else h.log.push(today);
  store.set('teenhq-habits', habits);
  document.getElementById('habits-list').innerHTML = renderHabitsList(habits);
}
function deleteHabit(id){
  let habits = store.get('teenhq-habits', []);
  habits = habits.filter(h => h.id !== id);
  store.set('teenhq-habits', habits);
  document.getElementById('habits-list').innerHTML = renderHabitsList(habits);
}

/* ---- Goals ---- */
function renderGoals(){
  const goals = store.get('teenhq-goals', []);
  toolPageShell('what you\'re working toward', '🎯', 'Goals', "Big or small — write it down so it's real.", `
    <div class="tool-panel">
      <h3>Add a goal</h3>
      <div class="row-input">
        <input id="goal-input" placeholder="e.g. Finish my science project">
        <button class="btn" onclick="addGoal()">Add</button>
      </div>
    </div>
    <div id="goals-list">${renderGoalsList(goals)}</div>`);
}
function renderGoalsList(goals){
  if (!goals.length) return `<p class="sub" style="text-align:center;">No goals yet — add your first one above.</p>`;
  return goals.map(g => `
    <div class="list-item ${g.done?'done':''}">
      <div class="li-main">
        <span class="check-circle ${g.done?'checked':''}" onclick="toggleGoal('${g.id}')">${g.done?'✓':''}</span>
        <span>${esc(g.text)}</span>
      </div>
      <button class="btn danger" onclick="deleteGoal('${g.id}')">✕</button>
    </div>`).join('');
}
function addGoal(){
  const input = document.getElementById('goal-input');
  const text = input.value.trim();
  if (!text) return;
  const goals = store.get('teenhq-goals', []);
  goals.push({ id: uid(), text, done: false });
  store.set('teenhq-goals', goals);
  input.value = '';
  document.getElementById('goals-list').innerHTML = renderGoalsList(goals);
}
function toggleGoal(id){
  const goals = store.get('teenhq-goals', []);
  const g = goals.find(x => x.id === id);
  if (g) g.done = !g.done;
  store.set('teenhq-goals', goals);
  document.getElementById('goals-list').innerHTML = renderGoalsList(goals);
}
function deleteGoal(id){
  let goals = store.get('teenhq-goals', []);
  goals = goals.filter(g => g.id !== id);
  store.set('teenhq-goals', goals);
  document.getElementById('goals-list').innerHTML = renderGoalsList(goals);
}

/* ---- Budget ---- */
function renderBudget(){
  const ledger = store.get('teenhq-budget', []);
  toolPageShell('keep track', '💸', 'Budget', "A simple ledger. No bank account needed.", `
    <div class="tool-panel">
      <div class="budget-balance ${budgetTotal(ledger)<0?'negative':''}">${formatMoney(budgetTotal(ledger))}</div>
      <div class="budget-sub">current balance</div>
      <div class="row-input">
        <input id="b-label" placeholder="What for?">
        <input id="b-amount" type="number" step="0.01" placeholder="Amount">
        <select id="b-type"><option value="income">Income</option><option value="expense">Expense</option></select>
      </div>
      <button class="btn" onclick="addBudgetEntry()">Add</button>
    </div>
    <div class="tool-panel">
      <h3>Recent</h3>
      <div id="budget-list">${renderBudgetList(ledger)}</div>
    </div>`);
}
function budgetTotal(ledger){
  return ledger.reduce((s,e) => s + (e.type==='income' ? e.amount : -e.amount), 0);
}
function formatMoney(n){
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toFixed(2);
}
function renderBudgetList(ledger){
  if (!ledger.length) return `<p class="sub">No entries yet.</p>`;
  return [...ledger].reverse().slice(0,20).map(e => `
    <div class="ledger-item">
      <span>${esc(e.label)}</span>
      <span class="amt ${e.type}">${e.type==='income'?'+':'-'}$${e.amount.toFixed(2)}</span>
    </div>`).join('');
}
function addBudgetEntry(){
  const label = document.getElementById('b-label').value.trim();
  const amount = parseFloat(document.getElementById('b-amount').value);
  const type = document.getElementById('b-type').value;
  if (!label || isNaN(amount) || amount <= 0) return;
  const ledger = store.get('teenhq-budget', []);
  ledger.push({ id: uid(), label, amount, type, date: new Date().toISOString() });
  store.set('teenhq-budget', ledger);
  renderBudget();
}

/* ============================================================
   PWA — install prompt + service worker
   ============================================================ */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('install-banner');
  if (banner && !localStorage.getItem('teenhq-install-dismissed')) banner.classList.add('show');
});
function installApp(){
  const banner = document.getElementById('install-banner');
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => {
      deferredInstallPrompt = null;
      if (banner) banner.classList.remove('show');
    });
  }
}
function dismissInstall(){
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('show');
  try { localStorage.setItem('teenhq-install-dismissed', '1'); } catch(e){}
}
window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('show');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------------- boot ---------------- */
initTheme();
updateThemeIcon();
router();
