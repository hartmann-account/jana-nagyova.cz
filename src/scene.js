// 3D stage: the portraits hang as framed panels on a slowly turning ring.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, BoxGeometry,
  MeshBasicMaterial, MeshStandardMaterial, AmbientLight, DirectionalLight, SpotLight,
  TextureLoader, SRGBColorSpace, Fog, Color, BufferGeometry, Float32BufferAttribute,
  Points, PointsMaterial, AdditiveBlending, CanvasTexture, Raycaster, Vector2, CircleGeometry,
  MathUtils,
} from 'three';

const canvas = document.getElementById('stage');
const hero = document.querySelector('.hero');
const dataEl = document.getElementById('photo-data');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

if (!canvas || !dataEl || !webglAvailable()) {
  document.documentElement.classList.add('no-webgl');
} else {
  try { init(); } catch (err) {
    console.error(err);
    document.documentElement.classList.add('no-webgl');
  }
}

function radialSprite(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function init() {
  const photos = JSON.parse(dataEl.textContent);
  const BG = new Color('#0f0c0d');
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.fog = new Fog(BG, 9, 22);
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);

  scene.add(new AmbientLight(0xffe9d2, 0.9));
  const key = new DirectionalLight(0xfff1dc, 2.2);
  key.position.set(2, 6, 9);
  scene.add(key);
  const spot = new SpotLight(0xffe2b8, 160, 30, Math.PI / 7, 0.6, 1.6);
  spot.position.set(0, 9, 6);
  scene.add(spot, spot.target);

  // Ring of framed portraits
  const ring = new Group();
  scene.add(ring);
  const R = 5.2;
  const H = 3.3;
  const loader = new TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const frameMat = new MeshStandardMaterial({ color: 0xb48d52, metalness: 0.85, roughness: 0.35 });
  const backMat = new MeshStandardMaterial({ color: 0x1a1415, metalness: 0.2, roughness: 0.9 });
  const panels = [];
  const size = small ? 640 : 1200;

  photos.forEach((p, i) => {
    const w = H * (p.w / p.h);
    const holder = new Group();
    const angle = (i / photos.length) * Math.PI * 2;
    holder.position.set(Math.sin(angle) * R, 0, Math.cos(angle) * R);
    holder.rotation.y = angle;

    const frame = new Mesh(new BoxGeometry(w + 0.16, H + 0.16, 0.08), [frameMat, frameMat, frameMat, frameMat, frameMat, backMat]);
    holder.add(frame);
    const mat = new MeshBasicMaterial({ color: 0x2a2224 });
    const pic = new Mesh(new PlaneGeometry(w, H), mat);
    pic.position.z = 0.045;
    pic.userData.index = i;
    holder.add(pic);
    // same photo on the back, so panels at the rear of the ring are not blank
    const backPic = new Mesh(pic.geometry, mat);
    backPic.position.z = -0.045;
    backPic.rotation.y = Math.PI;
    backPic.userData.index = i;
    holder.add(backPic);
    loader.load(`/img/jana-nagyova-${p.id}-${size}.webp`, (tex) => {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = maxAniso;
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
      requestRender();
    });
    ring.add(holder);
    panels.push({ holder, pic, backPic, mat });
  });

  // Stage floor: a soft pool of light under the ring
  const floor = new Mesh(
    new CircleGeometry(9, 64),
    new MeshBasicMaterial({
      map: radialSprite(256, [[0, 'rgba(201,166,107,0.34)'], [0.45, 'rgba(110,28,38,0.16)'], [1, 'rgba(15,12,13,0)']]),
      transparent: true, depthWrite: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -H / 2 - 0.55;
  scene.add(floor);

  // Gold dust
  const COUNT = small ? 360 : 720;
  const pos = new Float32Array(COUNT * 3);
  const speed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 2 + Math.random() * 10;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.sin(a) * r;
    pos[i * 3 + 1] = -3 + Math.random() * 8;
    pos[i * 3 + 2] = Math.cos(a) * r;
    speed[i] = 0.08 + Math.random() * 0.22;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({
    size: small ? 0.07 : 0.055, map: radialSprite(64, [[0, 'rgba(255,230,180,1)'], [0.35, 'rgba(230,190,120,0.55)'], [1, 'rgba(230,190,120,0)']]),
    color: 0xe0bd82, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.85,
  }));
  scene.add(dust);

  // State
  const state = {
    rot: 0, rotTarget: 0, vel: 0, auto: 0.06,
    dragging: false, lastX: 0, downX: 0, downY: 0, moved: 0,
    px: 0, py: 0, pxs: 0, pys: 0, scroll: 0, scrollS: 0,
    hover: -1, layout: { x: 0, z: 13, y: 0.4, look: 0 },
  };

  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const aspect = camera.aspect;
    if (aspect >= 1.15) {
      state.layout = { x: Math.min(2.7, 0.9 + aspect * 0.85), z: 14.6, y: 0.35, look: 0 };
    } else if (aspect >= 0.8) {
      state.layout = { x: 0, z: 16, y: 0.8, look: -0.6 };
    } else {
      // portrait phones: smaller ring in the upper part, text below
      state.layout = { x: 0, z: Math.min(24, 10.5 / Math.max(aspect, 0.4)), y: 1.4, look: -2.4 };
    }
    camera.updateProjectionMatrix();
    requestRender();
  }

  // Pointer interaction on the hero area (the canvas sits behind the content)
  const ray = new Raycaster();
  const ndc = new Vector2();
  function pick(clientX, clientY) {
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(panels.flatMap((p) => [p.pic, p.backPic]), false)[0];
    return hit ? hit.object.userData.index : -1;
  }
  const target = hero || window;
  target.style && (target.style.pointerEvents = 'auto');
  target.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a,button')) return;
    state.dragging = true; state.lastX = e.clientX; state.downX = e.clientX; state.downY = e.clientY; state.moved = 0;
  });
  window.addEventListener('pointermove', (e) => {
    state.px = (e.clientX / window.innerWidth) * 2 - 1;
    state.py = (e.clientY / window.innerHeight) * 2 - 1;
    if (state.dragging) {
      const dx = e.clientX - state.lastX;
      state.lastX = e.clientX;
      state.moved += Math.abs(dx);
      state.rotTarget += dx * 0.006;
      state.vel = dx * 0.006;
    } else if (window.scrollY < window.innerHeight * 0.8 && e.pointerType === 'mouse') {
      const idx = pick(e.clientX, e.clientY);
      if (idx !== state.hover) {
        state.hover = idx;
        hero && (hero.style.cursor = idx >= 0 ? 'pointer' : 'grab');
      }
    }
    requestRender();
  }, { passive: true });
  window.addEventListener('pointerup', (e) => {
    if (!state.dragging) return;
    state.dragging = false;
    const dist = Math.hypot(e.clientX - state.downX, e.clientY - state.downY);
    if (dist < 6) {
      const idx = pick(e.clientX, e.clientY);
      if (idx >= 0) document.dispatchEvent(new CustomEvent('open-photo', { detail: idx }));
    }
  });
  window.addEventListener('pointercancel', () => { state.dragging = false; });
  window.addEventListener('scroll', () => { state.scroll = window.scrollY; requestRender(); }, { passive: true });
  window.addEventListener('resize', layout);
  if (hero) hero.style.cursor = 'grab';

  // Render loop
  let raf = 0;
  let last = performance.now();
  let running = false;
  const animate = () => !reduceMotion.matches;

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const moving = animate();

    if (moving && !state.dragging) {
      state.rotTarget += state.vel;
      state.vel *= 0.94;
      state.rotTarget += state.auto * dt;
    }
    const vh = window.innerHeight;
    state.scrollS += (state.scroll - state.scrollS) * (moving ? 0.08 : 1);
    const sp = Math.min(state.scrollS / vh, 6);
    const k = moving ? 0.08 : 1;
    state.rot += (state.rotTarget + sp * 0.55 - state.rot) * k;
    state.pxs += (state.px - state.pxs) * 0.05;
    state.pys += (state.py - state.pys) * 0.05;

    ring.rotation.y = -state.rot;
    const L = state.layout;
    const back = Math.min(sp, 1.4);
    ring.position.x = MathUtils.lerp(L.x, 0, Math.min(sp, 1));
    camera.position.set(state.pxs * 0.6, L.y + state.pys * -0.35 + back * 1.6, L.z + back * 3.2);
    camera.lookAt(ring.position.x * 0.15, 0.1 + L.look * (1 - Math.min(sp, 1)) - back * 0.3, 0);

    panels.forEach((p, i) => {
      const s = i === state.hover && sp < 0.8 ? 1.035 : 1;
      p.holder.scale.x += (s - p.holder.scale.x) * 0.15;
      p.holder.scale.y = p.holder.scale.x;
    });

    if (moving) {
      const arr = dustGeo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] += speed[i] * dt;
        if (arr[i * 3 + 1] > 5) arr[i * 3 + 1] = -3;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dust.rotation.y += dt * 0.015;
    }

    renderer.render(scene, camera);
    if (moving && running) raf = requestAnimationFrame(frame);
  }

  function requestRender() {
    if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function start() { running = true; requestRender(); }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener?.('change', start);

  layout();
  state.scroll = state.scrollS = window.scrollY;
  start();
}
