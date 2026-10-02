// Generates the static site in public/ from content/content.json.
// Usage: node scripts/build.mjs  (or npm run build)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { font3d } from './font3d.mjs';

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

/* ---------- fonts (self-hosted, latin + latin-ext only) ---------- */
function buildFonts() {
  rmSync(join(pub, 'fonts'), { recursive: true, force: true }); // drop fonts no longer used
  mkdirSync(join(pub, 'fonts'), { recursive: true });
  const faces = [
    ['big-shoulders-display', ['800', '900']],
    ['newsreader', ['400', '500', '400-italic']],
    ['archivo', ['400', '500', '600']],
  ];
  let css = '';
  for (const [pkg, variants] of faces) {
    for (const v of variants) {
      const src = readFileSync(join(root, 'node_modules/@fontsource', pkg, `${v}.css`), 'utf8');
      for (const block of src.split('/* ').slice(1)) {
        const name = block.slice(0, block.indexOf(' */'));
        if (!/-latin(-ext)?-\d+-(normal|italic)$/.test(name)) continue;
        const file = `${name}.woff2`;
        copyFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file), join(pub, 'fonts', file));
        css += block.slice(block.indexOf('@font-face')).trim()
          .replace(/src: [^;]+;/, `src: url(/fonts/${file}) format('woff2');`) + '\n';
      }
    }
  }
  return css;
}

/* ---------- UI strings ---------- */
const L = {
  cs: {
    skip: 'Přeskočit na obsah', menu: 'Menu', close: 'Zavřít',
    nav: { about: 'Životopis', highlights: 'Role', filmography: 'Filmografie', news: 'Aktuálně', gallery: 'Galerie', contact: 'Kontakt' },
    other: 'de', otherLabel: 'Deutsch', otherHref: '/de/',
    filterAll: 'Vše', filterFilm: 'Film', filterTv: 'Televize', filterStage: 'Divadlo, hudba, nahrávky',
    types: { 'film': 'film', 'tv-serie': 'seriál', 'tv-film': 'TV film', 'auftritt': 'televizní pořad', 'theater': 'divadlo', 'synchron': 'dabing', 'musik': 'hudba', 'hoerspiel': 'audiodrama', 'moderation': 'moderování', 'sonstiges': 'ostatní' },
    press: 'Z recenzí', translated: '',
    director: 'režie', facts: 'V kostce', skills: 'Dovednosti',
    photo: 'Foto', credits: 'Fotografie', prev: 'Předchozí portrét', next: 'Další portrét', source: 'Zdroj',
    agency: 'Zastoupení', agent: 'Agentka', phone: 'Telefon', web: 'Agentura',
    count: (n) => `${n} titulů`,
    decade: (d) => `${String(d).slice(2)}. léta`,
    timeline: 'Každý čtvereček je jeden titul, seřazeno podle roku.',
    legend: { film: 'film', tv: 'televize', stage: 'divadlo, hudba, nahrávky' },
    heroHint: 'Písmena se dají chytit a roztočit. Klepnutím na portrét přepnete fotografii.',
    portraitOf: (i, n) => `Portrét ${i} z ${n}`,
    jobTitle: 'Herečka', navLabel: 'Hlavní navigace',
  },
  de: {
    skip: 'Zum Inhalt springen', menu: 'Menü', close: 'Schließen',
    nav: { about: 'Biografie', highlights: 'Rollen', filmography: 'Filmografie', news: 'Aktuell', gallery: 'Galerie', contact: 'Kontakt' },
    other: 'cs', otherLabel: 'Česky', otherHref: '/',
    filterAll: 'Alle', filterFilm: 'Film', filterTv: 'Fernsehen', filterStage: 'Bühne, Musik, Hörspiel',
    types: { 'film': 'Kino', 'tv-serie': 'Serie', 'tv-film': 'Fernsehfilm', 'auftritt': 'TV-Auftritt', 'theater': 'Theater', 'synchron': 'Synchron', 'musik': 'Musik', 'hoerspiel': 'Hörspiel', 'moderation': 'Moderation', 'sonstiges': 'Sonstiges' },
    press: 'Pressestimmen', translated: 'übersetzt',
    director: 'Regie', facts: 'Kurz gefasst', skills: 'Fähigkeiten',
    photo: 'Foto', credits: 'Fotos', prev: 'Vorheriges Porträt', next: 'Nächstes Porträt', source: 'Quelle',
    agency: 'Vertretung', agent: 'Agentin', phone: 'Telefon', web: 'Agentur',
    count: (n) => `${n} Titel`,
    decade: (d) => `${d}er`,
    timeline: 'Jedes Kästchen ist ein Titel, sortiert nach Jahr.',
    legend: { film: 'Kino', tv: 'Fernsehen', stage: 'Bühne, Musik, Hörspiel' },
    heroHint: 'Die Buchstaben lassen sich greifen und drehen. Ein Tipp auf das Porträt wechselt das Foto.',
    portraitOf: (i, n) => `Porträt ${i} von ${n}`,
    jobTitle: 'Schauspielerin', navLabel: 'Hauptnavigation',
  },
};

