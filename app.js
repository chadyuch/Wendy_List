// 台中待訪 — 資料載入與渲染
// 樣式一律以 class 切換，本檔不寫任何樣式值。

const listEl = document.getElementById('store-list');
const errorEl = document.getElementById('error');
const totalEl = document.getElementById('progress-total');

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

  if (store.instagram) {
    const reveal = document.createElement('button');
    reveal.className = 'ticket__reveal';
    reveal.type = 'button';
    reveal.textContent = '看實景 ↓';
    actions.appendChild(reveal);
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

  const torn = document.createElement('span');
  torn.className = 'ticket__torn';
  torn.textContent = '已去過';
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
  const fragment = document.createDocumentFragment();
  stores.forEach((store, i) => fragment.appendChild(renderStore(store, i)));
  listEl.appendChild(fragment);
}

init();
