// 3D stage: a fictional film set. Jana Nagyová stands against a scenery flat as a
// cut-out photo with a depth map (2.5D relief), lit by a Fresnel lamp, with a film
// camera on a dolly, director's chair, slate, cables and a lighting grid around her.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Object3D,
  PlaneGeometry, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, TorusGeometry,
  TubeGeometry, CatmullRomCurve3, Vector3, Vector2, Color, Fog,
  MeshStandardMaterial, MeshBasicMaterial, MeshDepthMaterial, ShaderMaterial,
  AmbientLight, HemisphereLight, SpotLight, PointLight,
  TextureLoader, CanvasTexture, SRGBColorSpace, RepeatWrapping, RGBADepthPacking,
  AdditiveBlending, DoubleSide, VSMShadowMap, ACESFilmicToneMapping,
  BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Raycaster, MathUtils,
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

/* ---------- procedural textures ---------- */

// deterministic pseudo random, so the set looks the same on every visit
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function mottle(g, w, h, base, blobs, seed, alpha = 0.06) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < blobs; i++) {
    const x = r() * w, y = r() * h, rad = 6 + r() * w * 0.12;
    const light = r() > 0.5;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, light ? `rgba(255,240,225,${alpha})` : `rgba(0,0,0,${alpha * 1.6})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

const wallTex = () => canvasTex(512, 512, (g, w, h) => mottle(g, w, h, '#2c2727', 260, 7), { repeat: [2, 1.4] });
const floorTex = () => canvasTex(1024, 1024, (g, w, h) => {
  mottle(g, w, h, '#1c1a1a', 420, 11, 0.05);
  const r = rng(5);
  g.strokeStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 40; i++) { // scuffs
    g.lineWidth = 1 + r() * 3;
    g.beginPath(); const x = r() * w, y = r() * h;
    g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 160, y + (r() - 0.5) * 40); g.stroke();
  }
}, { repeat: [5, 5] });
const woodTex = () => canvasTex(256, 256, (g, w, h) => {
  const r = rng(3);
  g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,220,180' : '40,20,10'},${0.05 + r() * 0.08})`;
    g.fillRect(0, y + Math.sin(y * 0.11) * 2, w, 1 + r() * 2);
  }
});
async function labelTex(w, h, draw) {
  try { await document.fonts.load('500 64px "Cormorant Garamond"'); await document.fonts.load('600 32px Manrope'); } catch {}
  return canvasTex(w, h, draw);
}

/* ---------- materials ---------- */
const M = {
  black: () => new MeshStandardMaterial({ color: 0x2c2929, roughness: 0.48, metalness: 0.18 }),
  satin: () => new MeshStandardMaterial({ color: 0x3d3939, roughness: 0.36, metalness: 0.3 }),
  chrome: () => new MeshStandardMaterial({ color: 0x9a9796, roughness: 0.28, metalness: 0.95 }),
  gold: () => new MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.32, metalness: 0.9 }),
};

function cyl(r1, r2, h, mat, seg = 16) { const m = new Mesh(new CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = true; return m; }
function box(w, h, d, mat) { const m = new Mesh(new BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }

// three-legged stand with a vertical pole
function stand(height, mat) {
  const g = new Group();
  const pole = cyl(0.018, 0.022, height, mat); pole.position.y = height / 2; g.add(pole);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.012, 0.012, 0.62, mat, 8);
    leg.position.set(Math.sin(a) * 0.22, 0.2, Math.cos(a) * 0.22);
    leg.rotation.set(Math.cos(a) * 0.95, 0, -Math.sin(a) * 0.95);
    g.add(leg);
  }
  return g;
}

function sandbag(mat) {
  const s = new Mesh(new SphereGeometry(0.12, 16, 10), mat);
  s.scale.set(1.5, 0.45, 0.8); s.castShadow = true; s.receiveShadow = true;
  return s;
}

// soft volumetric light cone (additive, fades along its length and at the rim)
function beam(length, radius, color, strength) {
  const geo = new ConeGeometry(radius, length, 48, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(-Math.PI / 2); // apex at origin, opening towards -z
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uColor: { value: new Color(color) }, uLen: { value: length }, uStrength: { value: strength } },
    vertexShader: `varying float vDist; varying vec3 vN; varying vec3 vView;
      void main(){ vDist = -position.z; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLen; uniform float uStrength; varying float vDist; varying vec3 vN; varying vec3 vView;
      void main(){ float along = 1.0 - smoothstep(0.0, uLen, vDist); float rim = pow(abs(dot(vN, vView)), 1.6);
        float a = along * along * rim * uStrength; gl_FragColor = vec4(uColor * a, a); }`,
  });
  return new Mesh(geo, mat);
}