// pixel size of a WebP file (VP8X / VP8 / VP8L headers)
function webpSize(file) {
  const b = readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  const bits = b.readUInt32LE(21);
  return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
}

const group = (type) => (type === 'film' ? 'film' : type.startsWith('tv') || type === 'auftritt' ? 'tv' : 'stage');
const firstYear = (y) => Number(String(y).match(/\d{4}/)[0]);

function picture(p, lang, sizes, { eager = false, cls = '' } = {}) {
  const base = `/img/jana-nagyova-${p.id}`;
  return `<picture${cls ? ` class="${cls}"` : ''}>
        <source type="image/webp" srcset="${base}-640.webp 640w, ${base}-1200.webp 1200w" sizes="${sizes}">
        <img src="${base}-1200.jpg" srcset="${base}-640.jpg 640w, ${base}-1200.jpg 1200w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(t(p.alt, lang))}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">
      </picture>`;
}

function titleFor(item, lang) {
  const localized = lang === 'de' ? item.title_de : item.title_cs;
  return localized || item.title_original;
}

function creditRow(item, lang, s) {
  const title = titleFor(item, lang);
  const orig = title !== item.title_original ? `<span class="credit__orig">${esc(item.title_original)}</span>` : '';
  const role = t(item.role, lang);
  return `<li class="credit" data-group="${group(item.type)}">
            <span class="credit__year">${esc(item.year)}</span>
            <span class="credit__title">${esc(title)}${orig}</span>
            <span class="credit__role">${esc(role)}</span>
            <span class="credit__dir">${item.director ? esc(item.director) : ''}</span>
            <span class="credit__type">${esc(s.types[item.type] || '')}</span>
          </li>`;
}

