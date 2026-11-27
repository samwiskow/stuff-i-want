import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { canonicalProduct, imageLimit, inspectPhoto, inspectProduct, photoType, readBytes, webUrl } from './product-import.mjs';

const urlAt = path => new URL(path, import.meta.url);
const catalogue = urlAt('../wishlist-draft.json');
const loadCatalogue = async () => JSON.parse(await readFile(catalogue, 'utf8'));
const port = 4181;
const origin = `http://127.0.0.1:${port}`;
const pages = new Map([
  ['/', ['add-item.html', 'text/html; charset=utf-8']],
  ['/editor.js', ['add-item.js', 'text/javascript; charset=utf-8']],
  ['/editor.css', ['add-item.css', 'text/css; charset=utf-8']],
  ['/wishlist.css', ['../wishlist.css', 'text/css; charset=utf-8']]
]);

function line(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

async function saveItem(form) {
  const draft = await loadCatalogue();
  const url = canonicalProduct(form.url).href;
  if (draft.items.some(item => item.url && canonicalProduct(item.url).href === url)) {
    throw new Error('This link is already in the list. Edit that entry in wishlist-draft.json.');
  }
  const title = line(form.title, 280);
  const category = line(form.category, 80);
  if (!title || !category) throw new Error('Enter a name and category.');
  const slug = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 65) || 'gift';
  let id = slug;
  for (let suffix = 2; draft.items.some(item => item.id === id); suffix++) id = `${slug}-${suffix}`;
  const item = { id, title, category, url };
  const price = line(form.price, 20);
  if (price) {
    if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(price)) throw new Error('Enter a price in pounds, such as 12.50.');
    item.priceGBP = Number(price);
    item.priceSource = url;
  }
  const variant = line(form.variant, 180);
  const notes = line(form.notes, 1000);
  if (variant) item.variant = variant;
  if (notes) item.notes = notes;
  if (!form.suggest) item.suggest = false;

  const token = randomUUID();
  let imagePath;
  let imageWritten = false;
  const temporary = urlAt(`../wishlist-draft.json.${token}.tmp`);
  try {
    if (form.photo) {
      const encoded = String(form.photo).match(/^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)$/);
      if (!encoded) throw new Error('Preview the photo before saving.');
      const bytes = Buffer.from(encoded[1], 'base64');
      if (bytes.length > imageLimit) throw new Error('Use a photo up to 4 MB.');
      const extension = photoType(bytes);
      const filename = `${id}-${token.slice(0, 8)}.${extension}`;
      imagePath = urlAt('../assets/images/' + filename);
      item.image = { file: filename, kind: 'source' };
      if (form.photoSource) item.image.sourceUrl = webUrl(form.photoSource).href;
      await writeFile(imagePath, bytes, { flag: 'wx' });
      imageWritten = true;
    }
    draft.items.push(item);
    await writeFile(temporary, JSON.stringify(draft, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, catalogue);
    return item;
  } catch (error) {
    await rm(temporary, { force: true });
    if (imageWritten) await rm(imagePath, { force: true });
    throw error;
  }
}

if (process.argv[2] === '--inspect') {
  try {
    console.log(JSON.stringify(await inspectProduct(process.argv[3]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  let saves = Promise.resolve();
  function reply(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(data));
  }

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'");
    if (request.headers.host !== new URL(origin).host) return reply(response, 403, { error: 'Use the editor address printed in the terminal.' });
    try {
      if (request.method === 'GET' && pages.has(request.url)) {
        const [name, type] = pages.get(request.url);
        const body = await readFile(urlAt(name));
        response.writeHead(200, { 'Content-Type': type });
        return response.end(body);
      }
      if (request.method === 'GET' && request.url === '/categories') {
        const { items } = await loadCatalogue();
        return reply(response, 200, { categories: [...new Set(items.map(item => item.category).filter(Boolean))].sort() });
      }
      if (request.method !== 'POST' || !['/inspect','/photo','/save'].includes(request.url)) {
        return reply(response, 404, { error: 'Page not found.' });
      }
      if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') {
        return reply(response, 403, { error: 'Open the editor on this Mac before changing the list.' });
      }
      const form = JSON.parse((await readBytes(request, 6 * 1024 * 1024)).toString('utf8'));
      if (request.url === '/inspect') return reply(response, 200, await inspectProduct(form.url));
      if (request.url === '/photo') return reply(response, 200, await inspectPhoto(form.url));
      const currentSave = saves.then(() => saveItem(form));
      saves = currentSave.catch(() => {});
      return reply(response, 201, { item: await currentSave });
    } catch (error) {
      return reply(response, 400, { error: error.message });
    }
  });
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `The editor is already running at ${origin}` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Wishlist editor: ${origin}`));
}