// Fresnel lamp head on a stand, aimed at a target point
function fresnel(scene, { pos, target, color, intensity, angle, castShadow, standH, shadowSize }) {
  const g = new Group();
  const mat = M.black();
  const st = stand(standH, M.satin());
  g.add(st);
  const head = new Group();
  head.position.y = standH + 0.12;
  const body = cyl(0.16, 0.18, 0.34, mat, 24); body.rotation.x = Math.PI / 2; head.add(body);
  const back = cyl(0.12, 0.16, 0.08, mat, 24); back.rotation.x = Math.PI / 2; back.position.z = 0.2; head.add(back);
  const lens = new Mesh(new CylinderGeometry(0.135, 0.135, 0.01, 32), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(1.6) }));
  lens.rotation.x = Math.PI / 2; lens.position.z = -0.175; head.add(lens);
  const glow = new Mesh(new PlaneGeometry(0.9, 0.9), new MeshBasicMaterial({
    map: canvasTex(128, 128, (gg, w) => { const r = gg.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,236,200,0.9)'); r.addColorStop(0.25, 'rgba(255,210,150,0.25)'); r.addColorStop(1, 'rgba(255,200,140,0)'); gg.fillStyle = r; gg.fillRect(0, 0, w, w); }),
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));
  glow.position.z = -0.19; head.add(glow);
  // barn doors
  const doorMat = M.black();
  [[0, 0.2, 0.36, 0.16, 'x', -1], [0, -0.2, 0.36, 0.16, 'x', 1], [0.2, 0, 0.16, 0.36, 'y', 1], [-0.2, 0, 0.16, 0.36, 'y', -1]].forEach(([x, y, w, h, ax, s]) => {
    const d = box(w, h, 0.006, doorMat);
    const pivot = new Object3D(); pivot.position.set(x * 0.9, y * 0.9, -0.18);
    d.position.set(ax === 'y' ? x * 0.4 : 0, ax === 'x' ? y * 0.4 : 0, -0.07);
    pivot.add(d);
    if (ax === 'x') pivot.rotation.x = s * 0.55; else pivot.rotation.y = s * 0.55;
    head.add(pivot);
  });
  const yoke = box(0.4, 0.03, 0.03, M.satin()); yoke.position.y = -0.19; head.add(yoke);
  g.add(head);
  g.position.copy(pos);
  scene.add(g);
  const headWorld = new Vector3(pos.x, pos.y + standH + 0.12, pos.z);
  head.lookAt(target.clone().sub(headWorld).multiplyScalar(-1).add(headWorld)); // lens faces target (-z)
  g.updateMatrixWorld(true);

  const light = new SpotLight(color, intensity, 14, angle, 0.55, 1.4);
  light.position.copy(headWorld);
  light.target.position.copy(target);
  if (castShadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 9;
    light.shadow.blurSamples = 16;
  }
  scene.add(light, light.target);
  const cone = beam(headWorld.distanceTo(target) * 1.25, Math.tan(angle) * headWorld.distanceTo(target) * 1.1, color, 0.11);
  cone.position.copy(headWorld);
  cone.lookAt(target.clone().sub(headWorld).multiplyScalar(-1).add(headWorld));
  scene.add(cone);
  return { group: g, light };
}

function cinemaCamera(scene, pos, lookAt) {
  const g = new Group();
  const mat = M.black();
  // dolly track
  const track = new Group();
  const railMat = M.chrome();
  [-0.28, 0.28].forEach((x) => { const rail = cyl(0.02, 0.02, 4.2, railMat, 10); rail.rotation.x = Math.PI / 2; rail.position.set(x, 0.035, 0); rail.receiveShadow = true; track.add(rail); });
  const sleeperMat = new MeshStandardMaterial({ map: woodTex(), roughness: 0.8 });
  for (let i = 0; i < 9; i++) { const s = box(0.8, 0.03, 0.08, sleeperMat); s.position.set(0, 0.012, -2 + i * 0.5); track.add(s); }
  g.add(track);
  // dolly
  const dolly = new Group();
  const plate = box(0.75, 0.08, 0.95, M.satin()); plate.position.y = 0.16; dolly.add(plate);
  [[-0.28, -0.38], [0.28, -0.38], [-0.28, 0.38], [0.28, 0.38]].forEach(([x, z]) => {
    const w = cyl(0.06, 0.06, 0.05, M.chrome(), 16); w.rotation.z = Math.PI / 2; w.position.set(x, 0.08, z); dolly.add(w);
  });
  const column = cyl(0.06, 0.07, 0.95, mat, 16); column.position.y = 0.68; dolly.add(column);
  // camera body
  const cam = new Group();
  cam.position.y = 1.22;
  const body = box(0.2, 0.22, 0.38, mat); cam.add(body);
  const lens = cyl(0.065, 0.075, 0.26, M.satin(), 24); lens.rotation.x = Math.PI / 2; lens.position.z = -0.3; cam.add(lens);
  const ring = cyl(0.078, 0.078, 0.03, M.chrome(), 24); ring.rotation.x = Math.PI / 2; ring.position.z = -0.24; cam.add(ring);
  const glass = new Mesh(new CircleGeometryLite(0.06), new MeshStandardMaterial({ color: 0x0b1626, roughness: 0.05, metalness: 1 }));
  glass.position.z = -0.432; glass.rotation.y = Math.PI; cam.add(glass);
  const matte = box(0.32, 0.24, 0.12, mat); matte.position.z = -0.5; cam.add(matte);
  const handle = box(0.04, 0.05, 0.3, M.satin()); handle.position.set(0, 0.155, 0); cam.add(handle);
  const vf = cyl(0.03, 0.03, 0.18, mat, 12); vf.rotation.x = Math.PI / 2; vf.position.set(-0.13, 0.08, 0.2); cam.add(vf);
  const tally = new Mesh(new SphereGeometry(0.012, 8, 8), new MeshBasicMaterial({ color: 0xff2a2a }));
  tally.position.set(0.06, 0.08, -0.17); cam.add(tally);
  const monitor = box(0.18, 0.12, 0.02, mat); monitor.position.set(0.17, 0.12, 0.12); monitor.rotation.y = -0.6; cam.add(monitor);
  dolly.add(cam);
  dolly.position.z = 0.6;
  g.add(dolly);
  g.position.copy(pos);
  scene.add(g);
  g.lookAt(new Vector3(lookAt.x, pos.y, lookAt.z));
  g.rotateY(Math.PI); // camera lens looks along -z of its own frame
  cam.lookAt(lookAt);
  cam.rotateY(Math.PI);
  return { group: g, tally };
}

// small helper so the lens glass is a disc without importing CircleGeometry twice
function CircleGeometryLite(r) { return new CylinderGeometry(r, r, 0.002, 24).rotateX(Math.PI / 2); }

async function directorsChair(scene, pos, rotY, name) {
  const g = new Group();
  const wood = new MeshStandardMaterial({ map: woodTex(), color: 0x6a4a2e, roughness: 0.7 });
  const canvasMat = new MeshStandardMaterial({ color: 0x151314, roughness: 0.95, side: DoubleSide });
  // X legs on both sides
  [-0.26, 0.26].forEach((x) => {
    [0.6, -0.6].forEach((a) => { const l = box(0.035, 0.66, 0.035, wood); l.position.set(x, 0.3, 0); l.rotation.x = a; g.add(l); });
    const arm = box(0.05, 0.03, 0.5, wood); arm.position.set(x, 0.66, 0); g.add(arm);
    const post = box(0.035, 1.05, 0.035, wood); post.position.set(x, 0.58, 0.22); g.add(post);
  });
  const seat = new Mesh(new PlaneGeometry(0.52, 0.42), canvasMat); seat.rotation.x = -Math.PI / 2; seat.position.y = 0.48; seat.receiveShadow = true; g.add(seat);
  const backTex = await labelTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#151314'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9dfcf'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '500 112px "Cormorant Garamond", Georgia, serif';
    c.fillText(name, w / 2, h / 2 + 6);
  });
  const backrest = new Mesh(new PlaneGeometry(0.54, 0.16), new MeshStandardMaterial({ map: backTex, roughness: 0.9 }));
  backrest.position.set(0, 0.98, 0.235); backrest.rotation.y = Math.PI; backrest.castShadow = true; g.add(backrest);
  const backBack = new Mesh(new PlaneGeometry(0.54, 0.16), new MeshStandardMaterial({ map: backTex, roughness: 0.9 }));
  backBack.position.set(0, 0.98, 0.233); g.add(backBack);
  g.position.copy(pos); g.rotation.y = rotY;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}

