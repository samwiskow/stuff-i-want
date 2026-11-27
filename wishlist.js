(() => {
  const form = document.getElementById('gift-filters');
  const search = form.elements.search;
  const category = form.elements.category;
  const budget = form.elements.budget;
  const gallery = document.querySelector('.feature-gallery');
  const normalize = text => text.toLowerCase().replace(/(\d)\s+(?=(mm|cm|ghz)\b)/g, '$1');
  const shelves = [...document.querySelectorAll('.shelf')].map(section => ({
    section,
    category: section.dataset.category,
    cards: [...section.querySelectorAll('.product-card')].map(element => ({
      element,
      heading: element.querySelector('h3'),
      priceText: element.querySelector('.price'),
      text: normalize(section.dataset.category + ' ' + element.querySelector('.product-text').textContent),
      prices: element.dataset.prices.split(',').filter(Boolean).map(Number),
      flexible: element.dataset.flexible === 'true',
      suggest: element.dataset.suggest === 'true'
    }))
  }));
  const suggestion = document.getElementById('gift-suggestion');
  const resultsInfo = document.getElementById('results-info');
  const empty = document.querySelector('.empty-results');
  const format = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 0
  });
  const ranges = {
    'under-5': price => price < 5,
    'under-10': price => price < 10,
    '10-50': price => price >= 10 && price <= 50,
    'under-100': price => price < 100,
    big: price => price >= 100
  };
  let matches = [];
  let lastPick;

  function render() {
    const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    const range = ranges[budget.value];
    const filtered = Boolean(words.length || category.value || range);
    matches = [];
    for (const shelf of shelves) {
      let shown = 0;
      for (const card of shelf.cards) {
        const prices = range ? card.prices.filter(range) : card.prices;
        const visible = (!category.value || shelf.category === category.value)
          && words.every(word => card.text.includes(word))
          && (!range || prices.length > 0);
        card.element.hidden = !visible;
        if (!visible) continue;
        if (card.flexible && card.priceText) {
          card.priceText.textContent = (prices.length > 1 ? 'From ' : '') + format.format(Math.min(...prices));
        }
        shown++;
        matches.push({ card, prices });
      }
      shelf.section.hidden = shown === 0;
    }
    gallery.hidden = filtered;
    empty.hidden = matches.length > 0;
    resultsInfo.textContent = filtered && matches.length
      ? `${matches.length} ${matches.length === 1 ? 'matching idea' : 'matching ideas'}`
      : '';
    suggestion.replaceChildren();
    lastPick = undefined;
  }

  form.addEventListener('input', render);
  form.addEventListener('submit', event => event.preventDefault());
  document.getElementById('clear-filters').addEventListener('click', () => {
    form.reset();
    render();
    search.focus();
  });

  document.getElementById('pick-gift').addEventListener('click', () => {
    const eligible = matches.filter(({ card, prices }) => card.suggest && prices.length);
    const alternatives = eligible.filter(({ card }) => card !== lastPick);
    const pool = alternatives.length ? alternatives : eligible;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) {
      suggestion.textContent = 'No priced gift matches these filters. Try a different budget or category.';
      return;
    }

    lastPick = pick.card;
    const media = pick.card.element.querySelector('.product-media')?.cloneNode(true);
    if (media) media.querySelector('img').loading = 'eager';
    const detail = document.createElement('div');
    detail.className = 'suggestion-detail';
    const title = document.createElement('h2');
    title.textContent = 'Gift suggestion';
    const name = document.createElement('p');
    name.className = 'suggestion-name';
    for (const child of pick.card.heading.childNodes) name.append(child.cloneNode(true));
    const amount = document.createElement('p');
    amount.className = 'price';
    amount.textContent = (pick.card.flexible ? '' : 'About ') + format.format(Math.min(...pick.prices));
    detail.append(title, name, amount);
    suggestion.replaceChildren(...(media ? [media, detail] : [detail]));
  });

  form.hidden = false;
  render();
})();
