// Hero: a Czech paper theatre (papírové divadlo). Printed proscenium with her name,
// wings and backdrop at real depths, and Jana Nagyová as a cardboard cut-out on stage.
// Pointer or device tilt moves the camera a few degrees, so the layers shift against
// each other. Changing the portrait is a scene change behind the curtain: the light dims,
// the curtain closes, wings, backdrop and figure are swapped, and she sways as it opens.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, BoxGeometry, SphereGeometry,
  ExtrudeGeometry, Shape, Vector2, MathUtils, Raycaster,
  MeshBasicMaterial, MeshStandardMaterial, MeshDepthMaterial,
  AmbientLight, SpotLight, PointLight, TextureLoader, CanvasTexture, SRGBColorSpace,
  PCFShadowMap, RGBADepthPacking, NoToneMapping, DoubleSide, RepeatWrapping,
} from 'three';
import * as art from './stage-art.js';

const canvas = document.querySelector('.hero__canvas');
const dataEl = document.getElementById('portrait-data');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const html = document.documentElement;

const FOV = 32;
const D = 9; // camera distance to the proscenium
const BACK = -2.8; // backdrop depth
const FIG_Z = -0.75;
const WING_Z = [-0.55, -1.6];

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const seg = (t, a, b) => ease(clamp01((t - a) / (b - a)));

