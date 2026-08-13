// 驗證 stores.json 的結構正確性與參照完整性。
// 這個專案沒有測試框架（零依賴原則），這支腳本就是資料層的測試。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(msg) {
  errors.push(msg);
}

let stores;
try {
  stores = JSON.parse(readFileSync(join(root, 'stores.json'), 'utf-8'));
} catch (e) {
  console.error(`✗ 無法讀取或解析 stores.json：${e.message}`);
  process.exit(1);
}

if (!Array.isArray(stores)) {
  console.error('✗ stores.json 最外層必須是陣列');
  process.exit(1);
}

const REQUIRED = ['id', 'name', 'navQuery'];
const OPTIONAL = ['address', 'tel', 'telDisplay', 'link', 'booking', 'photo', 'photoCredit'];
const ALLOWED = new Set([...REQUIRED, ...OPTIONAL]);
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const seen = new Set();

stores.forEach((store, i) => {
  const label = `第 ${i + 1} 筆`;

  if (typeof store !== 'object' || store === null || Array.isArray(store)) {
    fail(`${label}：必須是物件`);
    return;
  }

  for (const key of Object.keys(store)) {
    if (!ALLOWED.has(key)) fail(`${label}：出現未定義欄位 "${key}"`);
  }

  for (const key of REQUIRED) {
    if (typeof store[key] !== 'string' || store[key].trim() === '') {
      fail(`${label}：必填欄位 "${key}" 缺漏或不是非空字串`);
    }
  }

  for (const key of OPTIONAL) {
    if (key in store && store[key] !== null && typeof store[key] !== 'string') {
      fail(`${label}：選填欄位 "${key}" 必須是字串或 null`);
    }
  }

  if (typeof store.id === 'string') {
    if (!ID_PATTERN.test(store.id)) {
      fail(`${label}：id "${store.id}" 必須是小寫英數與連字號（kebab-case）`);
    }
    if (seen.has(store.id)) {
      fail(`${label}：id "${store.id}" 重複，localStorage 會互相覆蓋`);
    }
    seen.add(store.id);
  }

  if (typeof store.photo === 'string' && store.photo.trim() !== '') {
    if (!store.photo.startsWith('images/')) {
      fail(`${label}：photo "${store.photo}" 必須放在 images/ 之下`);
    } else if (!existsSync(join(root, store.photo))) {
      fail(`${label}：photo "${store.photo}" 檔案不存在`);
    }
  }

  for (const key of ['link', 'booking']) {
    const v = store[key];
    if (typeof v === 'string' && v.trim() !== '' && !/^https?:\/\//.test(v)) {
      fail(`${label}：${key} "${v}" 必須是 http(s) 開頭的網址`);
    }
  }

  if (typeof store.tel === 'string' && store.tel.trim() !== '') {
    if (!/^[\d+]{8,15}$/.test(store.tel)) {
      fail(`${label}：tel "${store.tel}" 應該是 8-15 位數字（Excel 的前置單引號要清掉）`);
    }
    if (!store.telDisplay) fail(`${label}：有 tel 就必須有 telDisplay`);
  }
});

if (errors.length > 0) {
  console.error('✗ stores.json 驗證失敗：');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ stores.json 通過驗證（${stores.length} 家）`);
