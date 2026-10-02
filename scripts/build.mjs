// Generates the static site in public/ from content/content.json.
// Usage: node scripts/build.mjs  (or npm run build)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

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
  const faces = [
    ['cormorant-garamond', ['400', '500', '600', '400-italic', '500-italic']],
    ['manrope', ['400', '500', '600']],
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
        const rule = block.slice(block.indexOf('@font-face')).trim()
          .replace(/src: [^;]+;/, `src: url(/fonts/${file}) format('woff2');`);
        css += rule + '\n';
      }
    }
  }
  mkdirSync(join(pub, 'fonts'), { recursive: true });
  return css;
}

/* ---------- UI strings ---------- */
const L = {
  cs: {
    skip: 'Přeskočit na obsah', menu: 'Menu', close: 'Zavřít',
    nav: { about: 'Životopis', highlights: 'Role', filmography: 'Filmografie', news: 'Aktuálně', gallery: 'Galerie', contact: 'Kontakt' },
    scroll: 'Dál', other: 'de', otherLabel: 'Deutsch', otherHref: '/de/',
    filterAll: 'Vše', filterFilm: 'Film', filterTv: 'Televize', filterStage: 'Divadlo, hudba, nahrávky',
    types: { 'film': 'film', 'tv-serie': 'seriál', 'tv-film': 'TV film', 'auftritt': 'televizní pořad', 'theater': 'divadlo', 'synchron': 'dabing', 'musik': 'hudba', 'hoerspiel': 'audiodrama', 'moderation': 'moderování', 'sonstiges': 'ostatní' },
    press: 'Z recenzí', translated: '', montage: 'Fotomontáž · foto © Monika Navrátilová 2025',
    director: 'režie', role: 'role', languages: 'Jazyky', skills: 'Dovednosti',
    galleryNote: 'Klepnutím fotografii zvětšíte.', photo: 'Foto',
    contactLead: 'Zastoupení', agent: 'Agentka', email: 'E-mail', phone: 'Telefon', web: 'Web agentury',
    credits: 'Fotografie', prev: 'Předchozí', next: 'Další', source: 'Zdroj',
    filmCount: (n) => `${n} titulů`,
    jobTitle: 'Herečka',
  },
  de: {
    skip: 'Zum Inhalt springen', menu: 'Menü', close: 'Schließen',
    nav: { about: 'Biografie', highlights: 'Rollen', filmography: 'Filmografie', news: 'Aktuell', gallery: 'Galerie', contact: 'Kontakt' },
    scroll: 'Weiter', other: 'cs', otherLabel: 'Česky', otherHref: '/',
    filterAll: 'Alle', filterFilm: 'Film', filterTv: 'Fernsehen', filterStage: 'Bühne, Musik, Hörspiel',
    types: { 'film': 'Kino', 'tv-serie': 'Serie', 'tv-film': 'Fernsehfilm', 'auftritt': 'TV-Auftritt', 'theater': 'Theater', 'synchron': 'Synchron', 'musik': 'Musik', 'hoerspiel': 'Hörspiel', 'moderation': 'Moderation', 'sonstiges': 'Sonstiges' },
    press: 'Pressestimmen', translated: 'übersetzt', montage: 'Fotomontage · Foto © Monika Navrátilová 2025',
    director: 'Regie', role: 'Rolle', languages: 'Sprachen', skills: 'Fähigkeiten',
    galleryNote: 'Zum Vergrößern auf ein Foto tippen.', photo: 'Foto',
    contactLead: 'Vertretung', agent: 'Agentin', email: 'E-Mail', phone: 'Telefon', web: 'Website der Agentur',
    credits: 'Fotos', prev: 'Vorheriges', next: 'Nächstes', source: 'Quelle',
    filmCount: (n) => `${n} Titel`,
    jobTitle: 'Schauspielerin',
  },
};

const group = (type) => (type === 'film' ? 'film' : type.startsWith('tv') || type === 'auftritt' ? 'tv' : 'stage');