function tex(canvasEl, repeat = false) {
  const t = new CanvasTexture(canvasEl);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

async function init() {
  const portraits = JSON.parse(dataEl.textContent);
  const sub = canvas.dataset.sub || '';
  try { await Promise.all([document.fonts.load('600 40px Literata'), document.fonts.load('italic 400 20px Literata')]); } catch { /* fallback font */ }

  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x2a1c16, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, D);

  // light: warm house light, a stage spot with crisp shadows, footlights
  const ambient = new AmbientLight(0xfff0dc, 1.85);
  scene.add(ambient);
  const spot = new SpotLight(0xffecd0, 1.9, 0, 0.62, 0.55, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  spot.shadow.radius = 4;
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.01;
  scene.add(spot, spot.target);
  const foot = [new PointLight(0xffc27a, 1.1, 5, 1.2), new PointLight(0xffc27a, 1.1, 5, 1.2)];
  foot.forEach((l) => scene.add(l));
  const LIGHT = { ambient: ambient.intensity, spot: spot.intensity, foot: foot[0].intensity };
  let lightLevel = 1;
  const setLight = (k) => {
    lightLevel = k;
    ambient.intensity = LIGHT.ambient * (0.45 + 0.55 * k);
    prosMat.color.setScalar(0.72 + 0.28 * k); // the house lights dim a little too
    spot.intensity = LIGHT.spot * k;
    foot.forEach((l) => { l.intensity = LIGHT.foot * (0.3 + 0.7 * k); });
  };

  /* ---------- fixed front of house ---------- */
  const prosMat = new MeshBasicMaterial({ transparent: true, alphaTest: 0.5 });
  const pros = new Mesh(new PlaneGeometry(1, 1), prosMat);
  scene.add(pros);
  const valanceMat = new MeshBasicMaterial({ map: tex(art.curtain(1600, 260, { valance: true })), transparent: true, alphaTest: 0.4 });
  const valance = new Mesh(new PlaneGeometry(1, 1), valanceMat);
  scene.add(valance);
  const curtainTex = tex(art.curtain(800, 1400));
  const curtains = [-1, 1].map((side) => {
    const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: curtainTex }));
    m.userData.side = side;
    scene.add(m);
    return m;
  });
  const rampMat = new MeshStandardMaterial({ map: tex(art.ramp(1600, 120)), roughness: 0.8 });
  const rampMesh = new Mesh(new BoxGeometry(1, 1, 1), [rampMat, rampMat, new MeshStandardMaterial({ color: 0x2a1c16 }), rampMat, rampMat, rampMat]);
  scene.add(rampMesh);
  const bulbs = new Group();
  const bulbMat = new MeshBasicMaterial({ color: 0xffe0a6 });
  for (let i = 0; i < 9; i++) bulbs.add(new Mesh(new SphereGeometry(1, 10, 8), bulbMat));
  scene.add(bulbs);

  /* ---------- scenery (swapped per scene) ---------- */
  const paint = new Map(); // scene kind -> textures
  function scenery(kind) {
    if (!paint.has(kind)) {
      const t = {
        backdrop: tex(art.backdrop(kind, 1600, 1000)),
        wings: [tex(art.wing(kind, 500, 1100, 0)), tex(art.wing(kind, 500, 1100, 1))],
        floor: tex(art.floor(kind, 1024, 512)),
      };
      paint.set(kind, t);
    }
    return paint.get(kind);
  }
  const backMat = new MeshStandardMaterial({ roughness: 0.92 });
  const backdropMesh = new Mesh(new PlaneGeometry(1, 1), backMat);
  backdropMesh.receiveShadow = true;
  scene.add(backdropMesh);
  const floorMat = new MeshStandardMaterial({ roughness: 0.9 });
  const floorMesh = new Mesh(new PlaneGeometry(1, 1), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  const wings = [];
  for (const [k, z] of WING_Z.entries()) {
    for (const side of [-1, 1]) {
      const mat = new MeshStandardMaterial({ transparent: true, alphaTest: 0.5, roughness: 0.9, side: DoubleSide });
      const depthMat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaTest: 0.5 });
      const m = new Mesh(new PlaneGeometry(1, 1), mat);
      m.customDepthMaterial = depthMat;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { k, z, side, depthMat, base: 0 };
      scene.add(m);
      wings.push(m);
    }
  }
  function applyScenery(kind) {
    const t = scenery(kind);
    backMat.map = t.backdrop; backMat.needsUpdate = true;
    floorMat.map = t.floor; floorMat.needsUpdate = true;
    for (const w of wings) {
      w.material.map = t.wings[w.userData.k]; w.material.needsUpdate = true;
      w.userData.depthMat.map = t.wings[w.userData.k]; w.userData.depthMat.needsUpdate = true;
    }
  }

  /* ---------- the figure: photo on a cardboard cut-out ---------- */
  const loader = new TextureLoader();
  const portraitCache = new Map();
  function loadPortrait(i) {
    if (portraitCache.has(i)) return portraitCache.get(i);
    const p = portraits[i];
    // same rule as the preload in the page head: sharp figure on high-density screens
    const size = (window.devicePixelRatio || 1) >= 1.5 ? 1280 : 768;
    const promise = Promise.all([
      new Promise((res, rej) => loader.load(`/img/figure/jana-${p.photo}-${size}.webp`, res, undefined, () => rej(new Error(`figure ${p.photo}`)))),
      Promise.resolve(p.card),
    ]).then(([photo, card]) => {
      photo.colorSpace = SRGBColorSpace;
      photo.anisotropy = 8;
      return { photo, card };
    }).catch((err) => { portraitCache.delete(i); throw err; });
    portraitCache.set(i, promise);
    return promise;
  }
  const cardFaceMat = new MeshStandardMaterial({ map: tex(art.cardFace(256, 256), true), roughness: 0.85 });
  const cardEdgeMat = new MeshStandardMaterial({ map: tex(art.cardboard(64, 64), true), roughness: 1 });
  const photoMat = new MeshStandardMaterial({ transparent: true, alphaTest: 0.04, roughness: 0.82 });
  const figure = new Group(); // pivot at the bottom centre
  const cardHolder = new Group();
  figure.add(cardHolder);
  const photoMesh = new Mesh(new PlaneGeometry(1, 1), photoMat);
  figure.add(photoMesh);
  scene.add(figure);
  let cardMesh = null;
  let current = null; // { photo, card }
  const fig = { x: 0, lift: 0, liftV: 0, swing: 0, swingV: 0, hover: false, height: 1, bottom: 0 };
  const CARD_DEPTH = 0.024;
  function buildFigure() {
    if (!current) return;
    const H = fig.height, W = H * current.card.aspect;
    const shape = new Shape(current.card.outline.map(([x, y]) => new Vector2((x - 0.5) * W, y * H)));
    const geo = new ExtrudeGeometry(shape, { depth: CARD_DEPTH, bevelEnabled: false, curveSegments: 1 });
    if (cardMesh) { cardHolder.remove(cardMesh); cardMesh.geometry.dispose(); }
    cardMesh = new Mesh(geo, [cardFaceMat, cardEdgeMat]);
    cardMesh.castShadow = true;
    cardHolder.add(cardMesh);
    photoMesh.scale.set(W, H, 1);
    photoMesh.position.set(0, H / 2, CARD_DEPTH + 0.002);
    photoMat.map = current.photo; photoMat.needsUpdate = true;
  }

  /* ---------- layout ---------- */
  const L = {};
  let prosKey = '';
  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const frameH = 2 * D * Math.tan(MathUtils.degToRad(FOV / 2));
    const frameW = frameH * camera.aspect;
    const tall = camera.aspect < 0.9;
    const pw = frameW * 1.08, ph = frameH * 1.08;
    const o = tall ? { x0: 0.05, x1: 0.95, y0: 0.22, y1: 0.9, arch: 0.04 } : { x0: 0.13, x1: 0.87, y0: 0.2, y1: 0.89, arch: 0.07 };

    // printed proscenium sheet at a resolution matching the screen
    const sw = Math.min(2048, Math.round(w * renderer.getPixelRatio() * 1.08));
    const sh = Math.round(sw * (ph / pw));
    const key = `${tall}|${Math.round(sw / 160)}|${Math.round(h / 40)}`;
    if (key !== prosKey) {
      prosKey = key;
      const headerPx = (document.querySelector('.top')?.offsetHeight || 56) + 8;
      const minTop = ((ph - frameH) / 2 / ph + headerPx / h / 1.08) * sh; // sheet px below the header
      const c = art.proscenium(sw, sh, { x0: o.x0 * sw, x1: o.x1 * sw, y0: o.y0 * sh, y1: o.y1 * sh, arch: o.arch * sh }, 'JANA NAGYOVÁ', sub, minTop);
      if (prosMat.map) prosMat.map.dispose();
      prosMat.map = tex(c); prosMat.needsUpdate = true;
    }
    pros.scale.set(pw, ph, 1);

    const X = (nx) => (nx - 0.5) * pw, Y = (ny) => (0.5 - ny) * ph;
    const oxL = X(o.x0), oxR = X(o.x1), oyT = Y(o.y0) - (o.arch * ph) * 0.2, oyB = Y(o.y1);
    const Wo = oxR - oxL, Ho = oyT - oyB;
    Object.assign(L, { Wo, Ho, oyT, oyB, tall });

    valance.scale.set(Wo * 1.04, Ho * (tall ? 0.09 : 0.13), 1);
    valance.position.set(0, oyT - valance.scale.y * 0.32, -0.02);
    for (const c of curtains) c.scale.set(Wo * 0.56, Ho * 1.02, 1);

    const rampH = Ho * (tall ? 0.09 : 0.11);
    rampMesh.scale.set(Wo * 1.02, rampH, 0.05);
    rampMesh.position.set(0, oyB + rampH / 2, -0.04);
    bulbs.children.forEach((b, i) => {
      b.scale.setScalar(Math.min(Wo, Ho) * 0.009);
      b.position.set(((i + 0.5) / bulbs.children.length - 0.5) * Wo * 0.9, oyB + rampH * 1.02, -0.09);
    });
    foot[0].position.set(-Wo * 0.25, oyB + rampH * 1.2, -0.25);
    foot[1].position.set(Wo * 0.25, oyB + rampH * 1.2, -0.25);

    const floorY = oyB + rampH * 0.62;
    const sB = (D - BACK) / D;
    const backW = Wo * sB * 1.2, backH = (oyT * sB - floorY) * 1.18;
    backdropMesh.scale.set(backW, backH, 1);
    backdropMesh.position.set(0, floorY + backH / 2, BACK);
    // cover-fit the 1.6:1 backdrop sheet, anchored at the bottom
    const pa = backW / backH, ta = 1.6;
    const bt = scenery(portraits[index].scene).backdrop;
    fitCover(bt, pa, ta);
    // floor runs from just behind the ramp to the backdrop, never in front of the proscenium
    floorMesh.scale.set(backW * 1.05, -BACK - 0.08, 1);
    floorMesh.position.set(0, floorY, (BACK - 0.08) / 2);

    for (const m of wings) {
      const { k, z, side } = m.userData;
      const s = (D - z) / D;
      const inset = Wo * (tall ? [0.05, 0.11][k] : [0.07, 0.15][k]);
      const wa = Wo * (tall ? 0.3 : 0.26);
      const xi = Wo / 2 - inset, xo = xi + wa;
      const wh = oyT * s * 1.05 - floorY;
      m.scale.set(wa * s * (side < 0 ? -1 : 1), wh, 1);
      m.userData.base = side * ((xi + xo) / 2) * s;
      m.position.set(m.userData.base, floorY + wh / 2, z);
    }

    // figure: as tall as the opening allows, lower edge hidden by the ramp
    const sF = (D - FIG_Z) / D;
    const hide = (oyB + rampH) * ((D - FIG_Z) / (D + 0.04));
    const bottom = hide - Ho * 0.05;
    let top = (oyT - Ho * (tall ? 0.05 : 0.04)) * sF;
    const aspect = current ? current.card.aspect : 0.66;
    let H = top - bottom;
    const maxW = Wo * (tall ? 0.86 : 0.78) * sF;
    if (H * aspect > maxW) H = maxW / aspect;
    fig.height = H; fig.bottom = bottom;
    figure.position.set(fig.x, bottom, FIG_Z);
    buildFigure();

    // spot from above the house, aimed at her face
    spot.position.set(Wo * 0.06, oyT * 2.2 + 1.6, 3.4); // steep, so her shadow falls behind her
    spot.target.position.set(0, bottom + H * 0.62, FIG_Z);
    const sc = spot.shadow.camera; sc.near = 1; sc.far = 20; sc.updateProjectionMatrix();

    setCurtains(curtainOpen);
    requestRender();
  }
  function fitCover(t, pa, ta) {
    // crop mostly from the painted ground at the bottom, which the stage floor covers anyway
    if (pa < ta) { t.repeat.set(pa / ta, 1); t.offset.set((1 - pa / ta) / 2, 0); } else { t.repeat.set(1, ta / pa); t.offset.set(0, (1 - ta / pa) * 0.8); }
  }

  /* ---------- curtain ---------- */
  let curtainOpen = 0; // 0 closed, 1 open
  function setCurtains(k) {
    curtainOpen = k;
    const { Wo, Ho, oyB } = L;
    for (const c of curtains) {
      const side = c.userData.side;
      const closedX = side * Wo * 0.26, openX = side * (Wo * 0.5 + Wo * 0.07);
      c.position.set(MathUtils.lerp(closedX, openX, k), oyB + (Ho * 1.02) / 2, -0.035);
      c.scale.x = Wo * 0.56 * MathUtils.lerp(1, 0.32, k);
    }
  }
  const curtainAnim = { active: false, t: 0, from: 0, to: 1, dur: 1.7, delay: 0.25 };

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, active: 0, down: null, startX: 0, startY: 0 };
  const tilt = { x: 0, y: 0, on: false };
  const ray = new Raycaster();
  const ndc = new Vector2();
  function onFigure(e) {
    if (!cardMesh) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(cardMesh, false).length > 0;
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer.active = performance.now();
    clearTimeout(pointer.back); pointer.back = setTimeout(requestRender, 3050); // glide back to centre afterwards
    if (e.pointerType === 'mouse') {
      const over = onFigure(e);
      if (over !== fig.hover) { fig.hover = over; canvas.style.cursor = over ? 'pointer' : 'default'; }
    }
    requestRender();
  });
  canvas.addEventListener('pointerleave', () => { fig.hover = false; requestRender(); setTimeout(requestRender, 3050); });
  canvas.addEventListener('pointerdown', (e) => {
    pointer.down = onFigure(e);
    pointer.startX = e.clientX; pointer.startY = e.clientY;
  });
  let askedMotion = false;
  canvas.addEventListener('pointerup', (e) => {
    if (!askedMotion && typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
      askedMotion = true;
      window.DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    const was = pointer.down;
    pointer.down = null;
    if (was && Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) < 10) {
      document.dispatchEvent(new CustomEvent('portrait-next'));
    }
  });
  canvas.addEventListener('pointercancel', () => { pointer.down = null; });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || e.beta == null) return;
    const side = Math.abs(screen.orientation?.angle || 0) === 90;
    const nx = MathUtils.clamp((side ? e.beta : e.gamma) / 25, -1, 1);
    const ny = MathUtils.clamp(((side ? -e.gamma : e.beta) - (side ? 0 : 50)) / 25, -1, 1);
    if (Math.abs(nx - tilt.x) + Math.abs(ny - tilt.y) < 0.02) return; // ignore sensor noise
    tilt.x += (nx - tilt.x) * 0.3;
    tilt.y += (ny - tilt.y) * 0.3;
    tilt.on = true;
    pointer.active = performance.now();
    requestRender();
  });

  /* ---------- scene changes: behind the curtain ---------- */
  let index = 0;
  let pending = null;
  let busy = false;
  const change = { active: false, t: 0, to: 0, swapped: false, kicked: false, data: null, dur: 1.8 };
  function drainPending() {
    if (pending !== null && pending !== index) { const p = pending; pending = null; startChange(p); } else pending = null;
  }
  async function startChange(to) {
    busy = true;
    let data;
    try { data = await loadPortrait(to); } catch (err) {
      console.error(err);
      busy = false;
      document.dispatchEvent(new CustomEvent('portrait-failed', { detail: index }));
      drainPending();
      return;
    }
    scenery(portraits[to].scene);
    busy = false;
    if (reduceMotion.matches) {
      index = to; current = data; applyScenery(portraits[to].scene); layout();
      drainPending();
      return;
    }
    Object.assign(change, { active: true, t: 0, to, swapped: false, kicked: false, data });
    start();
  }
  document.addEventListener('portrait-show', (e) => {
    const to = e.detail;
    if (busy || change.active) { pending = to; return; }
    if (to !== index) startChange(to);
  });

  /* ---------- loop ---------- */
  let raf = 0, last = performance.now(), running = false, visible = true;
  const startTime = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    const motion = !reduceMotion.matches;

    // camera: pointer, device tilt or a slow drift in the first seconds
    const idle = now - startTime < 7000 && now - pointer.active > 3000;
    const t = (now - startTime) / 1000;
    const tx = now - pointer.active < 3000 ? (tilt.on ? tilt.x : pointer.x) : idle ? Math.sin(t * 0.5) * 0.5 : 0;
    const ty = now - pointer.active < 3000 ? (tilt.on ? tilt.y : pointer.y) : idle ? Math.sin(t * 0.37) * 0.3 : 0;
    const k = motion ? 1 - Math.pow(0.004, dt) : 1;
    const gx = motion ? tx : 0, gy = motion ? ty : 0;
    pointer.sx += (gx - pointer.sx) * k;
    pointer.sy += (gy - pointer.sy) * k;
    camera.position.set(pointer.sx * 0.55, pointer.sy * 0.3, D);
    camera.lookAt(pointer.sx * 0.08, pointer.sy * 0.05, -1.2);
    const camMoving = Math.abs(gx - pointer.sx) + Math.abs(gy - pointer.sy) > 0.002;

    // curtain on first load
    if (curtainAnim.active) {
      curtainAnim.t += dt;
      const p = clamp01((curtainAnim.t - curtainAnim.delay) / curtainAnim.dur);
      setCurtains(MathUtils.lerp(curtainAnim.from, curtainAnim.to, ease(p)));
      if (p >= 1) curtainAnim.active = false;
    }

    // scene change: curtain closes, the stage is reset behind it, curtain opens
    if (change.active) {
      change.t = Math.min(1, change.t + dt / change.dur);
      const c = change.t;
      setLight(1 - 0.35 * seg(c, 0, 0.3) + 0.35 * seg(c, 0.6, 1));
      if (!change.swapped) {
        setCurtains(1 - seg(c, 0, 0.4));
        if (c >= 0.44) {
          change.swapped = true;
          index = change.to; current = change.data;
          applyScenery(portraits[index].scene);
          fig.swing = 0; fig.swingV = 0;
          layout();
          setCurtains(0);
        }
      } else {
        setCurtains(seg(c, 0.5, 1));
        if (c >= 0.62 && !change.kicked) { change.kicked = true; fig.swingV = 0.3; } // she sways as the curtain opens
      }
      if (change.t >= 1) {
        change.active = false;
        setLight(1);
        drainPending();
      }
    }

    // swing on its wire, lift on hover
    if (motion) {
      fig.swingV += (-fig.swing * 26 - fig.swingV * 3.2) * dt;
      fig.swing += fig.swingV * dt;
      const liftTarget = fig.hover ? 0.035 : 0;
      fig.liftV += ((liftTarget - fig.lift) * 90 - fig.liftV * 14) * dt;
      fig.lift += fig.liftV * dt;
    }
    const settling = Math.abs(fig.swing) + Math.abs(fig.swingV) + Math.abs(fig.liftV) > 1e-4;
    if (!settling) { fig.swingV = 0; }
    figure.position.set(fig.x, fig.bottom + fig.lift, FIG_Z);
    figure.rotation.z = fig.swing;

    renderer.render(scene, camera);
    const keepGoing = change.active || curtainAnim.active || settling || camMoving || (motion && idle);
    if (running && keepGoing) raf = requestAnimationFrame(frame);
  }
  function requestRender() {
    if (!raf && !document.hidden && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function start() { running = true; requestRender(); }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); html.classList.replace('has-3d', 'no-3d'); });
  canvas.addEventListener('webglcontextrestored', () => { html.classList.replace('no-3d', 'has-3d'); layout(); start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); else stop(); }).observe(canvas);
  }
  reduceMotion.addEventListener?.('change', start);
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 120); });

  /* ---------- go ---------- */
  current = await loadPortrait(0);
  applyScenery(portraits[0].scene);
  layout();
  setCurtains(0);
  if (reduceMotion.matches) setCurtains(1);
  else Object.assign(curtainAnim, { active: true, t: 0 });
  start();
  requestAnimationFrame(() => html.classList.add('has-3d'));
  // paint the other scenes and fetch the other figures while the curtain opens
  if (!navigator.connection?.saveData) {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2400));
    idle(() => portraits.forEach((p, i) => { if (i) { loadPortrait(i).catch(() => {}); scenery(p.scene); } }), { timeout: 4000 });
  }
}

if (!canvas || !dataEl || !webglAvailable()) {
  html.classList.add('no-3d');
} else {
  init().catch((err) => {
    console.error(err);
    html.classList.add('no-3d');
  });
}
