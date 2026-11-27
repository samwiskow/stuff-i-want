import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { load } from 'cheerio';
import ipaddr from 'ipaddr.js';

export const imageLimit = 4 * 1024 * 1024;
const imageTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

export function webUrl(input) {
  try {
    const url = new URL(input);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.port) {
      url.hash = '';
      return url;
    }
  } catch {}
  throw new Error('Enter a public product or image link that starts with http or https.');
}

export function canonicalProduct(input) {
  const url = webUrl(input);
  const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i);
  if (/(^|\.)amazon\.co\.uk$/i.test(url.hostname) && asin) {
    return new URL('https://www.amazon.co.uk/dp/' + asin[1].toUpperCase() + '/');
  }
  for (const name of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(name) || ['fbclid', 'gclid'].includes(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  return url;
}

export async function readBytes(stream, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of stream) {
    length += chunk.length;
    if (length > limit) throw new Error('The file is larger than the importer can read.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchPage(input, limit, accept) {
  let url = webUrl(input);
  const signal = AbortSignal.timeout(12_000);
  for (let hop = 0; hop < 5; hop++) {
    const addresses = await lookup(url.hostname, { family: 4, all: true });
    const address = addresses.find(({ address }) => ipaddr.parse(address).range() === 'unicast');
    if (!address || addresses.some(({ address }) => ipaddr.parse(address).range() !== 'unicast')) {
      throw new Error('The importer can only visit public websites.');
    }
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const response = await new Promise((resolve, reject) => {
      const req = send(url, {
        signal,
        family: 4,
        autoSelectFamily: false,
        lookup: (_name, _options, callback) => callback(null, address.address, 4),
        headers: { Accept: accept, 'User-Agent': 'Stuff-I-Want/1.0 (personal wishlist editor)' }
      }, resolve);
      req.on('error', reject);
      req.end();
    });
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      response.destroy();
      url = webUrl(new URL(response.headers.location, url));
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.destroy();
      throw new Error(`The shop returned HTTP ${response.statusCode}.`);
    }
    return { url, contentType: response.headers['content-type'] || '', bytes: await readBytes(response, limit) };
  }
  throw new Error('The shop redirected too many times.');
}

export function photoType(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return 'gif';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (bytes.toString('ascii', 4, 12) === 'ftypavif') return 'avif';
  throw new Error('Use a JPEG, PNG, WebP, GIF or AVIF image, up to 4 MB.');
}

export async function inspectPhoto(input) {
  const { url, bytes } = await fetchPage(input, imageLimit, 'image/*');
  const extension = photoType(bytes);
  return { sourceUrl: url.href, preview: `data:${imageTypes[extension]};base64,${bytes.toString('base64')}` };
}

function elements(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function flatten(value) {
  return elements(value).flatMap(node => node && typeof node === 'object'
    ? [node, ...flatten(node['@graph']), ...flatten(node.mainEntity), ...flatten(node.hasVariant)]
    : []);
}

function imageUrl(value, pageUrl) {
  const image = elements(value)[0];
  const candidate = typeof image === 'string' ? image : image?.url || image?.contentUrl;
  if (!candidate) return '';
  try {
    return webUrl(new URL(candidate, pageUrl)).href;
  } catch {
    return '';
  }
}

function gbp(value, currency) {
  if (value == null || String(currency).toUpperCase() !== 'GBP') return null;
  const clean = String(value).trim().replace(/^£\s*/, '').replace(/,(?=\d{3}(?:\D|$))/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

export function parseProduct(html, pageUrl) {
  const $ = load(html);
  const meta = name => $('meta').filter((_, item) => (
    $(item).attr('property') === name || $(item).attr('name') === name || $(item).attr('itemprop') === name
  )).first().attr('content');
  const products = $('script[type="application/ld+json"]').toArray().flatMap(tag => {
    try {
      return flatten(JSON.parse($(tag).text())).filter(entity =>
        elements(entity['@type']).some(type => /(?:^|\/)Product$/.test(type)));
    } catch {
      return [];
    }
  });
  const variant = pageUrl.searchParams.get('variant');
  const sameVariant = value => {
    if (!value) return false;
    try {
      return new URL(value, pageUrl).searchParams.get('variant') === variant;
    } catch {
      return false;
    }
  };
  const selected = variant ? products.find(product => sameVariant(product.url) ||
    elements(product.offers).some(offer => sameVariant(offer.url))) : products[0];
  const offer = variant
    ? elements(selected?.offers).find(value => sameVariant(value.url))
    : elements(selected?.offers).find(value => value.price != null || value.priceSpecification?.price != null);
  const title = String(selected?.name || $('#productTitle').first().text().trim() ||
    meta('og:title') || $('title').first().text()).replace(/\s+/g, ' ').trim();
  if (/^(just a moment|robot check|access denied|request blocked|site is unavailable|error)/i.test(title)) {
    throw new Error('The shop did not return a product page.');
  }
  const currency = offer?.priceCurrency || offer?.priceSpecification?.priceCurrency ||
    meta('product:price:currency') || meta('og:price:currency') || meta('priceCurrency');
  const amount = offer?.price ?? offer?.priceSpecification?.price ?? (
    variant && products.length && !selected ? null : meta('product:price:amount') || meta('og:price:amount') || meta('price')
  );
  const ukPrice = !variant && $('#corePrice_feature_div .a-offscreen, #apex_desktop .a-offscreen').first().text().trim();
  const priceGBP = gbp(amount, currency) ?? (ukPrice && ukPrice.startsWith('£') ? gbp(ukPrice, 'GBP') : null);
  return {
    title: title.slice(0, 280),
    priceGBP,
    imageUrl: imageUrl(selected?.image || $('#landingImage').attr('data-old-hires') ||
      $('#landingImage').attr('src') || meta('og:image') || meta('twitter:image'), pageUrl),
    note: variant && !selected ? 'Check that the details match the selected variant.' :
      currency && String(currency).toUpperCase() !== 'GBP' ? `The shop supplied a ${currency} price. Enter a price in pounds if you know it.` : ''
  };
}

export async function inspectProduct(input) {
  const original = canonicalProduct(input);
  const { url, bytes, contentType } = await fetchPage(original, 6 * 1024 * 1024, 'text/html');
  if (!/html/i.test(contentType)) throw new Error('The link did not return a product page.');
  return { url: canonicalProduct(url).href, ...parseProduct(bytes.toString('utf8'), url) };
}