async function slate(scene, pos, rot, lines) {
  const g = new Group();
  const tex = await labelTex(512, 400, (c, w, h) => {
    c.fillStyle = '#121112'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(240,236,228,0.8)'; c.lineWidth = 3;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.beginPath(); c.moveTo(14, 150); c.lineTo(w - 14, 150); c.moveTo(14, 270); c.lineTo(w - 14, 270); c.moveTo(w / 2, 150); c.lineTo(w / 2, 270); c.stroke();
    c.fillStyle = 'rgba(240,236,228,0.92)'; c.textBaseline = 'middle';
    c.font = '500 60px "Cormorant Garamond", Georgia, serif'; c.textAlign = 'center';
    c.fillText(lines[0], w / 2, 84);
    c.font = '600 22px Manrope, sans-serif';
    c.fillText(lines[1], w / 4, 190); c.fillText(lines[2], (w * 3) / 4, 190);
    c.font = '500 46px "Cormorant Garamond", Georgia, serif';
    c.fillText(lines[3], w / 4, 236); c.fillText(lines[4], (w * 3) / 4, 236);
    c.font = '600 20px Manrope, sans-serif';
    c.fillText(lines[5], w / 2, 330);
  });
  const board = new Mesh(new BoxGeometry(0.3, 0.234, 0.012), [M.black(), M.black(), M.black(), M.black(), new MeshStandardMaterial({ map: tex, roughness: 0.85 }), M.black()]);
  board.castShadow = true; g.add(board);
  const stripes = canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#f2ece2'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (let x = -32; x < w + 32; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 24, 0); c.lineTo(x + 8, h); c.lineTo(x - 16, h); c.fill(); } });
  const stripeMat = new MeshStandardMaterial({ map: stripes, roughness: 0.6 });
  const bar1 = box(0.3, 0.035, 0.014, stripeMat); bar1.position.y = 0.135; g.add(bar1);
  const pivot = new Object3D(); pivot.position.set(-0.15, 0.155, 0);
  const bar2 = box(0.3, 0.035, 0.014, stripeMat); bar2.position.set(0.15, 0.018, 0); pivot.add(bar2);
  pivot.rotation.z = 0.32; g.add(pivot);
  g.position.copy(pos); g.rotation.set(rot.x, rot.y, rot.z);
  scene.add(g);
  return g;
}

