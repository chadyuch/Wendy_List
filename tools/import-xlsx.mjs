// 把 List.xlsx 轉成 stores.json，並把所有圖片收進 images/。
//
//   node tools/import-xlsx.mjs                    使用預設的 Google Drive 路徑
//   node tools/import-xlsx.mjs "D:/其他/List.xlsx" 指定來源
//
// 為什麼要轉檔而不是讓瀏覽器直接讀 xlsx：
// xlsx 實際上是壓縮檔加 XML，瀏覽器要解析得載入約 400KB 的第三方函式庫，
// 違背本專案零依賴、秒開的前提。改在編輯階段轉一次，網頁只讀輕量 JSON。
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = process.argv[2]
  || 'G:/我的雲端硬碟/Claude Code/工業配電/TaichungList/List.xlsx';

// 店名對應 id。id 是 localStorage 的鍵，一旦訂定就不能變，
// 否則使用者「去過了」的紀錄會全部讀不到。店名微調時改這裡的鍵即可。
const ID_BY_NAME = {
  'edia café': 'edia-cafe',
  'edia cafe': 'edia-cafe',
  '十三咖啡': 'thirteen-coffee',
  '蛋捲實驗室': 'caramel-eggroll-lab',
  'Mountaintown Liming': 'mountaintown-liming',
  'HECHO: Bar & Kitchen': 'hecho',
  "Ruder's Café": 'ruders-cafe',
  'Lay Low': 'lay-low',
  'Riso Riso': 'riso-riso',
  '多爾法式烘焙': 'duoer',
  'Like a Fish': 'like-a-fish',
  '居無定所Homeless': 'homeless',
};

// 既有圖片的來源標註。xlsx 沒有這個欄位，但這些照片都是別人拍的，
// 標註不能掉。新加入的外站圖片會自動以網域推導。
const CREDIT_BY_ID = {
  'edia-cafe': '圖片來源 blue74.net',
  'thirteen-coffee': '圖片來源 pepe.tw',
  'caramel-eggroll-lab': '圖片來源 greenripple.com.tw',
  'mountaintown-liming': '攝影 KENJI.LIFE',
  'ruders-cafe': '圖片來源 blue74.net',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// ---------- xlsx 讀取（zip + xml，零依賴） ----------

function readZip(b) {
  let eocd = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 66000; i -= 1) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 xlsx（找不到 ZIP 中央目錄）');

  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const files = {};

  for (let i = 0; i < count; i += 1) {
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const method = b.readUInt16LE(p + 10);
    const compSize = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const localOff = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nameLen);
    const start = localOff + 30 + b.readUInt16LE(localOff + 26) + b.readUInt16LE(localOff + 28);
    const raw = b.subarray(start, start + compSize);
    files[name] = method === 0 ? raw : inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');

function readSheet(path) {
  const files = readZip(readFileSync(path));

  const shared = [];
  const ss = files['xl/sharedStrings.xml']?.toString('utf8') || '';
  for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) || []) {
    shared.push([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join(''));
  }

  const colIndex = (ref) => {
    let n = 0;
    for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };

  const sheet = files['xl/worksheets/sheet1.xml'].toString('utf8');
  const rows = [];

  for (const rowXml of sheet.match(/<row[\s\S]*?<\/row>/g) || []) {
    const cells = [];
    // 自閉合與成對標籤都要能吃，否則空白儲存格會讓後面整列錯位
    for (const cm of rowXml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cm[1].match(/r="([A-Z]+\d+)"/)?.[1];
      if (!ref) continue;
      const type = cm[1].match(/t="([^"]+)"/)?.[1];
      const inner = cm[2] || '';
      let value;
      if (type === 's') value = shared[Number(inner.match(/<v>(\d+)<\/v>/)?.[1])] ?? '';
      else if (type === 'inlineStr') value = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
      else value = decode(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
      cells[colIndex(ref)] = value;
    }
    rows.push(cells);
  }
  return rows;
}

