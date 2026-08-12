// 台中待訪 — 資料載入與渲染
// 樣式一律以 class 切換，本檔不寫任何樣式值。

const listEl = document.getElementById('store-list');
const errorEl = document.getElementById('error');
const totalEl = document.getElementById('progress-total');

const STORAGE_KEY = 'taichung-list:visited';
const countEl = document.getElementById('progress-count');
const barEl = document.getElementById('progress-bar');

/**
 * 已去過狀態。localStorage 不可用時（無痕模式）自動降級為記憶體，
 * 當次瀏覽仍可運作，不拋錯。
 */
export function createVisitedStore() {
  let usable = true;
  let memory = new Set();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) memory = new Set(parsed.filter((v) => typeof v === 'string'));
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...memory]));
  } catch {
    usable = false;
  }

  function persist() {
    if (!usable) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...memory]));
    } catch {
      usable = false;
    }
  }

  return {
    has: (id) => memory.has(id),
    size: () => memory.size,
    toggle(id) {
      if (memory.has(id)) memory.delete(id);
      else memory.add(id);
      persist();
      return memory.has(id);
    },
  };
}

/** 更新進度數字與進度條。數字以軌道位移做翻頁效果。 */
export function updateProgress(visitedCount, total) {
  const track = countEl.querySelector('.counter__track');
  const current = countEl.dataset.value;
  const next = String(visitedCount);

  if (current !== next) {
    const incoming = document.createElement('i');
    incoming.textContent = next;
    track.appendChild(incoming);
    // 強制回流後再位移，確保過渡會被觸發
    void track.offsetHeight;
    track.style.transform = 'translateY(-20px)';
    const settle = () => {
      track.style.transition = 'none';
      track.style.transform = 'translateY(0)';
      track.replaceChildren(incoming);
      void track.offsetHeight;
      track.style.transition = '';
    };
    track.addEventListener('transitionend', settle, { once: true });
    // 動畫被停用時 transitionend 不會觸發，用逾時保底
    window.setTimeout(() => {
      if (track.childElementCount > 1) settle();
    }, 600);
    countEl.dataset.value = next;
  }

  barEl.style.width = total > 0 ? `${(visitedCount / total) * 100}%` : '0';
}

/**
 * 票根進入視野時觸發進場浮現與暖光掃過，各自只觸發一次。
 * 浮現以索引錯開 90ms，形成依序浮現的節奏。
 */
export function observeTickets(elements) {
  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-in', 'is-sheened'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const order = Number(el.dataset.order || 0);
      el.style.animationDelay = `${order * 90}ms`;
      el.classList.add('is-in');
      // 暖光在浮現結束後才掃，避免兩組動畫疊在一起
      window.setTimeout(() => el.classList.add('is-sheened'), order * 90 + 620);
      observer.unobserve(el);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

  elements.forEach((el) => observer.observe(el));
}

const IG_SCRIPT = 'https://www.instagram.com/embed.js';
let igScriptPromise = null;

/**
 * Instagram 的嵌入只接受單篇貼文（/p/、/reel/、/tv/）的永久連結，
 * 帳號首頁不會被渲染。判斷後改走直接開啟連結，避免空等逾時。
 */
export function isEmbeddablePost(url) {
  return /^https:\/\/www\.instagram\.com\/(p|reel|tv)\/[^/]+/.test(url);
}

/** Instagram 嵌入腳本全頁只載入一次，且只在使用者第一次展開時才載入。 */
export function loadInstagramScript() {
  if (igScriptPromise) return igScriptPromise;
  igScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = IG_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('embed.js 載入失敗'));
    document.head.appendChild(script);
  });
  return igScriptPromise;
}

