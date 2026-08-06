/**
 * 开发用静态服务。Node 自带模块，零依赖。
 *
 * 存在的理由：python3 -m http.server 不发 no-cache 头，改完 ES module 或
 * registry.json 后浏览器拿 304 继续用旧的，改动看不见（还会新旧混着跑）。
 *
 *   node scripts/serve.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let rel = normalize(urlPath.replace(/^\/+/, ''));
  // 目录请求补 index.html，让 / 和 /toys/chladni/ 这种能直接开
  if (rel === '' || rel === '.' || urlPath.endsWith('/')) rel = join(rel, 'index.html');

  const file = join(ROOT, rel);
  // normalize + 前缀校验，挡掉 ../ 穿越
  if (!file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      // 开发期一律不缓存，省掉每次改完还要硬刷
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`vibe → http://localhost:${PORT}`);
});
