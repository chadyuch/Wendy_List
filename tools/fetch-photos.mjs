// 從 stores.json 中的 Instagram 連結取得 og:image 並存入 images/。
// 僅供一次性素材蒐集使用，不隨頁面載入。
//
//   node tools/fetch-photos.mjs
//
// 註：Instagram 只對爬蟲 UA 提供 og 標籤，一般瀏覽器 UA 會被導向登入牆。
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'facebookexternalhit/1.1';

const stores = JSON.parse(await readFile(join(root, 'stores.json'), 'utf-8'));

for (const store of stores) {
  if (!store.instagram) {
    console.log(`- ${store.id}：無 Instagram 連結，略過`);
    continue;
  }

  try {
    const page = await fetch(store.instagram, { headers: { 'User-Agent': UA } });
    const html = await page.text();

    const match = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (!match) {
      console.log(`✗ ${store.id}：找不到 og:image`);
      continue;
    }

    const imageUrl = match[1].replace(/&amp;/g, '&');
    const res = await fetch(imageUrl, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      console.log(`✗ ${store.id}：圖片下載失敗 HTTP ${res.status}`);
      continue;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const target = join(root, 'images', `${store.id}.jpg`);
    await writeFile(target, buffer);

    const author = html.match(/comments - ([a-zA-Z0-9._]+) on/);
    console.log(
      `✓ ${store.id}：${(buffer.length / 1024).toFixed(0)}KB` +
      (author ? `　作者 @${author[1]}` : '')
    );
  } catch (e) {
    console.log(`✗ ${store.id}：${e.message}`);
  }
}