/** 綁定「看實景」：點擊才建立嵌入，再點收合。失敗則退回文字連結。 */
export function attachEmbed(ticketEl, store) {
  const button = ticketEl.querySelector('.ticket__reveal');
  const container = ticketEl.querySelector('.ticket__embed');
  // 帳號首頁的情況下這裡是 <a>，不應攔截它的預設導覽行為
  if (!button || button.tagName !== 'BUTTON' || !container) return;

  let built = false;
  let open = false;

  function fallback() {
    container.replaceChildren();
    const link = document.createElement('a');
    link.className = 'ticket__fallback';
    link.href = store.instagram;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '在 Instagram 開啟 ↗';
    container.appendChild(link);
  }

  button.addEventListener('click', async () => {
    if (built) {
      open = !open;
      container.hidden = !open;
      button.textContent = open ? '收合 ↑' : '看實景 ↓';
      return;
    }

    built = true;
    open = true;
    button.textContent = '載入中…';

    const quote = document.createElement('blockquote');
    quote.className = 'instagram-media';
    quote.dataset.instgrmPermalink = store.instagram;
    quote.dataset.instgrmVersion = '14';
    container.replaceChildren(quote);

    // 逾時保底：3 秒內未被 Instagram 腳本改寫就退回文字連結
    const timer = window.setTimeout(() => {
      if (!quote.querySelector('iframe')) fallback();
      button.textContent = '收合 ↑';
    }, 3000);

    try {
      await loadInstagramScript();
      if (window.instgrm?.Embeds?.process) window.instgrm.Embeds.process();
      button.textContent = '收合 ↑';
    } catch {
      window.clearTimeout(timer);
      fallback();
      button.textContent = '收合 ↑';
    }
  });
}

/** 由 id 推導穩定的暖色階編號，讓每家店的色塊不同但同調。 */
export function toneFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 6) + 1;
}