// one square per title, stacked above its year; the long pause after 1993 shows as empty space
function timeline(all, lang, s) {
  const from = 1970, to = YEAR;
  const cell = 9, gap = 2, colW = cell + gap;
  const byYear = new Map();
  for (const i of all) {
    const y = firstYear(i.year);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(group(i.type));
  }
  const order = { film: 0, tv: 1, stage: 2 };
  const maxStack = Math.max(...[...byYear.values()].map((v) => v.length));
  const H = maxStack * colW + 22;
  const W = (to - from + 1) * colW;
  let rects = '';
  for (const [y, groups] of byYear) {
    groups.sort((a, b) => order[a] - order[b]).forEach((g, k) => {
      rects += `<rect class="tl-${g}" x="${(y - from) * colW}" y="${H - 22 - (k + 1) * colW + gap}" width="${cell}" height="${cell}"/>`;
    });
  }
  let ticks = '';
  for (let y = from; y <= to; y += 10) ticks += `<text x="${(y - from) * colW}" y="${H - 6}">${y}</text>`;
  return `<figure class="timeline">
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.timeline)}" preserveAspectRatio="xMinYMax meet">${rects}<line x1="0" x2="${W}" y1="${H - 20}" y2="${H - 20}"/>${ticks}</svg>
          <figcaption>${esc(s.timeline)} <span class="tl-key tl-key--film"></span>${esc(s.legend.film)} <span class="tl-key tl-key--tv"></span>${esc(s.legend.tv)} <span class="tl-key tl-key--stage"></span>${esc(s.legend.stage)}</figcaption>
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
  const portraits = c.portraits.map((p) => ({ ...p, label: t(p.label, lang) }));
  const first = portraits[0];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: c.meta.name, jobTitle: s.jobTitle,
    birthDate: c.meta.birthDate, birthPlace: c.meta.birthPlace, url: SITE + path,
    image: `${SITE}/img/jana-nagyova-01-1200.jpg`, sameAs: c.sameAs || [],
  };
  const navItems = Object.entries(s.nav).map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('');

  // filmography grouped by decade
  const decades = new Map();
  for (const i of all) {
    const d = Math.floor(firstYear(i.year) / 10) * 10;
    if (!decades.has(d)) decades.set(d, []);
    decades.get(d).push(i);
  }
  const decadeHtml = [...decades].map(([d, items]) => `<section class="decade" aria-labelledby="dec-${d}">
          <h3 id="dec-${d}">${esc(s.decade(d))}</h3>
          <ul class="credits">
          ${items.map((i) => creditRow(i, lang, s)).join('\n          ')}
          </ul>
        </section>`).join('\n        ');

  const v = c.voice;
  const voiceOriginal = lang === 'cs' ? ['cs', 'sk'].includes(v.lang) : v.lang === lang;

  // gallery layout: spans for an uneven editorial grid
  const spans = ['g-a', 'g-b', 'g-c', 'g-d', 'g-e'];

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(t(c.meta.title, lang))}</title>
  <meta name="description" content="${esc(t(c.meta.description, lang))}">
  <meta name="theme-color" content="${esc(first.bg)}">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${SITE}${path}">
  <link rel="alternate" hreflang="cs" href="${SITE}/">
  <link rel="alternate" hreflang="de" href="${SITE}/de/">
  <link rel="alternate" hreflang="x-default" href="${SITE}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${esc(t(c.meta.title, lang))}">
  <meta property="og:description" content="${esc(t(c.meta.description, lang))}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/img/jana-nagyova-01-1200.jpg">
  <meta property="og:locale" content="${lang === 'cs' ? 'cs_CZ' : 'de_DE'}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preload" href="/fonts/big-shoulders-display-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/img/figure/jana-${first.photo}-768.webp" as="image" type="image/webp">
  <link rel="stylesheet" href="/css/site.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <script type="module" src="/js/ui.js"></script>
  <script type="module" src="/js/scene.js"></script>
</head>
<body>
  <a class="skip" href="#main">${esc(s.skip)}</a>

  <header class="top">
    <a class="top__brand" href="${path}">Jana Nagyová</a>
    <nav class="top__nav" aria-label="${esc(s.navLabel)}">
      <button class="top__toggle" type="button" aria-expanded="false" aria-controls="nav-list">${esc(s.menu)}</button>
      <ul id="nav-list">${navItems}</ul>
    </nav>
    <p class="top__lang">
      <a href="/" ${lang === 'cs' ? 'aria-current="page"' : 'lang="cs" hreflang="cs"'}>CS</a>
      <a href="/de/" ${lang === 'de' ? 'aria-current="page"' : 'lang="de" hreflang="de"'}>DE</a>
    </p>
  </header>

  <main id="main">
    <section class="hero" aria-labelledby="hero-title" style="--hero-bg:${esc(first.bg)};--hero-ink:${esc(first.ink)}">
      <canvas class="hero__canvas" aria-hidden="true"></canvas>
      <div class="hero__fallback" aria-hidden="true">
        <img src="/img/figure/jana-${first.photo}-768.webp" width="${webpSize(join(pub, `img/figure/jana-${first.photo}-768.webp`))[0]}" height="768" alt="">
      </div>
      <h1 id="hero-title" class="hero__name"><span>Jana</span> <span>Nagyová</span></h1>
      <div class="hero__foot">
        <p class="hero__line">${esc(t(c.hero.eyebrow, lang))}. ${esc(t(c.hero.tagline, lang))}</p>
        <div class="hero__controls">
          <button type="button" class="hero__btn" data-dir="-1" aria-label="${esc(s.prev)}">←</button>
          <p class="hero__count" aria-live="polite"><span class="hero__index">1</span>/${portraits.length} <span class="hero__credit">${esc(first.label)} · ${esc(s.photo)} © ${esc(first.credit)}</span></p>
          <button type="button" class="hero__btn" data-dir="1" aria-label="${esc(s.next)}">→</button>
        </div>
        <p class="hero__hint">${esc(s.heroHint)}</p>
      </div>
    </section>

    <section class="bio" id="about" aria-labelledby="about-title">
      <h2 id="about-title" class="sh">${esc(s.nav.about)}</h2>
      <figure class="voice">
        <blockquote lang="${esc(voiceOriginal ? v.lang : lang)}"><p>${esc(voiceOriginal ? v.text_original : t(v.text, lang))}</p></blockquote>
        <figcaption><a href="${esc(v.url)}" rel="noopener" target="_blank">${esc(t(v.context, lang))}</a>${!voiceOriginal && s.translated ? ` (${esc(s.translated)})` : ''}</figcaption>
      </figure>
      <div class="bio__text">
        ${c.about[lang].map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
      </div>
      <aside class="facts" aria-labelledby="facts-title">
        <h3 id="facts-title">${esc(s.facts)}</h3>
        <dl>
          ${c.facts.map((f) => `<div><dt>${esc(t(f.label, lang))}</dt><dd>${esc(t(f.value, lang))}</dd></div>`).join('\n          ')}
          <div><dt>${esc(s.skills)}</dt><dd>${esc(c.skills.other[lang].join('; '))}</dd></div>
        </dl>
      </aside>
    </section>

    <section class="roles" id="highlights" aria-labelledby="highlights-title">
      <h2 id="highlights-title" class="sh">${esc(s.nav.highlights)}</h2>
      <ol class="roles__list">
        ${c.highlights.map((h) => {
          const title = t(h.title, lang);
          return `<li class="role">
          <p class="role__year">${esc(h.year)}</p>
          <div class="role__body">
            <h3>${esc(title)}${title !== h.original_title ? ` <span class="role__orig">${esc(h.original_title)}</span>` : ''}</h3>
            <p class="role__as">${esc(t(h.role, lang))}</p>
            <p>${esc(t(h.text, lang))}</p>
          </div>
        </li>`;
        }).join('\n        ')}
      </ol>
    </section>

    <section class="films" id="filmography" aria-labelledby="filmography-title">
      <div class="films__head">
        <h2 id="filmography-title" class="sh">${esc(s.nav.filmography)}</h2>
        <p class="films__count" data-count-template="${esc(s.count('{n}'))}">${esc(s.count(all.length))}</p>
      </div>
      ${timeline(all, lang, s)}
      <div class="filters" role="group" aria-label="${esc(s.nav.filmography)}" hidden>
        <button type="button" data-filter="all" aria-pressed="true">${esc(s.filterAll)}</button>
        <button type="button" data-filter="film" aria-pressed="false">${esc(s.filterFilm)}</button>
        <button type="button" data-filter="tv" aria-pressed="false">${esc(s.filterTv)}</button>
        <button type="button" data-filter="stage" aria-pressed="false">${esc(s.filterStage)}</button>
      </div>
      <div class="films__list">
        ${decadeHtml}
      </div>
    </section>

    <section class="news" id="news" aria-labelledby="news-title">
      <h2 id="news-title" class="sh">${esc(s.nav.news)}</h2>
      <ul class="news__list">
        ${c.news.map((n) => `<li><time datetime="${esc(n.date)}">${esc(formatDate(n.date, lang))}</time><p>${esc(t(n.text, lang))}${n.url ? ` <a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(s.source)}</a>` : ''}</p></li>`).join('\n        ')}
      </ul>
      ${(c.quotes || []).length ? `<h3 class="press__title">${esc(s.press)}</h3>
      <div class="press">
        ${c.quotes.map((q) => {
          const original = lang === 'cs' ? ['cs', 'sk'].includes(q.lang) : q.lang === lang;
          const src = q.url ? `<a href="${esc(q.url)}" rel="noopener" target="_blank">${esc(q.source)}</a>` : esc(q.source);
          return `<figure class="press__item"><blockquote lang="${esc(original ? q.lang : lang)}"><p>${esc(original ? q.text_original : t(q.text, lang))}</p></blockquote><figcaption>${src}${!original && s.translated ? ` (${esc(s.translated)})` : ''}</figcaption></figure>`;
        }).join('\n        ')}
      </div>` : ''}
    </section>

    <section class="gallery" id="gallery" aria-labelledby="gallery-title">
      <h2 id="gallery-title" class="sh">${esc(s.nav.gallery)}</h2>
      <ul class="gallery__grid">
        ${photos.map((p, i) => `<li class="${spans[i % spans.length]}"><figure>
          <a href="/img/jana-nagyova-${p.id}-1200.jpg" data-index="${i}" class="gallery__link">
            ${picture(p, lang, '(max-width: 700px) 92vw, 40vw')}
          </a>
          <figcaption>${esc(s.photo)} © ${esc(p.credit)} ${esc(p.year)}</figcaption>
        </figure></li>`).join('\n        ')}
      </ul>
    </section>

    <section class="contact" id="contact" aria-labelledby="contact-title">
      <h2 id="contact-title" class="sh">${esc(s.nav.contact)}</h2>
      <p class="contact__note">${esc(t(c.contact.note, lang))}</p>
      <p class="contact__mail"><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></p>
      <address class="contact__card">
        <p><span>${esc(s.agency)}</span>${esc(c.contact.agency)}, ${esc(c.contact.address || '')}</p>
        <p><span>${esc(s.agent)}</span>${esc(c.contact.agent)}</p>
        <p><span>${esc(s.phone)}</span><a href="tel:${esc(c.contact.phone.replace(/\s/g, ''))}">${esc(c.contact.phone)}</a></p>
        <p><span>${esc(s.web)}</span><a href="${esc(c.contact.url)}" rel="noopener" target="_blank">${esc(c.contact.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></p>
        ${(c.social || []).map((so) => `<p><span>${esc(so.label)}</span><a href="${esc(so.url)}" rel="noopener me" target="_blank">${esc(so.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></p>`).join('')}
      </address>
    </section>
  </main>

  <footer class="foot">
    <p>© ${YEAR} Jana Nagyová</p>
    <p>${esc(s.credits)}: ${[...new Set(photos.map((p) => p.credit))].map(esc).join(', ')}</p>
    <p><a href="${s.otherHref}" lang="${s.other}" hreflang="${s.other}">${esc(s.otherLabel)}</a></p>
  </footer>

  <dialog class="lightbox" aria-label="${esc(s.nav.gallery)}">
    <button class="lightbox__close" type="button" aria-label="${esc(s.close)}">✕</button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="${esc(s.prev)}">←</button>
    <figure>
      <img alt="" width="1200" height="1600">
      <figcaption></figcaption>
    </figure>
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="${esc(s.next)}">→</button>
  </dialog>
  <script type="application/json" id="photo-data">${JSON.stringify(photos.map((p) => ({ id: p.id, w: p.w, h: p.h, alt: t(p.alt, lang), credit: `${s.photo} © ${p.credit} ${p.year}` }))).replace(/</g, '\\u003c')}</script>
  <script type="application/json" id="portrait-data">${JSON.stringify(portraits.map((p) => ({ ...p, credit: `${p.label} · ${s.photo} © ${p.credit}` }))).replace(/</g, '\\u003c')}</script>
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

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#efe8dc"/><text x="32" y="50" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif" font-weight="900" font-size="46" fill="#c43a22">JN</text></svg>
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

const fontCss = buildFonts();
const siteCss = readFileSync(join(root, 'src/site.css'), 'utf8');
out('css/site.css', `/* generated by scripts/build.mjs – edit src/site.css */\n${fontCss}\n${siteCss}`);
out('fonts/name-3d.json', JSON.stringify(font3d(join(root, 'node_modules/@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff'), 'JANAGYOVÁ')));
out('index.html', page('cs'));
out('de/index.html', page('de'));
out('404.html', notFound());
out('favicon.svg', favicon);
out('sitemap.xml', sitemap);
out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

await esbuild({
  entryPoints: { scene: join(root, 'src/scene.js'), ui: join(root, 'src/ui.js') },
  bundle: true, minify: true, format: 'esm', target: 'es2020',
  outdir: join(pub, 'js'), legalComments: 'eof', logLevel: 'warning',
});

for (const p of c.portraits) {
  if (!existsSync(join(pub, `img/figure/jana-${p.photo}-1280.webp`))) console.warn(`warning: cut-out for portrait ${p.photo} missing`);
}
console.log('built: /, /de/, 404, css, js, 3d font');
