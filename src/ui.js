// Navigation, hero portrait switching, filmography filter and gallery lightbox.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* header */
const top = $('.top');
const hero = $('.hero');
const onScroll = () => {
  const limit = hero ? hero.offsetHeight - 70 : 40;
  top && top.classList.toggle('is-scrolled', window.scrollY > limit);
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

const nav = $('.top__nav');
const toggle = $('.top__toggle');
if (nav && toggle) {
  const close = () => { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { close(); toggle.focus(); }
  });
}

/* active section in nav */
const links = new Map($$('.top__nav a').map((a) => [a.getAttribute('href').slice(1), a]));
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const a = links.get(en.target.id);
      if (a && en.isIntersecting) {
        links.forEach((l) => l.classList.remove('is-active'));
        a.classList.add('is-active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* hero portraits: the 3D scene animates, this keeps the controls and the fallback in sync */
const portraits = JSON.parse($('#portrait-data')?.textContent || '[]');
if (hero && portraits.length) {
  let index = 0;
  const idx = $('.hero__index', hero);
  const credit = $('.hero__credit', hero);
  const fallbackImg = $('.hero__fallback img', hero);
  const meta = $('meta[name="theme-color"]');
  const show = (i, fromScene = false) => {
    index = (i + portraits.length) % portraits.length;
    const p = portraits[index];
    hero.style.setProperty('--hero-bg', p.bg);
    hero.style.setProperty('--hero-ink', p.ink);
    if (idx) idx.textContent = String(index + 1);
    if (credit) credit.textContent = p.credit;
    if (meta) meta.setAttribute('content', p.bg);
    if (fallbackImg) fallbackImg.src = `/img/figure/jana-${p.photo}-768.webp`;
    if (!fromScene) document.dispatchEvent(new CustomEvent('portrait-show', { detail: index }));
  };
  $$('.hero__btn', hero).forEach((b) => b.addEventListener('click', () => show(index + Number(b.dataset.dir))));
  hero.addEventListener('keydown', (e) => {
    if (e.target.closest('a, input')) return;
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });
  // the scene reports taps on the portrait
  document.addEventListener('portrait-next', () => show(index + 1));
}

/* filmography filter */
const filters = $('.filters');
if (filters) {
  filters.hidden = false;
  const items = $$('.credit');
  const decades = $$('.decade');
  const count = $('.films__count');
  const tpl = count?.dataset.countTemplate;
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    const f = btn.dataset.filter;
    $$('button', filters).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    let n = 0;
    items.forEach((li) => {
      const show = f === 'all' || li.dataset.group === f;
      li.hidden = !show;
      if (show) n++;
    });
    decades.forEach((d) => { d.hidden = !d.querySelector('.credit:not([hidden])'); });
    if (count && tpl) count.textContent = tpl.replace('{n}', n);
  });
}

/* lightbox */
const dialog = $('.lightbox');
const data = JSON.parse($('#photo-data')?.textContent || '[]');
if (dialog && data.length && typeof dialog.showModal === 'function') {
  const img = $('img', dialog);
  const cap = $('figcaption', dialog);
  let current = 0;
  let opener = null;
  const show = (i) => {
    current = (i + data.length) % data.length;
    const p = data[current];
    img.src = `/img/jana-nagyova-${p.id}-1200.webp`;
    img.width = p.w; img.height = p.h;
    img.alt = p.alt;
    cap.textContent = p.credit;
  };
  $$('.gallery__link').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    opener = a;
    show(Number(a.dataset.index));
    dialog.showModal();
  }));
  $('.lightbox__close', dialog).addEventListener('click', () => dialog.close());
  $('.lightbox__nav--prev', dialog).addEventListener('click', () => show(current - 1));
  $('.lightbox__nav--next', dialog).addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (opener && opener.focus) opener.focus(); });
  let sx = null;
  dialog.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  dialog.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    sx = null;
  });
}
