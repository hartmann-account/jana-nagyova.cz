// Navigation, scene buttons of the paper theatre, filmography filters and the lightbox.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* header: light over the stage, paper as soon as the page moves */
const top = $('.top');
const onScroll = () => top && top.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const nav = $('.top__nav');
const toggle = $('.top__toggle');
if (nav && toggle) {
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    top.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? toggle.dataset.close : toggle.dataset.open;
  };
  let openedAt = 0;
  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    setOpen(open);
    if (open) openedAt = window.scrollY;
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('pointerdown', (e) => { if (nav.classList.contains('is-open') && !top.contains(e.target)) setOpen(false); });
  window.addEventListener('scroll', () => { if (nav.classList.contains('is-open') && Math.abs(window.scrollY - openedAt) > 40) setOpen(false); }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
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

/* paper theatre scenes: buttons, keyboard, taps on the figure (reported by the scene) */
const hero = $('.hero');
const portraits = JSON.parse($('#portrait-data')?.textContent || '[]');
if (hero && portraits.length) {
  let index = 0;
  const label = $('.hero__label', hero);
  const credit = $('.hero__credit', hero);
  const live = $('.hero__live', hero);
  const fallbackImg = $('.hero__fallback img', hero);
  const buttons = $$('.hero__scenes button', hero);
  const show = (i, announce = true) => {
    index = (i + portraits.length) % portraits.length;
    const p = portraits[index];
    if (label) label.textContent = p.label;
    if (credit) credit.textContent = p.credit;
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === index)));
    if (live && announce) live.textContent = p.live;
    if (fallbackImg) { fallbackImg.src = `/img/figure/jana-${p.photo}-768.webp`; fallbackImg.alt = p.alt; }
    document.dispatchEvent(new CustomEvent('portrait-show', { detail: index }));
  };
  buttons.forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.index))));
  hero.addEventListener('keydown', (e) => {
    if (!e.target.closest('.hero__scenes')) return;
    if (e.key === 'ArrowRight') { show(index + 1); buttons[index].focus(); }
    if (e.key === 'ArrowLeft') { show(index - 1); buttons[index].focus(); }
  });
  document.addEventListener('portrait-next', () => show(index + 1));
  document.addEventListener('portrait-failed', (e) => show(e.detail, false));
}

/* filmography: type filter, year from the timeline, decades folded on small screens */
const filters = $('.filters');
if (filters) {
  filters.hidden = false;
  const items = $$('.credit');
  const decades = $$('.decade');
  const years = $$('.tl-year[data-year]');
  const count = $('.films__count');
  const tpl = count?.dataset.countTemplate;
  const yearBox = $('.filters__year', filters);
  const yearLabel = $('.filters__yearlabel', filters);
  let type = 'all';
  let year = null;
  const apply = () => {
    let n = 0;
    items.forEach((li) => {
      const show = (type === 'all' || li.dataset.group === type) && (year === null || li.dataset.year === year);
      li.hidden = !show;
      if (show) n++;
    });
    decades.forEach((d) => {
      const any = !!d.querySelector('.credit:not([hidden])');
      d.hidden = !any;
      if (year !== null && any) d.open = true;
    });
    years.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.year === year)));
    if (yearBox) { yearBox.hidden = year === null; if (yearLabel) yearLabel.textContent = year ? `${yearLabel.dataset.label} ${year}` : ''; }
    if (count && tpl) count.textContent = tpl.replace('{n}', n);
  };
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (btn) {
      type = btn.dataset.filter;
      $$('button[data-filter]', filters).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      apply();
    }
    if (e.target.closest('.filters__clear')) { year = null; apply(); }
  });
  years.forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      year = year === b.dataset.year ? null : b.dataset.year;
      apply();
      if (year) filters.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
  });
  if (window.matchMedia('(max-width: 760px)').matches) decades.forEach((d, i) => { if (i > 0) d.open = false; });
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
  $$('.sheet__link').forEach((a) => a.addEventListener('click', (e) => {
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