/** 組出不需金鑰、手機可喚起 App 的 Google Maps 導航網址。 */
export function navUrl(store) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.navQuery)}`;
}

function ordinal(index) {
  return String(index + 1).padStart(2, '0');
}

function buildOrdinal(index) {
  const el = document.createElement('span');
  el.className = 'ticket__ordinal';
  el.textContent = ordinal(index);
  return el;
}

/** 建立一張票根。缺漏欄位一律不渲染該行，不留空白間隙。 */
export function renderStore(store, index) {
  const li = document.createElement('li');
  li.className = 'ticket';
  li.dataset.id = store.id;

  // --- 照片區 ---
  const visual = document.createElement('div');
  visual.className = 'ticket__visual';

  if (store.photo) {
    const img = document.createElement('img');
    img.className = 'ticket__photo';
    img.src = store.photo;
    img.alt = store.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    // 照片載入失敗時退回色塊，不出現破圖
    img.addEventListener('error', () => {
      img.remove();
      visual.dataset.tone = String(toneFor(store.id));
      visual.appendChild(buildOrdinal(index));
    });
    visual.appendChild(img);
    if (store.photoCredit) {
      const credit = document.createElement('span');
      credit.className = 'ticket__credit';
      credit.textContent = store.photoCredit;
      visual.appendChild(credit);
    }
  } else {
    visual.dataset.tone = String(toneFor(store.id));
    visual.appendChild(buildOrdinal(index));
  }

  const sheen = document.createElement('span');
  sheen.className = 'ticket__sheen';
  visual.appendChild(sheen);
  li.appendChild(visual);

  // --- 內文 ---
  const body = document.createElement('div');
  body.className = 'ticket__body';

  const name = document.createElement('h2');
  name.className = 'ticket__name';
  name.textContent = store.name;
  body.appendChild(name);

  if (store.subtitle) {
    const sub = document.createElement('p');
    sub.className = 'ticket__subtitle';
    sub.textContent = store.subtitle;
    body.appendChild(sub);
  }

  const lines = [store.address, store.hours].filter(Boolean);
  if (lines.length > 0) {
    const wrap = document.createElement('p');
    wrap.className = 'ticket__lines';
    for (const text of lines) {
      const span = document.createElement('span');
      span.textContent = text;
      wrap.appendChild(span);
    }
    body.appendChild(wrap);
  }
  li.appendChild(body);

  // --- 動作列（撕線之上） ---
  const actions = document.createElement('div');
  actions.className = 'ticket__actions';

  const nav = document.createElement('a');
  nav.className = 'ticket__nav';
  nav.href = navUrl(store);
  nav.target = '_blank';
  nav.rel = 'noopener noreferrer';
  nav.textContent = '導航前往';
  actions.appendChild(nav);

  if (store.instagram && isEmbeddablePost(store.instagram)) {
    const reveal = document.createElement('button');
    reveal.className = 'ticket__reveal';
    reveal.type = 'button';
    reveal.textContent = '看實景 ↓';
    actions.appendChild(reveal);
  } else if (store.instagram) {
    // 帳號首頁無法嵌入，直接給連結
    const link = document.createElement('a');
    link.className = 'ticket__reveal';
    link.href = store.instagram;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Instagram ↗';
    actions.appendChild(link);
  }
  li.appendChild(actions);

  const embed = document.createElement('div');
  embed.className = 'ticket__embed';
  li.appendChild(embed);

  // --- 撕線與下半截 ---
  const perf = document.createElement('div');
  perf.className = 'ticket__perf';
  li.appendChild(perf);

  const stub = document.createElement('button');
  stub.className = 'ticket__stub';
  stub.type = 'button';
  const no = document.createElement('span');
  no.className = 'ticket__no';
  no.textContent = `NO. ${ordinal(index)}`;
  const hint = document.createElement('span');
  hint.className = 'ticket__hint';
  hint.textContent = '撕開標記已去過';
  stub.append(no, hint);
  li.appendChild(stub);

  // 撕開後浮現的標記本身就是復原按鈕，否則使用者找不到怎麼撕回來
  const torn = document.createElement('button');
  torn.className = 'ticket__torn';
  torn.type = 'button';
  const tornLabel = document.createElement('span');
  tornLabel.textContent = '已去過';
  const undo = document.createElement('span');
  undo.className = 'ticket__undo';
  undo.textContent = '撕回來';
  torn.append(tornLabel, undo);
  li.appendChild(torn);

  return li;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  const retry = document.createElement('button');
  retry.className = 'notice__retry';
  retry.type = 'button';
  retry.textContent = '重試';
  retry.addEventListener('click', () => window.location.reload());
  errorEl.appendChild(retry);
}

async function init() {
  let stores;
  try {
    const res = await fetch('stores.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stores = await res.json();
    if (!Array.isArray(stores)) throw new Error('格式錯誤');
  } catch (e) {
    showError(`清單載入失敗（${e.message}）。`);
    return;
  }

  if (stores.length === 0) {
    errorEl.textContent = '清單還是空的，去 stores.json 加第一家店吧。';
    errorEl.hidden = false;
    return;
  }

  totalEl.textContent = String(stores.length);

  const visited = createVisitedStore();
  const fragment = document.createDocumentFragment();

  stores.forEach((store, i) => {
    const el = renderStore(store, i);
    if (visited.has(store.id)) el.classList.add('is-visited');

    // 下半截負責「撕開」，浮現的標記負責「撕回來」，兩者都走同一條切換路徑
    const toggleVisited = () => {
      const nowVisited = visited.toggle(store.id);
      el.classList.toggle('is-visited', nowVisited);
      updateProgress(visited.size(), stores.length);
    };
    el.querySelector('.ticket__stub').addEventListener('click', toggleVisited);
    el.querySelector('.ticket__torn').addEventListener('click', toggleVisited);

    if (store.instagram && isEmbeddablePost(store.instagram)) attachEmbed(el, store);

    el.dataset.order = String(i % 5);
    fragment.appendChild(el);
  });

  listEl.appendChild(fragment);
  observeTickets([...listEl.querySelectorAll('.ticket')]);
  updateProgress(visited.size(), stores.length);
}

init();