function cable(scene, points, mat) {
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0.012, z)));
  const m = new Mesh(new TubeGeometry(curve, 80, 0.011, 6, false), mat);
  m.receiveShadow = true;
  scene.add(m);
}

/* ---------- the figure: cut-out photo with depth relief ---------- */
function figure(scene, { color, depth, height, relief, onReady }) {
  const loader = new TextureLoader();
  let pending = 2;
  const g = new Group();
  scene.add(g);
  const tex = {};
  const done = () => {
    if (--pending) return;
    const img = tex.color.image;
    const width = height * (img.width / img.height);
    const geo = new PlaneGeometry(width, height, 220, Math.round(220 * (img.height / img.width)));
    const mat = new MeshStandardMaterial({
      map: tex.color, color: 0x1e1a1a, emissiveMap: tex.color, emissive: 0xffffff, emissiveIntensity: 1.08,
      displacementMap: tex.depth, displacementScale: relief, displacementBias: -relief * 0.35,
      roughness: 0.85, metalness: 0, transparent: true, alphaTest: 0.06,
      toneMapped: false, // keep the photo's own colours
    });
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.customDepthMaterial = new MeshDepthMaterial({
      depthPacking: RGBADepthPacking, map: tex.color, alphaTest: 0.5,
      displacementMap: tex.depth, displacementScale: relief, displacementBias: -relief * 0.35,
    });
    mesh.position.y = height / 2;
    g.add(mesh);
    onReady && onReady(mesh, width);
  };
  loader.load(color, (t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; tex.color = t; done(); });
  loader.load(depth, (t) => { tex.depth = t; done(); });
  return g;
}

