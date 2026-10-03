// Printed paper-theatre sheets, drawn on canvas: few inks, outlines slightly out of
// register, halftone dots and paper fibre. Every sheet is deterministic (seeded).

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function sheet(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// paper: base tone, fibres and specks
function paper(g, w, h, color, seed, strength = 1) {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  const r = rng(seed);
  const n = Math.round((w * h) / 700 * strength);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 2 + r() * 9;
    g.strokeStyle = r() > 0.5 ? 'rgba(60,40,20,0.05)' : 'rgba(255,250,240,0.08)';
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}

// fibre texture on top of printed areas (keeps ink from looking digital)
function grain(g, w, h, seed) {
  const r = rng(seed);
  const n = Math.round((w * h) / 260);
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.6 ? 'rgba(255,248,235,0.10)' : 'rgba(30,20,10,0.05)';
    g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

// amplitude halftone inside the current clip; density(x, y) in 0..1
function halftone(g, x0, y0, w, h, color, cell, density, angle = Math.PI / 4) {
  g.save();
  g.fillStyle = color;
  const cx = x0 + w / 2, cy = y0 + h / 2, R = Math.hypot(w, h) / 2 + cell;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let u = -R; u < R; u += cell) {
    for (let v = -R; v < R; v += cell) {
      const x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
      if (x < x0 - cell || x > x0 + w + cell || y < y0 - cell || y > y0 + h + cell) continue;
      const d = density(x, y);
      if (d <= 0.02) continue;
      g.beginPath(); g.arc(x, y, (cell / 2) * Math.sqrt(Math.min(d, 1)) * 1.12, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}

// outline pass, shifted like a second printing plate that slipped
function ink(g, draw, color, width, shift = [1.6, -1.1]) {
  g.save();
  g.translate(shift[0], shift[1]);
  g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  g.restore();
}

const FONT = '"Literata", Georgia, serif';

/* ------------------------------------------------------------------ proscenium */
// opening: { x0, y0, x1, y1, arch } in canvas px, y down
export function proscenium(w, h, o, name, sub, minTop = 0) {
  const [c, g] = sheet(w, h);
  const P = { cream: '#efe4cc', red: '#6e1d1b', red2: '#8f2a22', ochre: '#c38f37', ink: '#2a1c16' };
  paper(g, w, h, P.red, 11, 0.6);
  // printed velvet: diagonal halftone in a lighter red
  halftone(g, 0, 0, w, h, P.red2, Math.max(6, w / 210), (x, y) => 0.25 + 0.2 * Math.sin(x / w * 9 + y / h * 3));

  const ow = o.x1 - o.x0, oh = o.y1 - o.y0, u = w / 100; // u: 1 % of the sheet width
  // pilasters either side of the opening
  const pw = Math.max(u * 3.2, (w - ow) / 2 * 0.42);
  for (const side of [-1, 1]) {
    const px = side < 0 ? o.x0 - pw - u * 0.9 : o.x1 + u * 0.9;
    g.fillStyle = P.cream; g.fillRect(px, o.y0 + oh * 0.08, pw, oh * 0.92);
    // fluting
    g.strokeStyle = 'rgba(195,143,55,0.85)'; g.lineWidth = Math.max(1.5, u * 0.22);
    for (let i = 1; i < 5; i++) { const x = px + (pw / 5) * i; g.beginPath(); g.moveTo(x, o.y0 + oh * 0.16); g.lineTo(x, o.y1 - oh * 0.06); g.stroke(); }
    // capital and base
    g.fillStyle = P.ochre;
    g.fillRect(px - u * 0.6, o.y0 + oh * 0.08 - u * 1.3, pw + u * 1.2, u * 1.4);
    g.fillRect(px - u * 0.6, o.y1 - u * 1.4, pw + u * 1.2, u * 1.4);
    ink(g, (k) => { k.strokeRect(px, o.y0 + oh * 0.08, pw, oh * 0.92); k.strokeRect(px - u * 0.6, o.y0 + oh * 0.08 - u * 1.3, pw + u * 1.2, u * 1.4); k.strokeRect(px - u * 0.6, o.y1 - u * 1.4, pw + u * 1.2, u * 1.4); }, P.ink, Math.max(1.5, u * 0.18));
  }

  // opening with an arched top
  const path = new Path2D();
  path.moveTo(o.x0, o.y1);
  path.lineTo(o.x0, o.y0 + o.arch);
  path.bezierCurveTo(o.x0, o.y0 - o.arch * 0.25, o.x1, o.y0 - o.arch * 0.25, o.x1, o.y0 + o.arch);
  path.lineTo(o.x1, o.y1);
  path.closePath();
  // ochre beading around it
  g.save();
  g.lineWidth = u * 1.6; g.strokeStyle = P.ochre; g.stroke(path);
  g.setLineDash([u * 0.35, u * 0.55]); g.lineWidth = u * 0.7; g.strokeStyle = P.cream; g.stroke(path);
  g.restore();
  ink(g, (k) => k.stroke(path), P.ink, Math.max(1.5, u * 0.2));

  // bottom band: ochre rule, then the stage colour, so it runs into the bar below the canvas
  const by = o.y1 + u * 1.2;
  g.fillStyle = '#2a1c16'; g.fillRect(0, by, w, h - by);
  g.fillStyle = P.ochre; g.fillRect(0, by, w, u * 0.5);
  ink(g, (k) => { k.beginPath(); k.moveTo(0, by + u * 1.1); k.lineTo(w, by + u * 1.1); k.stroke(); }, P.ochre, Math.max(1, u * 0.12), [0, 0]);

  grain(g, w, h, 12);
  // punch out the opening, then glue the cartouche on top so it may overlap the arch
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fill(path);
  g.globalCompositeOperation = 'source-over';

  const cw = Math.min(w * 0.62, Math.max(ow * 0.56, u * 38)), ch = Math.max(u * 6.4, h * 0.07);
  const cx = w / 2, cy = Math.max(o.y0 - ch * 0.62 - u * 0.6, minTop + ch / 2);
  const cart = new Path2D();
  cart.moveTo(cx - cw / 2 + ch * 0.5, cy - ch / 2);
  cart.lineTo(cx + cw / 2 - ch * 0.5, cy - ch / 2);
  cart.quadraticCurveTo(cx + cw / 2, cy - ch / 2, cx + cw / 2 + ch * 0.18, cy);
  cart.quadraticCurveTo(cx + cw / 2, cy + ch / 2, cx + cw / 2 - ch * 0.5, cy + ch / 2);
  cart.lineTo(cx - cw / 2 + ch * 0.5, cy + ch / 2);
  cart.quadraticCurveTo(cx - cw / 2, cy + ch / 2, cx - cw / 2 - ch * 0.18, cy);
  cart.quadraticCurveTo(cx - cw / 2, cy - ch / 2, cx - cw / 2 + ch * 0.5, cy - ch / 2);
  g.fillStyle = P.cream; g.fill(cart);
  g.lineWidth = u * 0.5; g.strokeStyle = P.ochre; g.stroke(cart);
  ink(g, (k) => k.stroke(cart), P.ink, Math.max(1.5, u * 0.16));
  // name: red under-print slightly off, ink on top; the profession below in italics
  const fs = Math.min(ch * 0.5, (cw * 0.84) / (name.length * 0.68));
  const ny = cy + (sub ? -ch * 0.1 : 0);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${fs}px ${FONT}`;
  if ('letterSpacing' in g) g.letterSpacing = `${fs * 0.06}px`;
  g.fillStyle = 'rgba(143,42,34,0.75)'; g.fillText(name, cx + fs * 0.03, ny + fs * 0.03);
  g.fillStyle = P.ink; g.fillText(name, cx, ny);
  if (sub) {
    g.font = `italic 400 ${fs * 0.44}px ${FONT}`;
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.fillStyle = P.red; g.fillText(sub, cx, cy + ch * 0.3);
  }
  return c;
}

function star(g, x, y, r, fill, line) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = fill; g.fill();
  ink(g, (k) => { k.stroke(); }, line, Math.max(1, r * 0.08), [0.8, -0.6]);
}

/* ------------------------------------------------------------------ curtain */
export function curtain(w, h, { valance = false } = {}) {
  const [c, g] = sheet(w, h);
  const red = '#7c201d', dark = '#4d1210', light = '#a33a2c', ochre = '#c38f37', inkc = '#2a1c16';
  const folds = valance ? 9 : 6;
  const fw = w / folds;
  const body = new Path2D();
  if (valance) {
    // scalloped pelmet
    body.moveTo(0, 0); body.lineTo(w, 0); body.lineTo(w, h * 0.62);
    for (let i = folds; i > 0; i--) body.quadraticCurveTo(fw * (i - 0.5), h * 1.02, fw * (i - 1), h * 0.62);
    body.closePath();
  } else {
    body.rect(0, 0, w, h);
  }
  g.save(); g.clip(body);
  paper(g, w, h, red, 31, 0.5);
  for (let i = 0; i < folds; i++) {
    const x = i * fw;
    const grd = g.createLinearGradient(x, 0, x + fw, 0);
    grd.addColorStop(0, dark); grd.addColorStop(0.35, red); grd.addColorStop(0.62, light); grd.addColorStop(1, dark);
    g.fillStyle = grd; g.globalAlpha = 0.85; g.fillRect(x, 0, fw + 1, h); g.globalAlpha = 1;
    halftone(g, x, 0, fw, h, 'rgba(40,8,6,0.55)', Math.max(5, w / 120), (px) => Math.max(0, Math.abs((px - x) / fw - 0.5) * 1.4 - 0.25));
  }
  grain(g, w, h, 33);
  g.restore();
  // fringe
  if (valance) {
    ink(g, (k) => k.stroke(body), inkc, Math.max(1.5, w * 0.002));
    g.fillStyle = ochre;
    for (let i = 0; i < folds; i++) {
      for (let k = 0; k < 7; k++) {
        const t = (k + 0.5) / 7, x = fw * i + fw * t, y = h * 0.62 + Math.sin(t * Math.PI) * h * 0.38 * 0.97;
        g.fillRect(x - w * 0.002, y, w * 0.004, h * 0.09);
      }
    }
  } else {
    g.fillStyle = ochre; g.fillRect(0, h - h * 0.025, w, h * 0.025);
    ink(g, (k) => { for (let i = 1; i < folds; i++) { k.beginPath(); k.moveTo(i * fw + fw * 0.05, 0); k.lineTo(i * fw - fw * 0.05, h); k.stroke(); } }, 'rgba(42,28,22,0.6)', Math.max(1, w * 0.003));
  }
  return c;
}

/* ------------------------------------------------------------------ scenes */
const SCENES = {
  // Šampión: the 1973 World Championships in Bratislava's winter stadium
  rink: {
    paper: '#e8e3d7', ink: '#1d2633', a: '#2d7fb0', b: '#c0392b',
    backdrop(g, w, h, S) {
      paper(g, w, h, S.paper, 41);
      halftone(g, 0, 0, w, h * 0.5, 'rgba(45,127,176,0.55)', w / 150, (x, y) => 0.55 - y / (h * 0.5) * 0.45);
      // roof truss
      const top = new Path2D(), bot = new Path2D();
      top.moveTo(-w * 0.05, h * 0.42); top.quadraticCurveTo(w / 2, -h * 0.18, w * 1.05, h * 0.42);
      bot.moveTo(-w * 0.05, h * 0.46); bot.quadraticCurveTo(w / 2, -h * 0.04, w * 1.05, h * 0.46);
      ink(g, (k) => { k.stroke(top); k.stroke(bot); for (let i = 0; i <= 28; i++) { const t = i / 28, x = -w * 0.05 + t * w * 1.1; const yt = qy(t, h * 0.42, -h * 0.18), yb = qy(t, h * 0.46, -h * 0.04); k.beginPath(); k.moveTo(x, yt); k.lineTo(x + (i % 2 ? 1 : -1) * w * 0.018, yb); k.stroke(); } }, S.ink, w * 0.0025);
      // hanging lamps
      for (let i = 1; i < 8; i++) {
        const x = (w / 8) * i, y = qy(i / 8, h * 0.46, -h * 0.04) + h * 0.06;
        g.strokeStyle = S.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - h * 0.06); g.lineTo(x, y); g.stroke();
        g.fillStyle = '#f3e3b5'; g.beginPath(); g.moveTo(x - w * 0.012, y); g.lineTo(x + w * 0.012, y); g.lineTo(x + w * 0.02, y + h * 0.025); g.lineTo(x - w * 0.02, y + h * 0.025); g.fill();
      }
      // stands with the crowd: heads and shoulders, one ink at low strength
      const rows = 6;
      for (let rI = 0; rI < rows; rI++) {
        const y0 = h * 0.5 + rI * h * 0.047, y1 = y0 + h * 0.047;
        g.fillStyle = rI % 2 ? '#d5dde0' : '#c8d3d8'; g.fillRect(0, y0, w, y1 - y0);
        const r = rng(50 + rI);
        g.save(); g.globalAlpha = 0.38; g.fillStyle = S.ink;
        for (let x = r() * 14; x < w; x += 14 + r() * 9) {
          const hy = y0 + h * 0.016 + r() * 2, hr = h * 0.008;
          g.beginPath(); g.arc(x, hy, hr, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(x, hy + hr * 2.3, hr * 1.7, hr * 1.2, 0, Math.PI, 0); g.fill();
        }
        g.restore();
      }
      // a few flags, not quite in line
      const fr = rng(57);
      for (let i = 0; i < 5; i++) {
        const fw = w * 0.034, fh = h * 0.035, x = w * (0.08 + i * 0.205) + (fr() - 0.5) * w * 0.03, y = h * 0.465;
        g.save(); g.translate(x, y); g.rotate((fr() - 0.5) * 0.14);
        g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, fw, fh / 2);
        g.fillStyle = S.b; g.fillRect(0, fh / 2, fw, fh / 2);
        g.fillStyle = '#1f4a8a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(fw * 0.45, fh / 2); g.lineTo(0, fh); g.fill();
        ink(g, (k) => k.strokeRect(0, 0, fw, fh), S.ink, 1.4);
        g.restore();
      }
      // two banners either side, so the figure never covers them
      for (const [bx0, text] of [[0.2, 'MS 1973'], [0.8, 'BRATISLAVA']]) {
        const bw = w * 0.17, bh = h * 0.065, bx = w * bx0 - bw / 2, by = h * 0.33;
        g.fillStyle = '#f4f1ea'; g.fillRect(bx, by, bw, bh);
        g.fillStyle = S.b; g.fillRect(bx, by + bh * 0.84, bw, bh * 0.16);
        g.fillStyle = S.ink; g.font = `600 ${bh * 0.5}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, w * bx0, by + bh * 0.44);
        ink(g, (k) => k.strokeRect(bx, by, bw, bh), S.ink, 2);
      }
      // rink boards
      g.fillStyle = '#f4f1ea'; g.fillRect(0, h * 0.78, w, h * 0.08);
      g.fillStyle = S.b; g.fillRect(0, h * 0.835, w, h * 0.012);
      ink(g, (k) => { k.beginPath(); k.moveTo(0, h * 0.78); k.lineTo(w, h * 0.78); k.stroke(); }, S.ink, 2.2);
      g.fillStyle = '#dde8ec'; g.fillRect(0, h * 0.86, w, h * 0.14);
      grain(g, w, h, 42);
    },
    wing(g, w, h, S, k) {
      const r = rng(60 + k);
      // steel pillar with rivets and a hanging banner
      const pw = w * 0.34, px = w * 0.5 - pw / 2;
      g.fillStyle = '#9aa7b0'; g.fillRect(px, 0, pw, h);
      g.globalCompositeOperation = 'source-atop';
      halftone(g, px, 0, pw, h, 'rgba(29,38,51,0.6)', w / 22, (x) => (x - px) / pw * 0.7);
      g.globalCompositeOperation = 'source-over';
      for (let y = h * 0.04; y < h; y += h * 0.05) for (const x of [px + pw * 0.15, px + pw * 0.85]) { g.fillStyle = S.ink; g.beginPath(); g.arc(x, y, w * 0.012, 0, Math.PI * 2); g.fill(); }
      ink(g, (kk) => kk.strokeRect(px, -5, pw, h + 10), S.ink, w * 0.012);
      if (k % 2 === 0) {
        const bx = px - w * 0.18, by = h * 0.18, bw = w * 0.7, bh = h * 0.28;
        g.fillStyle = r() > 0.5 ? S.b : S.a; g.fillRect(bx, by, bw, bh);
        g.fillStyle = '#f4f1ea'; g.fillRect(bx, by + bh * 0.4, bw, bh * 0.2);
        ink(g, (kk) => kk.strokeRect(bx, by, bw, bh), S.ink, w * 0.01);
      }
    },
    floor(g, w, h, S) {
      paper(g, w, h, '#e6eef0', 71);
      g.strokeStyle = 'rgba(29,38,51,0.18)'; g.lineWidth = 1.4;
      const r = rng(72);
      for (let i = 0; i < 46; i++) { g.beginPath(); const x = r() * w, y = r() * h; g.ellipse(x, y, 40 + r() * 220, 10 + r() * 60, r() * Math.PI, 0, Math.PI * (0.4 + r())); g.stroke(); }
      g.strokeStyle = 'rgba(192,57,43,0.75)'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
      g.beginPath(); g.arc(w / 2, h * 0.5, h * 0.18, 0, Math.PI * 2); g.stroke();
    },
  },

  // Arabela: a fairy-tale forest with a castle under the moon
  forest: {
    paper: '#e9e0c9', ink: '#1c2620', a: '#3c6648', b: '#c38f37', night: '#22365a',
    backdrop(g, w, h, S) {
      paper(g, w, h, S.paper, 81);
      g.fillStyle = S.night; g.fillRect(0, 0, w, h * 0.7);
      halftone(g, 0, 0, w, h * 0.7, 'rgba(233,224,201,0.35)', w / 140, (x, y) => (y / (h * 0.7)) * 0.6);
      // moon and stars
      g.fillStyle = '#efdca0'; g.beginPath(); g.arc(w * 0.78, h * 0.16, h * 0.075, 0, Math.PI * 2); g.fill();
      ink(g, (k) => { k.beginPath(); k.arc(w * 0.78, h * 0.16, h * 0.075, 0, Math.PI * 2); k.stroke(); }, S.ink, 2);
      const r = rng(83);
      for (let i = 0; i < 7; i++) { g.fillStyle = '#efdca0'; g.beginPath(); g.arc(r() * w, r() * h * 0.35, 2 + r() * 2.5, 0, Math.PI * 2); g.fill(); }
      // distant hills
      g.fillStyle = '#2f4a5c';
      g.beginPath(); g.moveTo(0, h * 0.6);
      for (let x = 0; x <= w; x += w / 12) g.quadraticCurveTo(x + w / 24, h * (0.5 + 0.06 * Math.sin(x / w * 7)), x + w / 12, h * 0.58);
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
      // castle on the hill
      g.save(); g.globalAlpha = 0.85; castle(g, w * 0.3, h * 0.55, h * 0.22, S); g.restore();
      // tree line
      for (let row = 0; row < 3; row++) {
        const base = h * (0.68 + row * 0.08), size = h * (0.16 + row * 0.05);
        const rr = rng(90 + row);
        for (let x = -size; x < w + size; x += size * (0.32 + rr() * 0.25)) fir(g, x, base + rr() * h * 0.02, size * (0.7 + rr() * 0.5), row === 2 ? S.a : row === 1 ? '#2f5040' : '#273f38', S.ink);
      }
      // mist
      g.fillStyle = 'rgba(233,224,201,0.55)';
      g.beginPath(); g.moveTo(0, h * 0.8);
      for (let x = 0; x <= w; x += w / 8) g.quadraticCurveTo(x + w / 16, h * 0.77, x + w / 8, h * 0.8);
      g.lineTo(w, h * 0.84); g.lineTo(0, h * 0.84); g.fill();
      g.fillStyle = '#3a5a3c'; g.fillRect(0, h * 0.86, w, h * 0.14);
      grain(g, w, h, 84);
    },
    wing(g, w, h, S, k) {
      const r = rng(100 + k);
      // trunk
      const tx = w * (0.38 + r() * 0.15), tw = w * 0.2;
      g.fillStyle = '#5a3f2c'; g.beginPath(); g.moveTo(tx, h); g.lineTo(tx + tw * 0.15, h * 0.3); g.lineTo(tx + tw * 0.85, h * 0.3); g.lineTo(tx + tw, h); g.fill();
      ink(g, (kk) => { for (let y = h * 0.35; y < h; y += h * 0.045) { kk.beginPath(); kk.moveTo(tx + tw * 0.2, y); kk.quadraticCurveTo(tx + tw * 0.5, y + h * 0.015, tx + tw * 0.8, y); kk.stroke(); } kk.beginPath(); kk.moveTo(tx, h); kk.lineTo(tx + tw * 0.15, h * 0.3); kk.moveTo(tx + tw * 0.85, h * 0.3); kk.lineTo(tx + tw, h); kk.stroke(); }, S.ink, w * 0.008);
      // foliage clusters
      const blobs = [];
      for (let i = 0; i < 14; i++) blobs.push([w * (0.15 + r() * 0.75), h * (0.02 + r() * 0.42), w * (0.16 + r() * 0.2)]);
      g.fillStyle = k % 2 ? '#2f5040' : S.a;
      for (const [x, y, rad] of blobs) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-atop'; // dots only on the leaves
      halftone(g, 0, 0, w, h * 0.65, 'rgba(28,38,32,0.45)', w / 26, (x, y) => (x / w) * 0.6 + (y / h) * 0.3);
      g.globalCompositeOperation = 'source-over';
      ink(g, (kk) => { for (const [x, y, rad] of blobs) { kk.beginPath(); kk.arc(x, y, rad, Math.PI * 0.9, Math.PI * 2.1); kk.stroke(); } }, S.ink, w * 0.008);
    },
    floor(g, w, h, S) {
      paper(g, w, h, '#4a6a43', 111);
      const r = rng(112);
      g.strokeStyle = 'rgba(28,38,32,0.45)'; g.lineWidth = 2;
      for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y - 9); g.lineTo(x + 4, y); g.stroke(); }
      for (let i = 0; i < 60; i++) { g.fillStyle = r() > 0.5 ? '#efdca0' : '#e9e0c9'; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 3, 0, Math.PI * 2); g.fill(); }
    },
  },

  // the stage: a renaissance hall with arcades, like the theatre sets at Nová scéna
  hall: {
    paper: '#ece0c6', ink: '#2a1c16', a: '#7d1d1d', b: '#c38f37',
    backdrop(g, w, h, S) {
      paper(g, w, h, S.paper, 121);
      halftone(g, 0, 0, w, h, 'rgba(195,143,55,0.45)', w / 150, (x, y) => 0.25 + (y / h) * 0.35);
      // arcade: three arches between columns
      const n = 3, aw = w / (n + 0.6), ax0 = w / 2 - (aw * n) / 2, top = h * 0.24, bottom = h * 0.86;
      for (let i = 0; i < n; i++) {
        const x = ax0 + i * aw + aw * 0.14, iw = aw * 0.72;
        const arch = new Path2D();
        arch.moveTo(x, bottom); arch.lineTo(x, top + iw / 2); arch.arc(x + iw / 2, top + iw / 2, iw / 2, Math.PI, 0); arch.lineTo(x + iw, bottom); arch.closePath();
        g.fillStyle = '#3c2a3c'; g.fill(arch);
        g.save(); g.clip(arch);
        halftone(g, x, top, iw, bottom - top, 'rgba(195,143,55,0.5)', w / 110, (px, py) => Math.max(0, 0.5 - (py - top) / (bottom - top)));
        // a window of night sky with a star
        g.restore();
        ink(g, (k) => k.stroke(arch), S.ink, w * 0.003);
      }
      for (let i = 0; i <= n; i++) {
        const cx = ax0 + i * aw + aw * 0.07, cw = aw * 0.14;
        g.fillStyle = '#d9c7a1'; g.fillRect(cx - cw / 2, top, cw, bottom - top);
        g.fillStyle = S.b; g.fillRect(cx - cw * 0.7, top - h * 0.03, cw * 1.4, h * 0.03); g.fillRect(cx - cw * 0.7, bottom - h * 0.025, cw * 1.4, h * 0.025);
        ink(g, (k) => { k.strokeRect(cx - cw / 2, top, cw, bottom - top); for (let j = 1; j < 4; j++) { k.beginPath(); k.moveTo(cx - cw / 2 + (cw / 4) * j, top + h * 0.02); k.lineTo(cx - cw / 2 + (cw / 4) * j, bottom - h * 0.03); k.stroke(); } }, S.ink, w * 0.0022);
      }
      // cornice and drapery swags
      g.fillStyle = S.b; g.fillRect(0, top - h * 0.07, w, h * 0.04);
      ink(g, (k) => k.strokeRect(-4, top - h * 0.07, w + 8, h * 0.04), S.ink, w * 0.0025);
      for (let i = 0; i < 6; i++) {
        const x0 = (w / 6) * i, x1 = x0 + w / 6;
        g.fillStyle = S.a; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.lineTo(x1, h * 0.04); g.quadraticCurveTo((x0 + x1) / 2, h * 0.17, x0, h * 0.04); g.fill();
        ink(g, (k) => { k.beginPath(); k.moveTo(x1, h * 0.04); k.quadraticCurveTo((x0 + x1) / 2, h * 0.17, x0, h * 0.04); k.stroke(); k.beginPath(); k.moveTo(x1, h * 0.02); k.quadraticCurveTo((x0 + x1) / 2, h * 0.11, x0, h * 0.02); k.stroke(); }, S.ink, w * 0.002);
      }
      // two wall sconces beside the arches
      for (const sx of [w * 0.18, w * 0.82]) {
        const sy = h * 0.4;
        ink(g, (k) => { k.beginPath(); k.moveTo(sx, sy); k.quadraticCurveTo(sx + w * 0.012, sy + h * 0.03, sx, sy + h * 0.05); k.stroke(); }, S.ink, w * 0.0025);
        for (const d of [-1, 1]) {
          const x = sx + d * w * 0.012;
          g.fillStyle = '#f2ead6'; g.fillRect(x - 3, sy - h * 0.03, 6, h * 0.03);
          g.fillStyle = S.b; g.beginPath(); g.ellipse(x, sy - h * 0.038, 4, 8, 0, 0, Math.PI * 2); g.fill();
        }
      }
      g.fillStyle = '#7a5a3a'; g.fillRect(0, h * 0.86, w, h * 0.14);
      grain(g, w, h, 122);
    },
    wing(g, w, h, S, k) {
      // column with a tied-back drape
      const cw = w * 0.36, cx = w * 0.5 - cw / 2;
      g.fillStyle = '#d9c7a1'; g.fillRect(cx, h * 0.08, cw, h * 0.92);
      g.fillStyle = S.b; g.fillRect(cx - cw * 0.12, h * 0.05, cw * 1.24, h * 0.05);
      ink(g, (kk) => { kk.strokeRect(cx, h * 0.08, cw, h * 0.95); for (let j = 1; j < 5; j++) { kk.beginPath(); kk.moveTo(cx + (cw / 5) * j, h * 0.12); kk.lineTo(cx + (cw / 5) * j, h); kk.stroke(); } }, S.ink, w * 0.008);
      if (k % 2 === 0) {
        const d = new Path2D();
        d.moveTo(0, 0); d.lineTo(w * 0.9, 0); d.quadraticCurveTo(w * 0.55, h * 0.3, w * 0.42, h * 0.52); d.quadraticCurveTo(w * 0.25, h * 0.8, w * 0.2, h); d.lineTo(0, h); d.closePath();
        g.fillStyle = S.a; g.fill(d);
        g.save(); g.clip(d); halftone(g, 0, 0, w, h, 'rgba(40,10,8,0.5)', w / 24, (x) => 0.2 + (x / w) * 0.6); g.restore();
        ink(g, (kk) => { kk.stroke(d); for (let j = 1; j < 4; j++) { kk.beginPath(); kk.moveTo(w * 0.2 * j, 0); kk.quadraticCurveTo(w * 0.18 * j, h * 0.4, w * 0.06 * j, h); kk.stroke(); } }, S.ink, w * 0.008);
        g.fillStyle = S.b; g.fillRect(w * 0.3, h * 0.5, w * 0.22, h * 0.03);
      }
    },
    floor(g, w, h, S) {
      paper(g, w, h, '#d8c39b', 131);
      const n = 10, cw = w / n, chh = h / 5;
      for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) { g.fillStyle = 'rgba(125,29,29,0.72)'; g.fillRect(i * cw, j * chh, cw, chh); }
      grain(g, w, h, 132);
    },
  },
};

