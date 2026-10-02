// Generates the static site in public/ from content/content.json.
// Usage: node scripts/build.mjs  (or npm run build)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import subsetFont from 'subset-font';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const SITE = 'https://jana-nagyova.cz';
const c = JSON.parse(readFileSync(join(root, 'content/content.json'), 'utf8'));
const YEAR = new Date().getFullYear();

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const t = (v, lang) => (v && typeof v === 'object' ? v[lang] ?? '' : v ?? '');
const out = (rel, data) => {
  const p = join(pub, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
};

// non-breaking spaces: Czech one-letter prepositions and conjunctions, "9. ledna", "D. H."
const NB = '\u00a0';
function glue(s, lang) {
  s = String(s ?? '');
  if (lang === 'cs' || lang === 'sk') s = s.replace(/(^|[\s(„–])([kvszouaiKVSZOUAI]) /g, `$1$2${NB}`);
  return s
    .replace(/(^|\D)(\d{1,2}\.) (?=\p{L})/gu, `$1$2${NB}`)
    .replace(/(^|\P{L})(\p{Lu}\.) (?=\p{Lu}\.)/gu, `$1$2${NB}`);
}
const tx = (s, lang) => esc(glue(s, lang));

/* ---------- UI strings ---------- */
const L = {
  cs: {
    skip: 'Přeskočit na obsah', menu: 'Menu', menuClose: 'Zavřít', close: 'Zavřít',
    nav: { about: 'Životopis', highlights: 'Role', filmography: 'Filmografie', news: 'Aktuálně', gallery: 'Fotografie', contact: 'Kontakt' },
    other: 'de', otherLabel: 'Deutsch', otherHref: '/de/',
    filterAll: 'Vše', filterFilm: 'Film', filterTv: 'Televize', filterStage: 'Divadlo, hudba, nahrávky',
    types: { 'film': 'film', 'tv-serie': 'seriál', 'tv-film': 'televizní film', 'auftritt': 'televizní pořad', 'theater': 'divadlo', 'synchron': 'dabing', 'musik': 'hudba', 'hoerspiel': 'audiodrama', 'moderation': 'moderování', 'sonstiges': 'ostatní' },
    director: 'režie', facts: 'Údaje', skills: 'Dovednosti', press: 'Z recenzí', translatedShort: 'přeloženo',
    photo: 'Foto', credits: 'Fotografie', photoPrev: 'Předchozí fotografie', photoNext: 'Další fotografie', source: 'Zdroj',
    agency: 'Zastoupení', agent: 'Agentka', email: 'E-mail', phone: 'Telefon', web: 'Agentura',
    count: (n) => `${n} titulů`,
    decade: (d) => (d < 2000 ? `${String(d).slice(2)}. léta` : `${d}–${Math.min(d + 9, YEAR)}`),
    timeline: 'Každý čtvereček představuje jeden titul, sloupce odpovídají rokům. Klepnutím na rok zobrazíte jeho tituly.',
    yearTitles: (y, n) => `${y}: ${n} ${n === 1 ? 'titul' : n < 5 ? 'tituly' : 'titulů'}`,
    year: 'Rok', clear: 'zobrazit vše',
    legend: { film: 'film', tv: 'televize', stage: 'divadlo, hudba, nahrávky' },
    scenes: 'Scény papírového divadla', sceneOf: (i, n, name) => `Scéna ${i} z ${n}: ${name}`,
    sub: 'herečka',
    jobTitle: 'Herečka', navLabel: 'Hlavní navigace', langLabel: 'Jazyk',
  },
  de: {
    skip: 'Zum Inhalt springen', menu: 'Menü', menuClose: 'Schließen', close: 'Schließen',
    nav: { about: 'Biografie', highlights: 'Rollen', filmography: 'Filmografie', news: 'Aktuell', gallery: 'Fotos', contact: 'Kontakt' },
    other: 'cs', otherLabel: 'Česky', otherHref: '/',
    filterAll: 'Alle', filterFilm: 'Film', filterTv: 'Fernsehen', filterStage: 'Bühne, Musik, Sprechrollen',
    types: { 'film': 'Film', 'tv-serie': 'Serie', 'tv-film': 'Fernsehfilm', 'auftritt': 'Fernsehauftritt', 'theater': 'Theater', 'synchron': 'Synchron', 'musik': 'Musik', 'hoerspiel': 'Hörspiel', 'moderation': 'Moderation', 'sonstiges': 'Sonstiges' },
    director: 'Regie', facts: 'Angaben', skills: 'Fähigkeiten', press: 'Aus den Kritiken', translatedShort: 'übersetzt',
    photo: 'Foto', credits: 'Fotos', photoPrev: 'Vorheriges Foto', photoNext: 'Nächstes Foto', source: 'Quelle',
    agency: 'Vertretung', agent: 'Agentin', email: 'E-Mail', phone: 'Telefon', web: 'Agentur',
    count: (n) => `${n} Titel`,
    decade: (d) => `${d}er`,
    timeline: 'Jedes Kästchen steht für einen Titel, jede Spalte für ein Jahr. Ein Klick auf ein Jahr zeigt seine Titel.',
    yearTitles: (y, n) => `${y}: ${n} Titel`,
    year: 'Jahr', clear: 'alle zeigen',
    legend: { film: 'Film', tv: 'Fernsehen', stage: 'Bühne, Musik, Sprechrollen' },
    scenes: 'Szenen des Papiertheaters', sceneOf: (i, n, name) => `Szene ${i} von ${n}: ${name}`,
    sub: 'Schauspielerin',
    jobTitle: 'Schauspielerin', navLabel: 'Hauptnavigation', langLabel: 'Sprache',
  },
};

const group = (type) => (type === 'film' ? 'film' : type.startsWith('tv') || type === 'auftritt' ? 'tv' : 'stage');
const firstYear = (y) => Number(String(y).match(/\d{4}/)[0]);

function picture(p, lang, sizes) {
  const base = `/img/jana-nagyova-${p.id}`;
  return `<picture>
          <source type="image/webp" srcset="${base}-640.webp 640w, ${base}-1200.webp 1200w" sizes="${sizes}">
          <img src="${base}-640.jpg" srcset="${base}-640.jpg 640w, ${base}-1200.jpg 1200w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(t(p.alt, lang))}" loading="lazy" decoding="async">
        </picture>`;
}

function titleFor(item, lang) {
  const localized = lang === 'de' ? item.title_de : item.title_cs;
  return localized || item.title_original;
}

function creditRow(item, lang, s) {
  const title = titleFor(item, lang);
  const orig = title !== item.title_original ? ` <span class="credit__orig">${esc(item.title_original)}</span>` : '';
  const role = t(item.role, lang);
  const meta = [
    role ? `<span>${tx(role, lang)}</span>` : '',
    item.director ? `<span>${esc(s.director)} ${esc(item.director)}</span>` : '',
    `<span>${esc(s.types[item.type] || '')}</span>`,
  ].filter(Boolean).join('<span class="sep" aria-hidden="true"> · </span>');
  return `<li class="credit" data-group="${group(item.type)}" data-year="${firstYear(item.year)}">
              <span class="credit__year">${esc(item.year)}</span>
              <span class="credit__title">${esc(title)}${orig}</span>
              <span class="credit__meta">${meta}</span>
            </li>`;
}

// one column per year from the first credit to now; each title is a square
function timeline(all, lang, s) {
  const from = Math.min(...all.map((i) => firstYear(i.year)));
  const to = YEAR;
  const byYear = new Map();
  for (const i of all) {
    const y = firstYear(i.year);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(group(i.type));
  }
  const order = { film: 0, tv: 1, stage: 2 };
  let cols = '';
  for (let y = from; y <= to; y++) {
    const g = (byYear.get(y) || []).sort((a, b) => order[a] - order[b]);
    const pos = `--col:${y - from + 1};--mcol:${(y % 10) + 1};--mrow:${Math.floor(y / 10) - Math.floor(from / 10) + 1}`;
    const label = y % 10 === 0 || y === from ? `<span class="tl-label">${y}</span>` : '';
    cols += g.length
      ? `<button type="button" class="tl-year" data-year="${y}" style="${pos}" aria-label="${esc(s.yearTitles(y, g.length))}">${g.map((x) => `<span class="tl-sq tl-${x}"></span>`).join('')}${label}</button>`
      : `<span class="tl-year tl-empty" style="${pos}" aria-hidden="true">${label}</span>`;
  }
  return `<figure class="timeline">
        <div class="timeline__grid" style="--years:${to - from + 1};--stack:${Math.max(...[...byYear.values()].map((v) => v.length))}">${cols}</div>
        <figcaption>${esc(s.timeline)}<span class="tl-legend"><span class="tl-key"><span class="tl-sq tl-film"></span>${esc(s.legend.film)}</span><span class="tl-key"><span class="tl-sq tl-tv"></span>${esc(s.legend.tv)}</span><span class="tl-key"><span class="tl-sq tl-stage"></span>${esc(s.legend.stage)}</span></span></figcaption>
      </figure>`;
}

function formatDate(d, lang) {
  const [y, m] = String(d).split('-');
  if (!m) return y;
  const months = {
    cs: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
    de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  };
  return `${months[lang][Number(m) - 1]} ${y}`;
}

function page(lang) {
  const s = L[lang];
  const path = lang === 'cs' ? '/' : '/de/';
  const all = [...c.filmography, ...(c.stage || [])].sort((a, b) => b.sort - a.sort);
  const photos = c.photos;
  const photoById = Object.fromEntries(photos.map((p) => [p.id, p]));
  const portraits = c.portraits.map((p) => ({
    photo: p.photo, scene: p.scene, name: t(p.name, lang), label: t(p.label, lang), credit: t(p.photoLabel, lang),
    alt: t(photoById[p.photo].alt, lang),
  }));
  const first = portraits[0];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: c.meta.name, jobTitle: s.jobTitle,
    birthDate: c.meta.birthDate, birthPlace: c.meta.birthPlace, url: SITE + path,
    image: `${SITE}/img/jana-nagyova-01-1200.jpg`, sameAs: c.sameAs || [],
  };
  const navItems = Object.entries(s.nav).map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('');

  const decades = new Map();
  for (const i of all) {
    const d = Math.floor(firstYear(i.year) / 10) * 10;
    if (!decades.has(d)) decades.set(d, []);
    decades.get(d).push(i);
  }
  const decadeHtml = [...decades].map(([d, items]) => `<details class="decade" open>
          <summary><span class="decade__name">${esc(s.decade(d))}</span> <span class="decade__n">${esc(s.count(items.length))}</span></summary>
          <ul class="credits">
            ${items.map((i) => creditRow(i, lang, s)).join('\n            ')}
          </ul>
        </details>`).join('\n        ');

  const v = c.voice;
  const voiceOriginal = lang === 'cs';

  // Šampión carries the press blurbs
  const blurbs = (c.quotes || []).map((q) => {
    const original = lang === 'cs' ? ['cs', 'sk'].includes(q.lang) : q.lang === lang;
    const qlang = original ? q.lang : lang;
    const src = q.url ? `<a href="${esc(q.url)}" rel="noopener" target="_blank">${esc(q.source)}</a>` : esc(q.source);
    return `<li><q lang="${esc(qlang)}">${tx(original ? q.text_original : t(q.text, lang), qlang)}</q> <cite>${src}${!original ? ` (${esc(s.translatedShort)})` : ''}</cite></li>`;
  }).join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(t(c.meta.title, lang))}</title>
  <meta name="description" content="${esc(t(c.meta.description, lang))}">
  <meta name="theme-color" content="#2a1c16">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${SITE}${path}">
  <link rel="alternate" hreflang="cs" href="${SITE}/">
  <link rel="alternate" hreflang="de" href="${SITE}/de/">
  <link rel="alternate" hreflang="x-default" href="${SITE}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="Jana Nagyová">
  <meta property="og:title" content="${esc(t(c.meta.title, lang))}">
  <meta property="og:description" content="${esc(t(c.meta.description, lang))}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/img/jana-nagyova-01-1200.jpg">
  <meta property="og:image:alt" content="${esc(t(photoById['01'].alt, lang))}">
  <meta property="og:locale" content="${lang === 'cs' ? 'cs_CZ' : 'de_DE'}">
  <meta property="og:locale:alternate" content="${lang === 'cs' ? 'de_DE' : 'cs_CZ'}">
  <link rel="preload" href="/fonts/literata-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/img/figure/jana-${first.photo}-768.webp" as="image" type="image/webp" media="(max-resolution: 1.49dppx)" crossorigin>
  <link rel="preload" href="/img/figure/jana-${first.photo}-1280.webp" as="image" type="image/webp" media="(min-resolution: 1.5dppx)" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <script type="module" src="/js/ui.js"></script>
  <script type="module" src="/js/scene.js"></script>
</head>
<body>
  <a class="skip" href="#main">${esc(s.skip)}</a>

  <header class="top">
    <a class="top__brand" href="${path}">Jana Nagyová</a>
    <p class="top__lang" aria-label="${esc(s.langLabel)}">
      <a href="/" ${lang === 'cs' ? 'aria-current="page"' : 'lang="cs" hreflang="cs"'}><span aria-hidden="true">CS</span><span class="vh">Česky</span></a>
      <a href="/de/" ${lang === 'de' ? 'aria-current="page"' : 'lang="de" hreflang="de"'}><span aria-hidden="true">DE</span><span class="vh">Deutsch</span></a>
    </p>
    <nav class="top__nav" aria-label="${esc(s.navLabel)}">
      <button class="top__toggle" type="button" aria-expanded="false" aria-controls="nav-list" data-open="${esc(s.menu)}" data-close="${esc(s.menuClose)}">${esc(s.menu)}</button>
      <ul id="nav-list">${navItems}</ul>
    </nav>
  </header>

  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <h1 id="hero-title" class="hero__name">Jana Nagyová</h1>
      <div class="hero__stage">
        <canvas class="hero__canvas" aria-hidden="true" data-sub="${esc(s.sub)}"></canvas>
        <div class="hero__fallback">
          <img src="/img/figure/jana-${first.photo}-768.webp" alt="${esc(first.alt)}">
        </div>
      </div>
      <div class="hero__bar">
        <p class="hero__caption"><span class="hero__label">${esc(first.label)}</span> <span class="hero__credit">${esc(first.credit)}</span></p>
        <div class="hero__scenes" role="group" aria-label="${esc(s.scenes)}">
          ${portraits.map((p, i) => `<button type="button" data-index="${i}" aria-pressed="${i === 0}" aria-label="${esc(s.sceneOf(i + 1, portraits.length, p.name))}">${esc(p.name)}</button>`).join('\n          ')}
        </div>
        <p class="vh hero__live" aria-live="polite"></p>
      </div>
    </section>

    <figure class="subtitle">
      <blockquote>
        <p lang="${esc(v.lang)}">${tx(v.text_original, v.lang)}</p>
        ${voiceOriginal ? '' : `<p class="subtitle__tr" lang="${lang}">${tx(t(v.text, lang), lang)}</p>`}
      </blockquote>
      <figcaption><a href="${esc(v.url)}" rel="noopener" target="_blank">${tx(t(v.context, lang), lang)}</a></figcaption>
    </figure>

    <section class="block bio" id="about" aria-labelledby="about-title">
      <h2 id="about-title">${esc(s.nav.about)}</h2>
      <div class="block__body">
        <div class="bio__text">
          ${c.about[lang].map((p) => `<p>${tx(p, lang)}</p>`).join('\n          ')}
        </div>
        <dl class="facts" aria-label="${esc(s.facts)}">
          ${c.facts.map((f) => `<div><dt>${tx(t(f.label, lang), lang)}</dt><dd>${tx(t(f.value, lang), lang)}</dd></div>`).join('\n          ')}
          <div><dt>${esc(s.skills)}</dt><dd>${tx(c.skills.other[lang].join('; '), lang)}</dd></div>
        </dl>
      </div>
    </section>

    <section class="block roles" id="highlights" aria-labelledby="highlights-title">
      <h2 id="highlights-title">${esc(s.nav.highlights)}</h2>
      <ol class="block__body cast">
        ${c.highlights.map((h, i) => {
          const title = t(h.title, lang);
          return `<li class="cast__row${i === 0 ? ' cast__row--now' : ''}">
          <p class="cast__line"><span class="cast__role">${tx(t(h.role, lang), lang)}</span><span class="cast__dots" aria-hidden="true"></span><span class="cast__work"><cite>${esc(title)}</cite>${title !== h.original_title ? ` <span class="cast__orig">(${esc(h.original_title)})</span>` : ''}, ${esc(h.year)}</span></p>
          <p class="cast__note">${tx(t(h.text, lang), lang)}</p>
          ${i === 0 && blurbs ? `<ul class="cast__press" aria-label="${esc(s.press)}">${blurbs}</ul>` : ''}
        </li>`;
        }).join('\n        ')}
      </ol>
    </section>

    <section class="block films" id="filmography" aria-labelledby="filmography-title">
      <h2 id="filmography-title">${esc(s.nav.filmography)} <span class="films__count" aria-live="polite" data-count-template="${esc(s.count('{n}'))}">${esc(s.count(all.length))}</span></h2>
      <div class="block__body">
        ${timeline(all, lang, s)}
        <div class="filters" role="group" aria-label="${esc(s.nav.filmography)}" hidden>
          <button type="button" data-filter="all" aria-pressed="true">${esc(s.filterAll)}</button>
          <button type="button" data-filter="film" aria-pressed="false">${esc(s.filterFilm)}</button>
          <button type="button" data-filter="tv" aria-pressed="false">${esc(s.filterTv)}</button>
          <button type="button" data-filter="stage" aria-pressed="false">${esc(s.filterStage)}</button>
          <span class="filters__year" hidden><span class="filters__yearlabel" data-label="${esc(s.year)}"></span> <button type="button" class="filters__clear">${esc(s.clear)}</button></span>
        </div>
        ${decadeHtml}
      </div>
    </section>

    <section class="block news" id="news" aria-labelledby="news-title">
      <h2 id="news-title">${esc(s.nav.news)}</h2>
      <ul class="block__body news__list">
        ${c.news.map((n) => `<li><time datetime="${esc(n.date)}">${esc(formatDate(n.date, lang))}</time> ${tx(t(n.text, lang), lang)}${n.url ? ` <a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(s.source)}</a>` : ''}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="block sheet" id="gallery" aria-labelledby="gallery-title">
      <h2 id="gallery-title">${esc(s.nav.gallery)}</h2>
      <ul class="sheet__strip">
        ${photos.map((p, i) => `<li><figure>
          <a href="/img/jana-nagyova-${p.id}-1200.jpg" data-index="${i}" class="sheet__link">
            ${picture(p, lang, '(max-width: 700px) 70vw, 24vw')}
          </a>
          <figcaption>${tx(t(p.caption, lang), lang)}<br>${esc(s.photo)} ${esc(p.credit)}</figcaption>
        </figure></li>`).join('\n        ')}
      </ul>
    </section>

    <section class="credits-roll" id="contact" aria-labelledby="contact-title">
      <h2 id="contact-title">${esc(s.nav.contact)}</h2>
      <p class="credits-roll__note">${tx(t(c.contact.note, lang), lang)}</p>
      <dl>
        <div><dt>${esc(s.agency)}</dt><dd>${esc(c.contact.agency)}<br>${esc(c.contact.address || '')}</dd></div>
        <div><dt>${esc(s.agent)}</dt><dd>${esc(c.contact.agent)}</dd></div>
        <div><dt>${esc(s.email)}</dt><dd><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></dd></div>
        <div><dt>${esc(s.phone)}</dt><dd><a href="tel:${esc(c.contact.phone.replace(/\s/g, ''))}">${esc(c.contact.phone).replace(/ /g, NB)}</a></dd></div>
        <div><dt>${esc(s.web)}</dt><dd><a href="${esc(c.contact.url)}" rel="noopener" target="_blank">${esc(c.contact.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd></div>
        ${(c.social || []).map((so) => `<div><dt>${esc(so.label)}</dt><dd><a href="${esc(so.url)}" rel="noopener me" target="_blank">${esc(so.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd></div>`).join('')}
      </dl>
      <footer class="credits-roll__end">
        <p>${esc(s.credits)}: ${[...new Set(photos.map((p) => p.credit))].map(esc).join(', ')}</p>
        <p>© ${YEAR} Jana Nagyová · <a href="${s.otherHref}" lang="${s.other}" hreflang="${s.other}">${esc(s.otherLabel)}</a></p>
      </footer>
    </section>
  </main>

  <dialog class="lightbox" aria-label="${esc(s.nav.gallery)}">
    <button class="lightbox__close" type="button" aria-label="${esc(s.close)}">✕</button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="${esc(s.photoPrev)}">←</button>
    <figure>
      <img alt="" width="1200" height="1600">
      <figcaption></figcaption>
    </figure>
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="${esc(s.photoNext)}">→</button>
  </dialog>
  <script type="application/json" id="photo-data">${JSON.stringify(photos.map((p) => ({ id: p.id, w: p.w, h: p.h, alt: t(p.alt, lang), credit: `${glue(t(p.caption, lang), lang)} · ${s.photo} ${p.credit}` }))).replace(/</g, '\\u003c')}</script>
  <script type="application/json" id="portrait-data">${JSON.stringify(portraits.map((p, i) => ({ ...p, live: `${s.sceneOf(i + 1, portraits.length, p.name)}. ${p.alt}` }))).replace(/</g, '\\u003c')}</script>
</body>
</html>
`;
}

function notFound() {
  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stránka nenalezena · Seite nicht gefunden</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/site.css">
</head>
<body class="nf">
  <main>
    <p class="nf__code">404</p>
    <h1>Stránka nenalezena</h1>
    <p><a href="/">Zpět na úvod</a></p>
    <h2 lang="de">Seite nicht gefunden</h2>
    <p lang="de"><a href="/de/">Zur Startseite</a></p>
  </main>
</body>
</html>
`;
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#6e1d1b"/><path d="M10 58V24C10 12 54 12 54 24v34" fill="#2a1c16" stroke="#c38f37" stroke-width="3"/><text x="32" y="47" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#efe4cc">JN</text></svg>
`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${['/', '/de/'].map((p) => `  <url>
    <loc>${SITE}${p}</loc>
    <xhtml:link rel="alternate" hreflang="cs" href="${SITE}/"/>
    <xhtml:link rel="alternate" hreflang="de" href="${SITE}/de/"/>
  </url>`).join('\n')}
</urlset>
`;

/* ---------- fonts: Literata (TypeTogether, Prague), subset to the characters in use ---------- */
async function buildFonts(text) {
  rmSync(join(pub, 'fonts'), { recursive: true, force: true });
  mkdirSync(join(pub, 'fonts'), { recursive: true });
  const keep = `${text} 0123456789AaÁáBbCcČčDdĎďEeÉéĚěFfGgHhIiÍíJjKkLlĹĺĽľMmNnŇňOoÓóÔôÖöPpQqRrŔŕŘřSsŠšTtŤťUuÚúŮůÜüVvWwXxYyÝýZzŽžÄäß„“‚‘’–—…·©←→✕×.,:;!?()[]/&@+-%#'"*`;
  let css = '';
  for (const v of ['400', '600', '400-italic']) {
    const src = readFileSync(join(root, 'node_modules/@fontsource/literata', `${v}.css`), 'utf8');
    for (const block of src.split('/* ').slice(1)) {
      const name = block.slice(0, block.indexOf(' */'));
      if (!/-latin(-ext)?-\d+-(normal|italic)$/.test(name)) continue;
      const file = `${name}.woff2`;
      const font = readFileSync(join(root, 'node_modules/@fontsource/literata/files', file));
      writeFileSync(join(pub, 'fonts', file), await subsetFont(font, keep, { targetFormat: 'woff2' }));
      css += block.slice(block.indexOf('@font-face')).trim()
        .replace(/src: [^;]+;/, `src: url(/fonts/${file}) format('woff2');`) + '\n';
    }
  }
  return css;
}

const pages = { cs: page('cs'), de: page('de') };
out('index.html', pages.cs);
out('de/index.html', pages.de);
out('404.html', notFound());
out('favicon.svg', favicon);
out('sitemap.xml', sitemap);
out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

// all text that can appear, including what the 3D scene paints on its sheets
const allText = Object.values(pages).join('') + notFound() + JSON.stringify(c) + 'JANA NAGYOVÁ MS 1973 · BRATISLAVA';
const fontCss = await buildFonts(allText.replace(/<[^>]+>/g, ' '));
const siteCss = readFileSync(join(root, 'src/site.css'), 'utf8');
out('css/site.css', `/* generated by scripts/build.mjs – edit src/site.css */\n${fontCss}\n${siteCss}`);

await esbuild({
  entryPoints: { scene: join(root, 'src/scene.js'), ui: join(root, 'src/ui.js') },
  bundle: true, minify: true, format: 'esm', target: 'es2020',
  outdir: join(pub, 'js'), legalComments: 'eof', logLevel: 'warning',
});
rmSync(join(pub, 'arttest.js'), { force: true });
rmSync(join(pub, 'arttest.html'), { force: true });

for (const p of c.portraits) {
  if (!existsSync(join(pub, `img/figure/jana-${p.photo}-card.json`))) console.warn(`warning: card for portrait ${p.photo} missing`);
}
console.log('built: /, /de/, 404, css, js, fonts (subset)');