function picture(p, lang, sizes, eager = false) {
  const a = esc(t(p.alt, lang));
  const base = `/img/jana-nagyova-${p.id}`;
  return `<picture>
        <source type="image/webp" srcset="${base}-640.webp 640w, ${base}-1200.webp 1200w" sizes="${sizes}">
        <img src="${base}-1200.jpg" srcset="${base}-640.jpg 640w, ${base}-1200.jpg 1200w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${a}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">
      </picture>`;
}

function titleFor(item, lang) {
  // Czech page: original title; German page: German title if one exists.
  const localized = lang === 'de' ? item.title_de : item.title_cs;
  return localized || item.title_original;
}

function creditRow(item, lang, s) {
  const title = titleFor(item, lang);
  const sub = title !== item.title_original ? `<span class="credit__orig">${esc(item.title_original)}</span>` : '';
  const role = t(item.role, lang);
  return `<li class="credit" data-group="${group(item.type)}">
          <span class="credit__year">${esc(item.year)}</span>
          <span class="credit__main">
            <span class="credit__title">${esc(title)}</span>${sub}
            <span class="credit__meta">${esc(s.types[item.type] || '')}${role ? ` · ${esc(role)}` : ''}${item.director ? ` · ${esc(s.director)} ${esc(item.director)}` : ''}</span>
          </span>
        </li>`;
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
  const sameAs = c.sameAs || [];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: c.meta.name, jobTitle: s.jobTitle,
    birthDate: c.meta.birthDate, birthPlace: c.meta.birthPlace, url: SITE + path,
    image: `${SITE}/img/jana-nagyova-01-1200.jpg`, sameAs,
  };
  const navItems = Object.entries(s.nav).map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(t(c.meta.title, lang))}</title>
  <meta name="description" content="${esc(t(c.meta.description, lang))}">
  <meta name="theme-color" content="#0f0c0d">
  <meta name="color-scheme" content="dark">
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
  <link rel="preload" href="/fonts/cormorant-garamond-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/site.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <script type="module" src="/js/scene.js"></script>
  <script type="module" src="/js/ui.js"></script>