function qy(t, y0, yc) { return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y0; }

function fir(g, x, base, size, color, line) {
  g.fillStyle = color;
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const y = base - k * size * 0.28, bw = size * (0.32 - k * 0.07);
    g.moveTo(x - bw, y); g.lineTo(x, y - size * 0.42); g.lineTo(x + bw, y);
  }
  g.fill();
  ink(g, (kk) => {
    kk.beginPath();
    for (let k = 0; k < 3; k++) {
      const y = base - k * size * 0.28, bw = size * (0.32 - k * 0.07);
      kk.moveTo(x - bw, y); kk.lineTo(x, y - size * 0.42); kk.lineTo(x + bw, y);
    }
    kk.stroke();
  }, line, Math.max(1, size * 0.01));
}

function castle(g, x, base, size, S) {
  const parts = [[-0.32, 0.55, 0.12], [-0.16, 0.8, 0.13], [0, 1, 0.16], [0.18, 0.7, 0.13], [0.34, 0.5, 0.11]];
  g.fillStyle = '#1b2a3c';
  g.fillRect(x - size * 0.36, base - size * 0.42, size * 0.76, size * 0.42);
  for (const [dx, hh, ww] of parts) {
    const tx = x + dx * size - (ww * size) / 2, ty = base - hh * size;
    g.fillStyle = '#1b2a3c'; g.fillRect(tx, ty, ww * size, hh * size);
    g.fillStyle = '#1b2a3c'; g.beginPath(); g.moveTo(tx - ww * size * 0.12, ty); g.lineTo(tx + (ww * size) / 2, ty - size * 0.2); g.lineTo(tx + ww * size * 1.12, ty); g.fill();
  }
  ink(g, (k) => { for (const [dx, hh, ww] of parts) { const tx = x + dx * size - (ww * size) / 2, ty = base - hh * size; k.strokeRect(tx, ty, ww * size, hh * size); k.beginPath(); k.moveTo(tx - ww * size * 0.12, ty); k.lineTo(tx + (ww * size) / 2, ty - size * 0.2); k.lineTo(tx + ww * size * 1.12, ty); k.stroke(); } }, S.ink, Math.max(1.2, size * 0.008));
}

