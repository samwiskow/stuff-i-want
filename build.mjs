import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const file = path => new URL(path, import.meta.url);
const draft = JSON.parse(await readFile(file('wishlist-draft.json'), 'utf8'));
const items = draft.items.filter(item => item.title && item.category && item.preview !== false);
const formatPrice = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: 0
});
const featured = items.filter(item => item.featured).sort((a, b) => a.featured - b.featured);
const shelves = Map.groupBy(items, item => item.category);

function escape(value = '') {
  return String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function price(item) {
  if (item.amountsGBP?.length) return 'From ' + formatPrice.format(Math.min(...item.amountsGBP));
  if (item.priceGBP != null) return 'About ' + formatPrice.format(item.priceGBP);
  return '';
}

function image(item, hero = false) {
  if (!item.image) return '';
  const { file: name, kind, fit } = item.image;
  const label = kind === 'generated' ? 'Generated illustration' : item.image.label;
  return `<div class="product-media${fit === 'contain' ? ' product-media--contain' : ''}">
    <img src="images/${escape(name)}" alt="" ${hero ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    ${label ? `<span class="image-note">${escape(label)}</span>` : ''}
  </div>`;
}

function productName(item) {
  const url = item.url || item.referenceUrl;
  return url ? `<a href="${escape(url)}">${escape(item.title)}</a>` : escape(item.title);
}

function featuredCard(item, index) {
  return `<article class="feature-card feature-card--${index + 1}">
    ${image(item, index === 0)}
    <div class="feature-caption">
      <div><h2>${productName(item)}</h2><p>${escape(item.category)}</p></div>
      ${price(item) ? `<span class="price">${escape(price(item))}</span>` : ''}
    </div>
  </article>`;
}

function shelfCard(item) {
  const values = item.amountsGBP || (item.priceGBP == null ? [] : [item.priceGBP]);
  const shop = item.alternateShop;
  return `<article class="product-card" data-prices="${values.join(',')}" data-flexible="${Boolean(item.amountsGBP)}" data-suggest="${item.suggest !== false}">
    ${image(item)}
    <div class="product-text">
      <h3>${productName(item)}</h3>
      ${item.variant ? `<p class="variant">${escape(item.variant)}</p>` : ''}
      ${item.notes ? `<p class="item-notes">${escape(item.notes)}</p>` : ''}
      ${price(item) ? `<p class="price">${escape(price(item))}</p>` : ''}
      ${shop ? `<p class="alternate-shop">Also at <a href="${escape(shop.url)}">${escape(shop.name)}</a></p>` : ''}
    </div>
  </article>`;
}

function shelf(category, products) {
  return `<section class="shelf" data-category="${escape(category)}">
    <h2>${escape(category)}</h2>
    <div class="shelf-grid">${products.map(shelfCard).join('')}</div>
  </section>`;
}

const controls = `<form id="gift-filters" class="gift-filters" role="search" aria-label="Find a gift" hidden>
  <label class="search-field"><span>Search</span><input type="search" name="search" placeholder="Search the list"></label>
  <label><span>Category</span><select name="category">
    <option value="">All categories</option>${[...shelves.keys()].map(category =>
      `<option>${escape(category)}</option>`).join('')}
  </select></label>
  <label><span>Budget</span><select name="budget">
    <option value="">Any budget</option><option value="under-5">Under £5</option>
    <option value="under-10">Under £10</option><option value="10-50">£10 to £50</option>
    <option value="under-100">Under £100</option><option value="big">Big gifts (£100+)</option>
  </select></label>
  <button type="button" id="pick-gift">Give me a suggestion</button>
</form>`;
const markup = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="A personal wishlist for birthdays, Christmas, and just because.">
<title>Stuff I want</title>
<link rel="stylesheet" href="wishlist.css">
<script src="wishlist.js" defer></script>
</head>
<body>
<main id="wishlist" class="wishlist">
  <header class="masthead">
    <h1>Stuff I want</h1>
    <p>Ideas for birthdays, Christmas and just because.</p>
  </header>
  ${controls}
  <p class="shopping-note">Prices are a guide. Links are just suggestions to stores. Compare prices and delivery costs before buying.</p>
  <div id="gift-suggestion" class="gift-suggestion" aria-live="polite"></div>
  <section class="feature-gallery" aria-label="Featured wishlist items">
    ${featured.map(featuredCard).join('')}
  </section>
  <div id="results-info" class="results-info" role="status"></div>
  <div id="gift-shelves">${[...shelves].map(([category, entries]) => shelf(category, entries)).join('')}</div>
  <div class="empty-results" hidden><h2>No matching gifts</h2><p>Try another search, category or budget.</p><button type="button" id="clear-filters">Clear filters</button></div>
</main>
</body>
</html>
`;

await mkdir(file('dist/'), { recursive: true });
await Promise.all([
  writeFile(file('dist/index.html'), markup),
  cp(file('wishlist.css'), file('dist/wishlist.css')),
  cp(file('wishlist.js'), file('dist/wishlist.js')),
  cp(file('assets/images/'), file('dist/images/'), { recursive: true })
]);