</head>
<body>
  <a class="skip" href="#main">${esc(s.skip)}</a>
  <canvas id="stage" aria-hidden="true"></canvas>
  <div class="stage-fallback" aria-hidden="true">${picture(photos[0], lang, '(max-width: 800px) 100vw, 50vw', true)}</div>

  <header class="top">
    <a class="top__brand" href="${path}">Jana Nagyová</a>
    <nav class="top__nav" aria-label="${lang === 'cs' ? 'Hlavní navigace' : 'Hauptnavigation'}">
      <button class="top__toggle" type="button" aria-expanded="false" aria-controls="nav-list">${esc(s.menu)}</button>
      <ul id="nav-list">${navItems}</ul>
    </nav>
    <div class="top__lang">
      <a href="/" ${lang === 'cs' ? 'aria-current="page"' : 'lang="cs" hreflang="cs"'}>CS</a>
      <span aria-hidden="true">|</span>
      <a href="/de/" ${lang === 'de' ? 'aria-current="page"' : 'lang="de" hreflang="de"'}>DE</a>
    </div>
  </header>

  <main id="main">
    <section class="hero" id="top" aria-labelledby="hero-title">
      <div class="hero__text">
        <p class="eyebrow">${esc(t(c.hero.eyebrow, lang))}</p>
        <h1 id="hero-title">Jana<br>Nagyová</h1>
        <p class="hero__tagline">${esc(t(c.hero.tagline, lang))}</p>
      </div>
      <a class="hero__scroll" href="#about">${esc(s.scroll)}<span aria-hidden="true"></span></a>
      <p class="hero__credit">${esc(s.montage)}</p>
    </section>

    <section class="panel" id="about" aria-labelledby="about-title">
      <div class="wrap wrap--split">
        <div>
          <h2 id="about-title">${esc(s.nav.about)}</h2>
          ${c.about[lang].map((p) => `<p>${esc(p)}</p>`).join('\n          ')}
        </div>
        <aside class="facts">
          <dl>
            ${c.facts.map((f) => `<div><dt>${esc(t(f.label, lang))}</dt><dd>${esc(t(f.value, lang))}</dd></div>`).join('\n            ')}
            <div><dt>${esc(s.skills)}</dt><dd>${esc(c.skills.other[lang].join(', '))}</dd></div>
          </dl>
        </aside>
      </div>
    </section>

    <section class="panel" id="highlights" aria-labelledby="highlights-title">
      <div class="wrap">
        <h2 id="highlights-title">${esc(s.nav.highlights)}</h2>
        <ol class="cards">
          ${c.highlights.map((h) => {
            const title = t(h.title, lang);
            return `<li class="card">
            <span class="card__year">${esc(h.year)}</span>
            <h3>${esc(title)}</h3>
            ${title !== h.original_title ? `<p class="card__orig">${esc(h.original_title)}</p>` : ''}
            <p class="card__role">${esc(t(h.role, lang))}${h.director ? ` · ${esc(s.director)} ${esc(h.director)}` : ''}</p>
            <p>${esc(t(h.text, lang))}</p>
          </li>`;
          }).join('\n          ')}
        </ol>
      </div>
    </section>

    <section class="panel" id="filmography" aria-labelledby="filmography-title">
      <div class="wrap">
        <div class="section-head">
          <h2 id="filmography-title">${esc(s.nav.filmography)}</h2>
          <p class="section-head__count" data-count-template="${esc(s.filmCount('{n}'))}">${esc(s.filmCount(all.length))}</p>
        </div>
        <div class="filters" role="group" aria-label="${esc(s.nav.filmography)}" hidden>
          <button type="button" data-filter="all" aria-pressed="true">${esc(s.filterAll)}</button>
          <button type="button" data-filter="film" aria-pressed="false">${esc(s.filterFilm)}</button>
          <button type="button" data-filter="tv" aria-pressed="false">${esc(s.filterTv)}</button>
          <button type="button" data-filter="stage" aria-pressed="false">${esc(s.filterStage)}</button>
        </div>
        <ul class="credits">
        ${all.map((i) => creditRow(i, lang, s)).join('\n        ')}
        </ul>
      </div>
    </section>

    <section class="panel" id="news" aria-labelledby="news-title">
      <div class="wrap">
        <h2 id="news-title">${esc(s.nav.news)}</h2>
        <ul class="news">
          ${c.news.map((n) => `<li><time datetime="${esc(n.date)}">${esc(formatDate(n.date, lang))}</time><p>${esc(t(n.text, lang))}${n.url ? ` <a href="${esc(n.url)}" rel="noopener" target="_blank">${esc(s.source)}</a>` : ''}</p></li>`).join('\n          ')}
        </ul>
        ${(c.quotes || []).length ? `<h3 class="quotes__title">${esc(s.press)}</h3>` : ''}
        ${(c.quotes || []).map((q) => {
          // Czech readers get Czech and Slovak quotes in the original
          const original = lang === 'cs' ? ['cs', 'sk'].includes(q.lang) : q.lang === lang;
          const text = original ? q.text_original : t(q.text, lang);
          const src = q.url ? `<a href="${esc(q.url)}" rel="noopener" target="_blank">${esc(q.source)}</a>` : esc(q.source);
          return `<figure class="quote"><blockquote lang="${esc(original ? q.lang : lang)}"><p>${esc(text)}</p></blockquote><figcaption>${src}${!original && s.translated ? ` (${esc(s.translated)})` : ''}</figcaption></figure>`;
        }).join('\n        ')}
      </div>
    </section>

    <section class="panel" id="gallery" aria-labelledby="gallery-title">
      <div class="wrap">
        <div class="section-head">
          <h2 id="gallery-title">${esc(s.nav.gallery)}</h2>
          <p class="section-head__count">${esc(s.galleryNote)}</p>
        </div>
        <ul class="gallery">
          ${photos.map((p, i) => `<li><figure>
            <a href="/img/jana-nagyova-${p.id}-1200.jpg" data-index="${i}" class="gallery__link">
              ${picture(p, lang, '(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 22vw')}
            </a>
            <figcaption>${esc(s.photo)} © ${esc(p.credit)} ${esc(p.year)}</figcaption>
          </figure></li>`).join('\n          ')}
        </ul>
      </div>
    </section>

    <section class="panel" id="contact" aria-labelledby="contact-title">
      <div class="wrap wrap--split">
        <div>
          <h2 id="contact-title">${esc(s.nav.contact)}</h2>
          <p class="lead">${esc(t(c.contact.note, lang))}</p>
        </div>
        <address class="contact">
          <p class="contact__label">${esc(s.contactLead)}</p>
          <p class="contact__agency">${esc(c.contact.agency)}</p>
          <p>${esc(c.contact.address || '')}</p>
          <dl>
            <div><dt>${esc(s.agent)}</dt><dd>${esc(c.contact.agent)}</dd></div>
            <div><dt>${esc(s.email)}</dt><dd><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></dd></div>
            <div><dt>${esc(s.phone)}</dt><dd><a href="tel:${esc(c.contact.phone.replace(/\s/g, ''))}">${esc(c.contact.phone)}</a></dd></div>
            <div><dt>${esc(s.web)}</dt><dd><a href="${esc(c.contact.url)}" rel="noopener" target="_blank">${esc(c.contact.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></dd></div>
          </dl>
          ${(c.social || []).length ? `<p class="contact__social">${c.social.map((so) => `<a href="${esc(so.url)}" rel="noopener me" target="_blank">${esc(so.label)}</a>`).join(' · ')}</p>` : ''}
        </address>
      </div>
    </section>
  </main>

  <footer class="foot">
    <div class="wrap foot__inner">
      <p>© ${YEAR} Jana Nagyová</p>
      <p class="foot__credits">${esc(s.credits)}: ${[...new Set(photos.map((p) => p.credit))].map(esc).join(', ')}</p>
      <p><a href="${s.otherHref}" lang="${s.other}" hreflang="${s.other}">${esc(s.otherLabel)}</a></p>
    </div>
  </footer>

  <dialog class="lightbox" aria-label="${esc(s.nav.gallery)}">
    <button class="lightbox__close" type="button" aria-label="${esc(s.close)}">×</button>
    <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="${esc(s.prev)}">‹</button>
    <figure>
      <img alt="" width="1200" height="1600">
      <figcaption></figcaption>
    </figure>
    <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="${esc(s.next)}">›</button>
  </dialog>
  <script type="application/json" id="photo-data">${JSON.stringify(photos.map((p) => ({ id: p.id, w: p.w, h: p.h, alt: t(p.alt, lang), credit: `${s.photo} © ${p.credit} ${p.year}` }))).replace(/</g, '\\u003c')}</script>
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
  <main class="nf__main">
    <p class="eyebrow">404</p>
    <h1>Stránka nenalezena</h1>
    <p><a href="/">Zpět na úvod</a></p>
    <h2 lang="de">Seite nicht gefunden</h2>
    <p lang="de"><a href="/de/">Zur Startseite</a></p>
  </main>
</body>
</html>
`;
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0f0c0d"/><circle cx="32" cy="32" r="25" fill="none" stroke="#c9a66b" stroke-width="1.5" opacity=".55"/><text x="32" y="41" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="25" fill="#c9a66b" letter-spacing="1">JN</text></svg>
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

mkdirSync(join(pub, 'fonts'), { recursive: true });
const fontCss = buildFonts();
const siteCss = readFileSync(join(root, 'src/site.css'), 'utf8');
out('css/site.css', `/* generated by scripts/build.mjs – edit src/site.css */\n${fontCss}\n${siteCss}`);
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

if (!existsSync(join(pub, 'img/jana-nagyova-01-1200.jpg'))) console.warn('warning: photos missing in public/img');
console.log('built: /, /de/, 404, css, js');