/* ---------- scene ---------- */
async function init() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const BG = new Color('#0d0b0c');

  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2));
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(BG, 6, 17);
  const camera = new PerspectiveCamera(34, 1, 0.05, 60);

  scene.add(new HemisphereLight(0x8a7a6e, 0x0d0b0c, 0.35));
  scene.add(new AmbientLight(0xffe6cc, 0.12));

  // floor
  const floor = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ map: floorTex(), color: 0x9a948f, roughness: 0.82, metalness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // gaffer tape marks
  const tapeMat = new MeshStandardMaterial({ color: 0xd9a441, roughness: 0.7 });
  [[0, 0.55, 0], [0, 0.55, Math.PI / 2], [0.9, 1.25, 0.4], [0.9, 1.25, 0.4 + Math.PI / 2]].forEach(([x, z, r]) => {
    const t = new Mesh(new PlaneGeometry(0.22, 0.04), tapeMat); t.rotation.set(-Math.PI / 2, 0, r); t.position.set(x, 0.003, z); t.receiveShadow = true; scene.add(t);
  });

  // scenery flat: painted wall with visible plywood edge and braces
  const flat = new Group();
  const wallMat = new MeshStandardMaterial({ map: wallTex(), roughness: 0.94 });
  const ply = new MeshStandardMaterial({ map: woodTex(), roughness: 0.8 });
  // box faces: +x, -x, +y, -y, front (painted), back (raw plywood)
  const wall = box(3.4, 3.3, 0.06, [ply, ply, ply, M.black(), wallMat, new MeshStandardMaterial({ map: woodTex(), color: 0x8a7a68, roughness: 0.85 })]);
  wall.position.set(0, 1.65, 0); flat.add(wall);
  const base = box(3.4, 0.12, 0.03, new MeshStandardMaterial({ color: 0x1a1718, roughness: 0.6 })); base.position.set(0, 0.06, 0.045); flat.add(base);
  const woodMat = new MeshStandardMaterial({ map: woodTex(), roughness: 0.8 });
  [-1.55, 1.55].forEach((x) => {
    const brace = box(0.06, 3.0, 0.06, woodMat); brace.position.set(x, 1.15, -0.75); brace.rotation.x = -0.5; flat.add(brace);
    const bag = sandbag(new MeshStandardMaterial({ color: 0x2c2620, roughness: 1 })); bag.position.set(x, 0.06, -1.42); flat.add(bag);
  });
  // gilded oval mirror frame on the wall, a nod to the portrait session
  const mirror = new Group();
  const frameRing = new Mesh(new TorusGeometry(0.42, 0.045, 16, 64), M.gold()); frameRing.castShadow = true; mirror.add(frameRing);
  const glassTex = canvasTex(256, 256, (g, w, h) => {
    const lin = g.createLinearGradient(0, 0, w, h);
    lin.addColorStop(0, '#3b4146'); lin.addColorStop(0.45, '#22272b'); lin.addColorStop(0.62, '#4a5054'); lin.addColorStop(1, '#1a1d20');
    g.fillStyle = lin; g.fillRect(0, 0, w, h);
    const r = rng(17); // foxing of old silvering
    for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h, rad = 2 + r() * 14; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(120,100,70,0.35)'); gr.addColorStop(1, 'rgba(120,100,70,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  });
  const inner = new Mesh(new CylinderGeometry(0.4, 0.4, 0.01, 48).rotateX(Math.PI / 2), new MeshStandardMaterial({ map: glassTex, emissiveMap: glassTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.5 }));
  mirror.add(inner);
  mirror.scale.set(0.62, 0.95, 1);
  mirror.position.set(-0.95, 1.62, 0.05);
  flat.add(mirror);
  flat.position.set(0, 0, -0.32);
  flat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(flat);

  // Jana: cut-out portrait with depth relief, leaning against the flat
  const H = 1.12; // visible part of the portrait: head to mid-thigh
  let figureMesh = null;
  const figureGroup = figure(scene, {
    color: `/img/figure/jana-02-${small ? 768 : 1280}.webp`,
    depth: '/img/figure/jana-02-depth.png',
    height: H, relief: 0.24,
    onReady: (mesh) => { figureMesh = mesh; mesh.userData.index = 1; requestRender(); },
  });
  figureGroup.position.set(0.15, 0.58, -0.14);

  // lights
  const focus = new Vector3(0.15, 1.4, 0);
  const key = fresnel(scene, { pos: new Vector3(-1.8, 0, 1.45), target: focus, color: 0xffd7a8, intensity: 70, angle: 0.36, castShadow: true, standH: 1.75, shadowSize: small ? 1024 : 2048 });
  fresnel(scene, { pos: new Vector3(2.3, 0, 1.0), target: new Vector3(0.1, 1.45, -0.1), color: 0xb9cfff, intensity: 26, angle: 0.3, castShadow: false, standH: 2.05, shadowSize: 512 });
  // dim work light from above the camera position, so the set pieces read in the dark
  const work = new SpotLight(0xc9d2e6, 30, 16, 0.85, 0.9, 1.2);
  work.position.set(0.4, 4.6, 5.2); work.target.position.set(-0.4, 0.4, 1.4);
  scene.add(work, work.target);
  // cool back light from the studio side, draws the outlines of lamp and camera
  const back = new SpotLight(0x9fb4ff, 40, 12, 0.7, 0.8, 1.3);
  back.position.set(-3.6, 3.2, -1.6); back.target.position.set(-1.2, 1.0, 2.0);
  scene.add(back, back.target);
  // studio depth: a few warm bulbs and a second, dimly lit flat far behind
  const bulbGlow = canvasTex(64, 64, (g, w) => { const rr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); rr.addColorStop(0, 'rgba(255,214,150,1)'); rr.addColorStop(0.2, 'rgba(255,190,120,0.35)'); rr.addColorStop(1, 'rgba(255,180,110,0)'); g.fillStyle = rr; g.fillRect(0, 0, w, w); });
  [[-3.4, 2.3, -2.6, 0.5], [-4.6, 1.6, -4.2, 0.7], [-2.6, 2.9, -5.5, 0.8], [-5.8, 2.6, -6.5, 1], [-3.9, 0.9, -3.4, 0.45]].forEach(([x, y, z, sz]) => {
    const sp = new Mesh(new PlaneGeometry(sz, sz), new MeshBasicMaterial({ map: bulbGlow, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
    sp.position.set(x, y, z); sp.lookAt(0, y, 6); scene.add(sp);
  });
  const farFlat = box(3, 2.8, 0.05, new MeshStandardMaterial({ map: wallTex(), color: 0x6e5a4a, roughness: 0.95 }));
  farFlat.position.set(-4.8, 1.4, -4.6); farFlat.rotation.y = 0.5; scene.add(farFlat);
  const farLamp = new PointLight(0xffb070, 6, 5, 1.5); farLamp.position.set(-3.9, 2.2, -3.6); scene.add(farLamp);
  // practical behind the flat: warm spill over the top edge
  const spill = new PointLight(0xff9a55, 4, 6, 1.6); spill.position.set(1.6, 3.6, -1.2); scene.add(spill);

  // film camera on dolly, pointed at her
  const film = cinemaCamera(scene, new Vector3(-1.0, 0, 2.35), new Vector3(0.15, 1.3, 0));

  // director's chair and slate
  const name = 'JANA NAGYOVÁ';
  const chair = await directorsChair(scene, new Vector3(0, 0, 2), 0, name);
  const isCs = document.documentElement.lang === 'cs';
  await slate(scene, new Vector3(1.36, 0.42, 0.98), { x: -0.25, y: -0.35, z: 0.03 },
    isCs ? ['JANA NAGYOVÁ', 'SCÉNA', 'ZÁBĚR', '1', '3', 'REŽIE · KAMERA · DATUM'] : ['JANA NAGYOVÁ', 'SZENE', 'EINSTELLUNG', '1', '3', 'REGIE · KAMERA · DATUM']);

  // apple boxes
  const appleMat = new MeshStandardMaterial({ map: woodTex(), color: 0xc9a27a, roughness: 0.75 });
  const ab1 = box(0.5, 0.2, 0.3, appleMat); ab1.position.set(1.42, 0.1, 0.82); ab1.rotation.y = -0.3; scene.add(ab1);
  const ab2 = box(0.5, 0.1, 0.3, appleMat); ab2.position.set(1.4, 0.25, 0.84); ab2.rotation.y = -0.42; scene.add(ab2);

  // cables
  const cableMat = new MeshStandardMaterial({ color: 0x0c0b0b, roughness: 0.45 });
  cable(scene, [[-1.8, 1.45], [-2.2, 2.3], [-1.7, 3.4], [-2.7, 5.2], [-3.6, 7]], cableMat);
  cable(scene, [[2.3, 1.0], [2.8, 1.7], [2.4, 2.8], [3.4, 4.5]], cableMat);
  cable(scene, [[-1.0, 2.35], [-0.5, 3.2], [-0.9, 4.4], [-0.2, 6.5]], cableMat);

  // lighting grid far above, with a few hanging lamps glowing in the haze
  const grid = new Group();
  const truss = M.satin();
  for (let i = -3; i <= 3; i++) { const b = cyl(0.025, 0.025, 12, truss, 8); b.rotation.z = Math.PI / 2; b.position.set(0, 5.2, i * 1.4 - 1); grid.add(b); }
  const lampGlow = new MeshBasicMaterial({ color: 0xffd6a0 });
  const r = rng(9);
  for (let i = 0; i < 14; i++) {
    const lamp = cyl(0.09, 0.11, 0.22, M.black(), 12);
    const x = -5 + r() * 10, z = -4 + r() * 5;
    lamp.position.set(x, 4.95, z); grid.add(lamp);
    if (r() > 0.45) { const d = new Mesh(new CircleGeometryLite(0.07), lampGlow); d.rotation.x = Math.PI / 2; d.position.set(x, 4.83, z); grid.add(d); }
  }
  scene.add(grid);

  // haze particles, densest in the key beam
  const COUNT = small ? 450 : 900;
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT);
  const pr = rng(21);
  for (let i = 0; i < COUNT; i++) {
    const t = pr();
    const a = new Vector3(-1.8, 1.87, 1.45).lerp(focus, t);
    pos[i * 3] = a.x + (pr() - 0.5) * (0.3 + t * 1.2) + (pr() < 0.12 ? (pr() - 0.5) * 6 : 0);
    pos[i * 3 + 1] = a.y + (pr() - 0.5) * (0.3 + t * 1.0);
    pos[i * 3 + 2] = a.z + (pr() - 0.5) * (0.3 + t * 1.2);
    vel[i] = 0.01 + pr() * 0.04;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({
    size: small ? 0.022 : 0.016, color: 0xffe3bb, transparent: true, opacity: 0.42, depthWrite: false, blending: AdditiveBlending,
    map: canvasTex(32, 32, (g, w) => { const rr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); rr.addColorStop(0, 'rgba(255,255,255,1)'); rr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rr; g.fillRect(0, 0, w, w); }),
  }));
  scene.add(dust);

  /* ---------- camera and interaction ---------- */
  const state = {
    az: 0, azTarget: 0, dragging: false, lastX: 0, downX: 0, downY: 0,
    px: 0, py: 0, pxs: 0, pys: 0, scroll: window.scrollY, scrollS: window.scrollY, t: 0, layout: null,
  };
  const subject = new Vector3(0.15, 1.22, 0);

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const a = camera.aspect;
    if (a >= 1.2) {
      // desktop: she stands right of centre, the set opens up on the left behind the headline
      camera.fov = 30;
      state.layout = { dist: 4.1, height: 1.48, baseAz: -0.12, look: new Vector3(-0.62 - (a - 1.2) * 0.3, 1.18, 0) };
    } else if (a >= 0.8) {
      camera.fov = 34;
      state.layout = { dist: 4.4, height: 1.5, baseAz: -0.08, look: new Vector3(0.05, 1.05, 0) };
    } else {
      // portrait phones: frame her upper body, bottom edge of the photo stays out of view
      camera.fov = 40;
      state.layout = { dist: 2.7 + (0.8 - a) * 1.2, height: 1.5, baseAz: -0.06, look: new Vector3(0.15, 0.98, 0) };
    }
    camera.updateProjectionMatrix();
    // put the director's chair on the sightline to the lower edge of the photo,
    // so its backrest hides where the portrait ends
    const L = state.layout;
    const cam = new Vector3(subject.x + Math.sin(L.baseAz) * L.dist, L.height, subject.z + Math.cos(L.baseAz) * L.dist);
    const cut = new Vector3(0.15, 0.7, -0.05);
    const t = MathUtils.clamp((cam.y - 1.1) / (cam.y - cut.y), 0.3, 0.7);
    const at = cam.clone().lerp(cut, t);
    chair.position.set(at.x, 0, at.z - 0.24);
    chair.rotation.y = Math.atan2(-(cut.x - at.x), -(cut.z - at.z));
    chair.visible = a >= 0.8; // on phones the headline covers the lower edge
    requestRender();
  }

  const ray = new Raycaster();
  const ndc = new Vector2();
  function hitsFigure(x, y) {
    if (!figureMesh) return false;
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(figureMesh, false)[0];
    if (!hit || !hit.uv) return false;
    // only count clicks on the person, not on the transparent margin
    const img = figureMesh.material.map.image;
    try {
      const c = hitsFigure.c || (hitsFigure.c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }));
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!hitsFigure.ready) { g.drawImage(img, 0, 0, 64, 64); hitsFigure.ready = true; }
      const px = g.getImageData(Math.floor(hit.uv.x * 63), Math.floor((1 - hit.uv.y) * 63), 1, 1).data;
      return px[3] > 100;
    } catch { return true; }
  }

  if (hero) { hero.style.pointerEvents = 'auto'; hero.style.cursor = 'grab'; }
  (hero || window).addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('a,button')) return;
    state.dragging = true; state.lastX = e.clientX; state.downX = e.clientX; state.downY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    state.px = (e.clientX / window.innerWidth) * 2 - 1;
    state.py = (e.clientY / window.innerHeight) * 2 - 1;
    if (state.dragging) {
      state.azTarget = MathUtils.clamp(state.azTarget + (e.clientX - state.lastX) * 0.0025, -0.34, 0.34);
      state.lastX = e.clientX;
    } else if (hero && e.pointerType === 'mouse' && window.scrollY < window.innerHeight * 0.8) {
      hero.style.cursor = hitsFigure(e.clientX, e.clientY) ? 'pointer' : 'grab';
    }
    requestRender();
  }, { passive: true });
  window.addEventListener('pointerup', (e) => {
    if (!state.dragging) return;
    state.dragging = false;
    if (Math.hypot(e.clientX - state.downX, e.clientY - state.downY) < 6 && hitsFigure(e.clientX, e.clientY)) {
      document.dispatchEvent(new CustomEvent('open-photo', { detail: 1 }));
    }
  });
  window.addEventListener('pointercancel', () => { state.dragging = false; });
  window.addEventListener('scroll', () => { state.scroll = window.scrollY; requestRender(); }, { passive: true });
  window.addEventListener('resize', layout);

  let raf = 0, last = performance.now(), running = false;
  const camPos = new Vector3();
  const lookPos = new Vector3();

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const moving = !reduceMotion.matches;
    const k = moving ? 1 - Math.pow(0.001, dt) : 1; // frame-rate independent easing
    if (moving) state.t += dt;

    state.az += (state.azTarget - state.az) * k;
    state.pxs += (state.px - state.pxs) * k * 0.6;
    state.pys += (state.py - state.pys) * k * 0.6;
    state.scrollS += (state.scroll - state.scrollS) * (moving ? k * 1.4 : 1);
    const sp = MathUtils.clamp(state.scrollS / window.innerHeight, 0, 1.6);

    const L = state.layout;
    const drift = moving ? Math.sin(state.t * 0.21) * 0.05 : 0;
    const az = L.baseAz + state.az + drift + state.pxs * 0.05 + sp * 0.22;
    const dist = L.dist + sp * 2.2;
    const height = L.height - state.pys * 0.08 + sp * 1.4 + (moving ? Math.sin(state.t * 0.33) * 0.02 : 0);
    camPos.set(subject.x + Math.sin(az) * dist, height, subject.z + Math.cos(az) * dist);
    camera.position.copy(camPos);
    lookPos.copy(L.look).lerp(subject, Math.min(sp, 1)).add(new Vector3(0, -sp * 0.35, 0));
    camera.lookAt(lookPos);

    // flicker-free slow breathing of the key light, tally light blink
    key.light.intensity = 70 * (moving ? 1 + Math.sin(state.t * 0.7) * 0.015 : 1);
    film.tally.visible = !moving || Math.floor(state.t * 1.2) % 2 === 0;

    if (moving) {
      const arr = dustGeo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] += vel[i] * dt;
        arr[i * 3] += Math.sin(state.t * 0.3 + i) * 0.0008;
        if (arr[i * 3 + 1] > 3.2) arr[i * 3 + 1] = 0.3;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    if (moving && running) raf = requestAnimationFrame(frame);
  }
  function requestRender() {
    if (!raf && !document.hidden && state.layout) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function start() { running = true; requestRender(); }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener?.('change', start);

  layout();
  start();
  document.documentElement.classList.add('stage-ready');
}

// start last, after all helpers above are initialised
if (!canvas || !dataEl || !webglAvailable()) {
  document.documentElement.classList.add('no-webgl');
} else {
  init().catch((err) => {
    console.error(err);
    document.documentElement.classList.add('no-webgl');
  });
}
