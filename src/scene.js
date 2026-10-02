// Hero: Jana Nagyová as a cut-out portrait with depth relief, standing inside her name.
// The letters are extruded 3D type; they turn towards the pointer, can be dragged and
// flicked, and spring back. Tapping the portrait switches to the next one; each portrait
// brings its own poster colours.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry,
  MeshStandardMaterial, MeshDepthMaterial, ShadowMaterial, AmbientLight, DirectionalLight,
  TextureLoader, SRGBColorSpace, Color, Vector2, Raycaster, MathUtils,
  VSMShadowMap, RGBADepthPacking, NoToneMapping,
} from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const canvas = document.querySelector('.hero__canvas');
const foot = document.querySelector('.hero__foot');
const dataEl = document.getElementById('portrait-data');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const html = document.documentElement;

const FOV = 30;
const DIST = 10;
const FRAME_H = 2 * DIST * Math.tan(MathUtils.degToRad(FOV / 2));
const LETTER_Z = -0.9; // behind her
const FRONT_Z = 0.55; // letters that pass in front of her body

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

async function init() {
  const portraits = JSON.parse(dataEl.textContent);
  const fontData = await (await fetch('/fonts/name-3d.json')).json();
  const font = new Font(fontData);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, DIST);

  const bg = new Color(portraits[0].bg);
  const inkColor = new Color(portraits[0].ink);
  renderer.setClearColor(bg, 1);

  scene.add(new AmbientLight(0xffffff, 1.05));
  const sun = new DirectionalLight(0xffffff, 2.5);
  sun.position.set(-3.2, 5, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // backdrop that only shows shadows, over the flat poster colour
  // shadows take a dark shade of the poster colour instead of grey
  const shadowMat = new ShadowMaterial({ opacity: 0.28, color: new Color(portraits[0].bg).multiplyScalar(0.32) });
  const backdrop = new Mesh(new PlaneGeometry(60, 40), shadowMat);
  backdrop.position.z = -2.1;
  backdrop.receiveShadow = true;
  scene.add(backdrop);

  /* ---------- letters ---------- */
  const letterMat = new MeshStandardMaterial({ color: inkColor, roughness: 0.62, metalness: 0 });
  const LINES = ['JANA', 'NAGYOVÁ'];
  const letters = [];
  LINES.forEach((word, line) => {
    let x = 0;
    for (const ch of word) {
      const geo = new TextGeometry(ch, {
        font, size: 1, depth: 0.3, curveSegments: 6,
        bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.012, bevelSegments: 2,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
      geo.translate(-cx, -cy, -cz); // pivot in the middle of the glyph
      const mesh = new Mesh(geo, letterMat);
      mesh.castShadow = true;
      const pivot = new Group();
      pivot.add(mesh);
      scene.add(pivot);
      letters.push({
        ch, line, pivot, mesh,
        ox: x + cx, oy: cy, // glyph centre inside its line, unit size
        rot: new Vector2(), vel: new Vector2(), spin: 0, spinVel: 0, push: 0, pushVel: 0,
        base: { x: 0, y: 0, z: LETTER_Z, s: 1 }, ndc: new Vector2(),
      });
      x += fontData.glyphs[ch].ha / fontData.resolution;
    }
  });
  const lineWidth = (line) => [...LINES[line]].reduce((w, ch) => w + fontData.glyphs[ch].ha / fontData.resolution, 0);
  // cap height at unit size, measured from the J
  const capH = (() => { const g = new TextGeometry('N', { font, size: 1, depth: 0.01 }); g.computeBoundingBox(); return g.boundingBox.max.y - g.boundingBox.min.y; })();

  /* ---------- portrait ---------- */
  const loader = new TextureLoader();
  const texCache = new Map();
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  function loadPortrait(i) {
    if (texCache.has(i)) return texCache.get(i);
    const p = portraits[i];
    const promise = Promise.all([
      new Promise((res, rej) => loader.load(`/img/figure/jana-${p.photo}-${small ? 768 : 1280}.webp`, res, undefined, rej)),
      new Promise((res, rej) => loader.load(`/img/figure/jana-${p.photo}-depth.png`, res, undefined, rej)),
    ]).then(([color, depth]) => {
      color.colorSpace = SRGBColorSpace;
      color.anisotropy = 8;
      // small alpha lookup for hit testing
      const c = document.createElement('canvas'); c.width = 48; c.height = 72;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(color.image, 0, 0, 48, 72);
      return { color, depth, aspect: color.image.width / color.image.height, alpha: g.getImageData(0, 0, 48, 72).data };
    });
    texCache.set(i, promise);
    return promise;
  }

  const RELIEF = 0.24;
  const figMat = new MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, roughness: 1, metalness: 0,
    transparent: true, alphaTest: 0.02, displacementScale: RELIEF, displacementBias: -RELIEF * 0.5, toneMapped: false,
  });
  const figDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaTest: 0.5, displacementScale: RELIEF, displacementBias: -RELIEF * 0.5 });
  const figure = new Mesh(new PlaneGeometry(1, 1, 150, 230), figMat);
  figure.customDepthMaterial = figDepth;
  figure.castShadow = true;
  const figPivot = new Group();
  figPivot.add(figure);
  scene.add(figPivot);
  let current = null; // { color, depth, aspect, alpha }
  function applyPortrait(t) {
    current = t;
    figMat.map = t.color; figMat.emissiveMap = t.color; figMat.displacementMap = t.depth; figMat.needsUpdate = true;
    figDepth.map = t.color; figDepth.displacementMap = t.depth; figDepth.needsUpdate = true;
    layout();
  }

  /* ---------- layout ---------- */
  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const frameW = FRAME_H * camera.aspect;
    const mobile = camera.aspect < 0.85;
    const px = FRAME_H / h; // world units per pixel at z = 0
    const headerH = 64 * px;
    const margin = Math.max(16, Math.min(44, w * 0.034)) * px;

    // portrait: stands on the bottom edge of the frame
    const aspect = current ? current.aspect : 0.65;
    let fh, fx;
    if (mobile) {
      fh = Math.min(FRAME_H * 0.8, (frameW * 1.02) / aspect);
      fx = 0;
    } else {
      fh = FRAME_H * 0.95;
      fx = Math.min(frameW / 2 - (fh * aspect) / 2 - frameW * 0.06, frameW * 0.22);
    }
    const fw = fh * aspect;
    const fy = -FRAME_H / 2 + fh / 2 - 0.22; // a little below the edge, so parallax never shows the cut
    figure.scale.set(fw, fh, 1);
    figPivot.position.set(fx, fy, 0);

    // name: two lines, as large as the frame allows
    const gap = 0.08;
    const maxW = frameW - margin * 2;
    let size = maxW / Math.max(lineWidth(0), lineWidth(1));
    const topY = FRAME_H / 2 - headerH - margin * 0.5;
    if (!mobile) {
      // keep clear of the caption block in the lower left
      const footTop = -FRAME_H / 2 + ((foot ? foot.offsetHeight : 160) + 40) * px;
      size = Math.min(size, (topY - footTop - 0.15) / (capH * 2 + gap));
    }
    size = Math.min(size, 2.4);
    const lineH = capH * size;
    const faceBottom = fy + fh / 2 - fh * 0.36;
    for (const L of letters) {
      const y = topY - lineH / 2 - L.line * (lineH + gap * size);
      const x = -frameW / 2 + margin + L.ox * size;
      // in front of her only where it cannot cover the face
      const front = !mobile && L.line === 1 && Math.abs(x - fx) < fw * 0.42 && y + lineH / 2 < faceBottom;
      const z = front ? FRONT_Z : LETTER_Z;
      const persp = (DIST - z) / DIST; // keep apparent size and position
      L.base = { x: x * persp, y: y * persp, z, s: size * persp };
      L.pivot.position.set(L.base.x, L.base.y, z);
      L.pivot.scale.setScalar(L.base.s);
      L.ndc.set((x / frameW) * 2, (y / FRAME_H) * 2);
    }

    const sc = sun.shadow.camera;
    sc.left = -frameW / 2 - 2; sc.right = frameW / 2 + 2; sc.top = FRAME_H / 2 + 2; sc.bottom = -FRAME_H / 2 - 2;
    sc.near = 0.5; sc.far = 30; sc.updateProjectionMatrix();
    requestRender();
  }

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false, down: null, lastX: 0, lastY: 0, moved: 0 };
  const ray = new Raycaster();
  const ndc = new Vector2();
  function toNdc(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  }
  function pick(e) {
    const [x, y] = toNdc(e);
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([figure, ...letters.map((l) => l.mesh)], false);
    for (const h of hits) {
      if (h.object === figure) {
        if (!current || !h.uv) continue;
        const ix = Math.min(47, Math.floor(h.uv.x * 48));
        const iy = Math.min(71, Math.floor((1 - h.uv.y) * 72));
        if (current.alpha[(iy * 48 + ix) * 4 + 3] > 90) return { figure: true };
      } else {
        return { letter: letters.find((l) => l.mesh === h.object) };
      }
    }
    return null;
  }

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = toNdc(e);
    pointer.x = x; pointer.y = y; pointer.inside = true;
    if (pointer.down) {
      const dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY;
      pointer.lastX = e.clientX; pointer.lastY = e.clientY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      if (pointer.down.letter) {
        const L = pointer.down.letter;
        L.rot.y += dx * 0.012; L.rot.x += dy * 0.012;
        L.vel.set(dy * 0.6, dx * 0.6);
      }
    } else if (e.pointerType === 'mouse') {
      const hit = pick(e);
      canvas.style.cursor = hit ? (hit.figure ? 'pointer' : 'grab') : 'default';
    }
    requestRender();
  });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; requestRender(); });
  canvas.addEventListener('pointerdown', (e) => {
    const hit = pick(e);
    pointer.down = hit || { none: true };
    pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.moved = 0;
    if (hit && hit.letter) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
  });
  const release = () => {
    const d = pointer.down;
    pointer.down = null;
    if (!d) return;
    if (pointer.moved < 8) {
      if (d.figure) document.dispatchEvent(new CustomEvent('portrait-next'));
      else if (d.letter) { d.letter.spinVel += 16; d.letter.pushVel -= 3; }
    }
    canvas.style.cursor = 'default';
    requestRender();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  /* ---------- portrait switching ---------- */
  let index = 0;
  const trans = { active: false, t: 0, swapped: false, tex: null, fromBg: new Color(), toBg: new Color(), fromInk: new Color(), toInk: new Color() };
  document.addEventListener('portrait-show', async (e) => {
    const to = e.detail;
    if (to === index && !trans.active) return;
    index = to;
    const tex = await loadPortrait(to);
    if (index !== to) return; // a newer request arrived meanwhile
    if (reduceMotion.matches) {
      bg.set(portraits[to].bg); renderer.setClearColor(bg); letterMat.color.set(portraits[to].ink);
      shadowMat.color.copy(bg).multiplyScalar(0.32);
      applyPortrait(tex);
      return;
    }
    Object.assign(trans, { active: true, t: 0, swapped: false, tex });
    trans.fromBg.copy(bg); trans.toBg.set(portraits[to].bg);
    trans.fromInk.copy(letterMat.color); trans.toInk.set(portraits[to].ink);
    letters.forEach((L, i) => { L.spinVel += (i % 2 ? -1 : 1) * (6 + ((i * 37) % 7)); L.pushVel -= 2.5; });
    start();
  });

  /* ---------- loop ---------- */
  let raf = 0, last = performance.now(), running = false, visible = true, time = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const moving = !reduceMotion.matches;
    if (moving) time += dt;

    // pointer smoothing; without a mouse the camera drifts a little on its own
    const k = 1 - Math.pow(0.002, dt);
    const tx = pointer.inside ? pointer.x : Math.sin(time * 0.23) * 0.35;
    const ty = pointer.inside ? pointer.y : Math.sin(time * 0.17) * 0.2;
    pointer.sx += (tx - pointer.sx) * k;
    pointer.sy += (ty - pointer.sy) * k;
    if (moving) {
      camera.position.set(pointer.sx * 0.45, pointer.sy * 0.28, DIST);
      camera.lookAt(0, 0, 0);
    }

    // letters: damped springs towards a pose that leans to the pointer
    for (let i = 0; i < letters.length; i++) {
      const L = letters[i];
      const idle = moving ? Math.sin(time * 0.9 + i * 0.7) * 0.05 : 0;
      const aimY = moving ? MathUtils.clamp((pointer.sx - L.ndc.x) * 0.45, -0.5, 0.5) : 0;
      const aimX = moving ? MathUtils.clamp(-(pointer.sy - L.ndc.y) * 0.35, -0.4, 0.4) : 0;
      if (!(pointer.down && pointer.down.letter === L)) {
        L.vel.x += ((aimX + idle) - L.rot.x) * 70 * dt - L.vel.x * 11 * dt;
        L.vel.y += ((aimY - idle * 0.6) - L.rot.y) * 70 * dt - L.vel.y * 11 * dt;
        L.rot.x += L.vel.x * dt;
        L.rot.y += L.vel.y * dt;
      }
      L.spinVel += -L.spin * 40 * dt - L.spinVel * 6 * dt;
      L.spin += L.spinVel * dt;
      L.pushVel += -L.push * 60 * dt - L.pushVel * 9 * dt;
      L.push += L.pushVel * dt;
      L.pivot.rotation.set(L.rot.x, L.rot.y + L.spin, idle * 0.3);
      L.pivot.position.z = L.base.z + L.push;
    }

    // portrait change: turn away, swap, turn back; colours blend across
    if (trans.active) {
      trans.t = Math.min(1, trans.t + dt / 1.1);
      const e = easeInOut(trans.t);
      bg.copy(trans.fromBg).lerp(trans.toBg, e);
      renderer.setClearColor(bg);
      shadowMat.color.copy(bg).multiplyScalar(0.32);
      letterMat.color.copy(trans.fromInk).lerp(trans.toInk, e);
      if (trans.t < 0.5) {
        figPivot.rotation.y = easeInOut(trans.t * 2) * (Math.PI / 2);
      } else {
        if (!trans.swapped) { applyPortrait(trans.tex); trans.swapped = true; }
        figPivot.rotation.y = -(1 - easeInOut((trans.t - 0.5) * 2)) * (Math.PI / 2);
      }
      if (trans.t >= 1) { trans.active = false; figPivot.rotation.y = 0; }
    }

    renderer.render(scene, camera);
    if (running && (moving || trans.active)) raf = requestAnimationFrame(frame);
  }
  function requestRender() {
    if (!raf && !document.hidden && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function start() { running = true; requestRender(); }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); else stop(); }).observe(canvas);
  }
  reduceMotion.addEventListener?.('change', start);
  window.addEventListener('resize', layout);

  applyPortrait(await loadPortrait(0));
  // preload the other portraits once the first one is on screen
  setTimeout(() => portraits.forEach((_, i) => i && loadPortrait(i)), 1200);
  start();
  requestAnimationFrame(() => html.classList.add('has-3d'));
}

if (!canvas || !dataEl || !webglAvailable()) {
  html.classList.add('no-3d');
} else {
  init().catch((err) => {
    console.error(err);
    html.classList.add('no-3d');
  });
}