// ---------- 欄位清洗 ----------

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/** Excel 用前置單引號把數字強制成文字，輸出前要清掉 */
const cleanTel = (v) => clean(v).replace(/^'/, '').replace(/[^\d+]/g, '');

/** 市話 04-2327-2503、手機 0917-646-373，純顯示用 */
function formatTel(tel) {
  if (/^09\d{8}$/.test(tel)) return `${tel.slice(0, 4)}-${tel.slice(4, 7)}-${tel.slice(7)}`;
  if (/^0[2-8]\d{8}$/.test(tel)) return `${tel.slice(0, 2)}-${tel.slice(2, 6)}-${tel.slice(6)}`;
  return tel;
}

function slugify(name) {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s || null;
}

function creditFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return `圖片來源 ${host}`;
  } catch {
    return null;
  }
}

// ---------- 圖片收攏 ----------

const SELF_HOST = 'chadyuch.github.io';

async function resolvePhoto(id, raw) {
  const value = clean(raw);
  if (!value) return { photo: null, credit: null, note: '無圖片' };

  const target = join(root, 'images', `${id}.jpg`);
  const relative = `images/${id}.jpg`;

  // 本機路徑（例如 Google Drive 的 Pics 資料夾）
  if (/^[a-zA-Z]:[\\/]/.test(value)) {
    if (!existsSync(value)) return { photo: null, credit: null, note: `本機檔案不存在：${value}` };
    copyFileSync(value, target);
    return { photo: relative, credit: CREDIT_BY_ID[id] ?? null, note: '由本機複製' };
  }

  // 指回本站的網址，代表圖片已經在 repo 裡，不用重抓
  if (value.includes(SELF_HOST)) {
    if (!existsSync(target)) return { photo: null, credit: null, note: `本站圖片不存在：${relative}` };
    return { photo: relative, credit: CREDIT_BY_ID[id] ?? null, note: '沿用既有' };
  }

  // 外站圖片一律下載進 repo，避免對方擋 referrer 或刪檔造成開天窗
  if (/^https?:\/\//.test(value)) {
    if (existsSync(target) && CREDIT_BY_ID[id]) {
      return { photo: relative, credit: CREDIT_BY_ID[id], note: '沿用既有' };
    }
    const res = await fetch(value, { headers: { 'User-Agent': UA, Referer: new URL(value).origin } });
    if (!res.ok) return { photo: null, credit: null, note: `下載失敗 HTTP ${res.status}` };
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    return { photo: relative, credit: CREDIT_BY_ID[id] ?? creditFromUrl(value), note: '已下載' };
  }

  return { photo: null, credit: null, note: `無法辨識的圖片來源：${value}` };
}

// ---------- 主流程 ----------

const rows = readSheet(SOURCE);
const header = rows[0].map(clean);
const col = (name) => header.indexOf(name);

const iName = col('店名');
const iLink = col('連結');
const iPhoto = col('圖片網址');
const iBooking = col('預約');
const iTel = col('Tel');
const iAddress = col('地址');

for (const [label, idx] of [['店名', iName], ['連結', iLink], ['圖片網址', iPhoto], ['預約', iBooking], ['Tel', iTel], ['地址', iAddress]]) {
  if (idx < 0) throw new Error(`xlsx 缺少「${label}」欄位`);
}

const stores = [];
const seen = new Set();

for (const row of rows.slice(1)) {
  const name = clean(row[iName]);
  if (!name) continue;

  const id = ID_BY_NAME[name] ?? slugify(name);
  if (!id) throw new Error(`「${name}」無法產生 id，請在 ID_BY_NAME 補上對應`);
  if (seen.has(id)) throw new Error(`id 重複：${id}`);
  seen.add(id);

  const address = clean(row[iAddress]);
  const tel = cleanTel(row[iTel]);
  const { photo, credit, note } = await resolvePhoto(id, row[iPhoto]);

  stores.push({
    id,
    name,
    address: address || null,
    tel: tel || null,
    telDisplay: tel ? formatTel(tel) : null,
    navQuery: address ? `${name} ${address}` : name,
    link: clean(row[iLink]) || null,
    booking: clean(row[iBooking]) || null,
    photo,
    photoCredit: credit,
  });

  console.log(`  ${name.padEnd(24)} id=${id.padEnd(20)} 圖片：${note}`);
}

writeFileSync(join(root, 'stores.json'), `${JSON.stringify(stores, null, 2)}\n`, 'utf-8');
console.log(`\n✓ 已寫入 stores.json（${stores.length} 家）`);