export function backdrop(kind, w, h) {
  const [c, g] = sheet(w, h);
  SCENES[kind].backdrop(g, w, h, SCENES[kind]);
  return c;
}
export function wing(kind, w, h, k) {
  const [c, g] = sheet(w, h);
  SCENES[kind].wing(g, w, h, SCENES[kind], k);
  return c;
}
export function floor(kind, w, h) {
  const [c, g] = sheet(w, h);
  SCENES[kind].floor(g, w, h, SCENES[kind]);
  return c;
}

/* ------------------------------------------------------------------ ramp and card edge */
export function ramp(w, h) {
  const [c, g] = sheet(w, h);
  paper(g, w, h, '#2a1c16', 141, 0.6);
  g.fillStyle = '#c38f37'; g.fillRect(0, 0, w, h * 0.09);
  g.fillStyle = '#6e1d1b'; g.fillRect(0, h * 0.09, w, h * 0.05);
  for (let x = w * 0.02; x < w; x += w * 0.04) { g.fillStyle = 'rgba(195,143,55,0.55)'; g.beginPath(); g.arc(x, h * 0.55, h * 0.06, 0, Math.PI * 2); g.fill(); }
  grain(g, w, h, 142);
  return c;
}

export function cardboard(w, h) {
  const [c, g] = sheet(w, h);
  paper(g, w, h, '#9d8f7b', 151, 1.5);
  for (let y = 0; y < h; y += 3) { g.fillStyle = y % 6 ? 'rgba(60,45,30,0.12)' : 'rgba(255,245,230,0.08)'; g.fillRect(0, y, w, 1); }
  return c;
}

export function cardFace(w, h) {
  const [c, g] = sheet(w, h);
  paper(g, w, h, '#f6f1e6', 161, 0.8);
  return c;
}
