/*
 * THE ROYALE - TownAce Atlas
 *
 * Loads royale.glb and drives it from the explode vectors, categories and
 * mode masks that were authored in Blender and written into glTF `extras`.
 * Nothing about the vehicle is described twice: change the model, and this
 * viewer picks the change up on reload.
 *
 * Axis note: the GLB is Y-up. Blender's (x, y, z) exported as (x, z, -y),
 * so the vehicle nose is +X, up is +Y, and the vehicle's LEFT side is -Z.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = s => document.querySelector(s);
const canvas = $('#scene');

/* ------------------------------------------------------------------ scene */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0e10);
scene.fog = new THREE.Fog(0x0d0e10, 16, 42);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
camera.position.set(6.6, 3.1, 7.4);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;   // let the key light do the modelling

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 3.4;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.92, 0);
controls.enablePan = false;

/* ------------------------------------------------------------------ light */
scene.add(new THREE.HemisphereLight(0xbcc6d0, 0x1a1713, 0.55));

const key = new THREE.DirectionalLight(0xfff1dd, 3.1);
key.position.set(5.2, 7.4, 4.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0009;
key.shadow.normalBias = 0.02;
const c = key.shadow.camera;
c.left = -5; c.right = 5; c.top = 5; c.bottom = -5; c.near = 1; c.far = 22;
scene.add(key);

const rim = new THREE.DirectionalLight(0x8fa9c4, 1.9);
rim.position.set(-6.0, 3.4, -5.2);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xd8c2a4, 0.6);
fill.position.set(-2.0, 1.4, 6.0);
scene.add(fill);

/* ground: a shadow catcher plus a soft pool of light under the van */
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.ShadowMaterial({ opacity: 0.34 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

(function groundPool() {
  const s = 512, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d').createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(150,158,168,0.34)');
  g.addColorStop(0.45, 'rgba(110,118,128,0.14)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  const ctx = cv.getContext('2d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  scene.add(m);
})();

/* ------------------------------------------------------------------ model */
const root = new THREE.Group();
scene.add(root);

const parts = [];          // { obj, base, explode, cat, modes, label, meshes }
const byName = new Map();

const GHOST = 0.040;       // opacity of a part filtered out of the current view

function vecFromExtras(e) {
  // Blender (x, y, z) -> glTF (x, z, -y)
  return new THREE.Vector3(
    Number(e.explode_x) || 0,
    Number(e.explode_z) || 0,
    -(Number(e.explode_y) || 0)
  );
}

new GLTFLoader().load('./model/royale.glb', gltf => {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // Clone materials so parts can be ghosted independently.
    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      // Blender's transmission does not survive into a cheap web material,
      // so glazing is re-authored here as straight alpha. Same look, far
      // cheaper, and it stays readable on a phone.
      const n = (m.name || '').toUpperCase();
      if (n.includes('GLASS')) {
        m.transmission = 0;
        m.transparent = true;
        m.opacity = n.includes('SKYLITE') ? 0.30 : 0.26;
        m.roughness = 0.06;
        m.metalness = 0.0;
        m.color.setHex(n.includes('SKYLITE') ? 0x1b2427 : 0x222b2e);
        m.depthWrite = false;
        m.side = THREE.DoubleSide;
        m.envMapIntensity = 2.4;
      } else if (n.includes('LAMP')) {
        m.transmission = 0;
        m.transparent = true;
        m.opacity = 0.86;
        m.roughness = 0.12;
        m.envMapIntensity = 1.8;
      } else if (n.includes('PAINT')) {
        m.envMapIntensity = 1.35;
      } else if (n.includes('CHROME') || n.includes('ALLOY')) {
        m.envMapIntensity = 2.2;
      }
      m.userData.baseOpacity = m.opacity;
      m.userData.baseTransparent = m.transparent;
    });
    o.castShadow = !(o.material.name || '').toUpperCase().includes('GLASS');
  });

  const scan = o => {
    const e = o.userData || {};
    if (e.category) {
      const meshes = [];
      o.traverse(n => { if (n.isMesh) meshes.push(n); });
      const p = {
        obj: o,
        base: o.position.clone(),
        explode: vecFromExtras(e),
        cat: e.category,
        modes: String(e.modes || '').split(',').filter(Boolean),
        label: e.label || o.name,
        id: o.name,
        meshes,
        baseQuat: o.quaternion.clone(),
        vis: 1, visTarget: 1
      };
      parts.push(p);
      byName.set(o.name, p);
    }
    o.children.forEach(scan);
  };
  gltf.scene.children.forEach(scan);

  root.add(gltf.scene);
  frameSpecs();
  setMode('assembled', true);
  $('#loading').classList.add('gone');
  setTimeout(() => $('#loading').remove(), 800);
}, undefined, err => {
  $('#loading').innerHTML =
    '<span>Could not load royale.glb</span><span style="opacity:.6;text-transform:none;letter-spacing:0">' +
    'Serve this folder over http (see README), not file://</span>';
  console.error(err);
});

/* ------------------------------------------------------------------ specs */
async function frameSpecs() {
  $('#sp-parts').textContent = parts.length;
  try {
    const m = await (await fetch('./model/royale_manifest.json')).json();
    $('#sp-len').textContent = m.overall.length.toFixed(2) + ' m';
    $('#sp-wb').textContent  = m.overall.wheelbase.toFixed(3) + ' m';
    $('#sp-ht').textContent  = m.overall.height.toFixed(3) + ' m';
    $('#sp-tris').textContent = m.triangles.toLocaleString();
  } catch { /* manifest is a nicety, not a dependency */ }
}

/* --------------------------------------------------------------- modeling
 * Each mode is a target: how far things separate, which systems stay solid,
 * where the camera sits, and any per-part rearrangement (the Royal Lounge
 * chairs actually swivel for the camping layout, because they really do).
 */
const MODES = {
  assembled:  { explode: 0.00, keep: null,
                cam: [6.6, 3.1, 7.4],   tgt: [0, 0.92, 0] },
  exploded:   { explode: 1.00, keep: null,
                cam: [8.4, 4.6, 9.2],   tgt: [0, 1.05, 0] },
  interior:   { explode: 0.18, keep: ['cabin'],
                cam: [4.4, 2.6, 4.6],   tgt: [0.30, 1.00, 0] },
  camping:    { explode: 0.00, keep: ['cabin'], layout: 'camp',
                cam: [-3.4, 2.4, 4.4],  tgt: [-0.45, 0.90, 0] },
  drivetrain: { explode: 0.42, keep: ['chassis', 'powertrain'], lift: 1.30,
                cam: [6.0, 1.5, 6.2],   tgt: [0, 0.52, 0] },
  skylite:    { explode: 0.85, keep: ['roof'], lift: -0.30,
                cam: [2.4, 5.2, 4.0],   tgt: [-0.15, 1.55, 0] }
};

/* Camping layout: the two Royal Lounge captain's chairs swing round to
 * face the rear, and the bench drops into its bed position. */
const CAMP = {
  REAR_SEAT_01:     { yaw: Math.PI, move: [-0.10, 0, 0] },
  REAR_SEAT_02:     { yaw: Math.PI, move: [-0.10, 0, 0] },
  REAR_BENCH_OR_BED:{ yaw: 0,       move: [0.22, -0.09, 0] },
  DRIVER_SEAT:      { yaw: 0,       move: [0, 0, 0] },
  PASSENGER_SEAT:   { yaw: 0,       move: [0, 0, 0] }
};

const COARSE = matchMedia('(hover: none)').matches;

/* A tall phone frame needs the camera further out than a desktop one, or
 * the van simply will not fit. Every mode preset is written for a wide
 * frame and scaled from there. */
let fitScale = 1;
function computeFit() {
  const a = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  fitScale = Math.min(1.78, Math.max(1, 1.34 / Math.max(a, 0.30)));
}
computeFit();

let mode = 'assembled';
let explodeTarget = 0, explodeNow = 0;
let sysFilter = 'all';
let camping = 0, campingTarget = 0;
let lift = 0, liftTarget = 0;

const camPos  = new THREE.Vector3().copy(camera.position);
const camTgt  = new THREE.Vector3().copy(controls.target);
const camFrom = new THREE.Vector3();
const tgtFrom = new THREE.Vector3();
let camAnim = 1;

function setMode(name, instant = false) {
  if (!MODES[name]) return;
  mode = name;
  const m = MODES[name];
  explodeTarget = m.explode;
  campingTarget = m.layout === 'camp' ? 1 : 0;
  liftTarget    = m.lift || 0;
  syncSlider(m.explode);

  camFrom.copy(camera.position);
  tgtFrom.copy(controls.target);
  camTgt.set(...m.tgt);
  // On a portrait frame the van reads better sitting a little high
  camTgt.y -= (fitScale - 1) * 0.22;
  camPos.set(...m.cam).sub(camTgt).multiplyScalar(fitScale).add(camTgt);
  camAnim = instant ? 1 : 0;
  if (instant) { camera.position.copy(camPos); controls.target.copy(camTgt); }

  document.querySelectorAll('.mode').forEach(b => b.classList.toggle('is-on', b.dataset.mode === name));
  applyVisibility();
}


function applyVisibility() {
  const keep = MODES[mode].keep;
  const sys  = sysFilter === 'all' ? null : [sysFilter];
  for (const p of parts) {
    const inMode = p.modes.length === 0 || p.modes.includes(mode);
    const inKeep = !keep || keep.includes(p.cat);
    const inSys  = !sys || sys.includes(p.cat);
    p.visTarget = (inMode && inKeep && inSys) ? 1 : 0;
    // Anything the mode is not about gets lifted clear of the subject,
    // so the running gear is actually revealed rather than merely ghosted.
    p.liftFactor = inKeep ? 0 : 1;
  }
}

/* ------------------------------------------------------------------- pick */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let hovered = null;

function partFromObject(o) {
  while (o) { if (byName.has(o.name)) return byName.get(o.name); o = o.parent; }
  return null;
}

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
// No hover on a phone, so identification happens on tap instead.
canvas.addEventListener(COARSE ? 'pointerdown' : 'pointermove', setPointer);

function updateHover() {
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(root.children, true);
  let found = null;
  for (const h of hits) {
    const p = partFromObject(h.object);
    if (p && p.vis > 0.5) { found = p; break; }
  }
  if (found === hovered) return;
  hovered = found;
  const ro = $('#readout');
  if (!found) { ro.hidden = true; return; }
  ro.hidden = false;
  $('#ro-cat').textContent = found.cat.replace(/^\w/, s => s.toUpperCase());
  $('#ro-name').textContent = found.label;
  $('#ro-id').textContent = found.id;
  const b = found.base;
  $('#ro-pivot').textContent = `${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}`;
  $('#ro-travel').textContent = found.explode.length().toFixed(2) + ' m';
}

/* ------------------------------------------------------------------- wire */
document.querySelectorAll('.mode').forEach(b =>
  b.addEventListener('click', () => setMode(b.dataset.mode)));

document.querySelectorAll('.sys').forEach(b =>
  b.addEventListener('click', () => {
    sysFilter = b.dataset.sys;
    document.querySelectorAll('.sys').forEach(x => x.classList.toggle('is-on', x === b));
    applyVisibility();
  }));

const slider = $('#explode');
function syncSlider(v) {
  slider.value = Math.round(v * 100);
  $('#explodeVal').textContent = Math.round(v * 100) + '%';
}
slider.addEventListener('input', () => {
  explodeTarget = Number(slider.value) / 100;
  $('#explodeVal').textContent = slider.value + '%';
});

$('#reset').addEventListener('click', () => setMode(mode));

addEventListener('keydown', e => {
  // The viewer is embedded in a longer page now, so the number keys only
  // belong to the model while the model is actually the thing on screen.
  if (e.target.matches('input, textarea, select')) return;
  const r = canvas.getBoundingClientRect();
  if (r.bottom < innerHeight * 0.25 || r.top > innerHeight * 0.75) return;
  const n = Number(e.key);
  const order = Object.keys(MODES);
  if (n >= 1 && n <= order.length) setMode(order[n - 1]);
});

/* ------------------------------------------------------------------- loop */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width === w * renderer.getPixelRatio() && canvas.height === h * renderer.getPixelRatio()) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const prev = fitScale;
  computeFit();
  if (Math.abs(prev - fitScale) > 0.01) setMode(mode, true);
}

const ease = t => 1 - Math.pow(1 - t, 3);
const tmpQ = new THREE.Quaternion();
const yawQ = new THREE.Quaternion();
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  resize();
  const dt = Math.min(clock.getDelta(), 0.05);
  const k = 1 - Math.pow(0.001, dt);   // frame-rate independent smoothing

  explodeNow += (explodeTarget - explodeNow) * k;
  camping    += (campingTarget - camping) * k;
  lift       += (liftTarget - lift) * k;

  if (camAnim < 1) {
    camAnim = Math.min(1, camAnim + dt / 1.15);
    const t = ease(camAnim);
    // Arc the camera rather than sliding through the van: interpolate the
    // orbit radius and direction separately from the look-at point.
    const tgt = tgtFrom.clone().lerp(camTgt, t);
    const a = camFrom.clone().sub(tgtFrom);
    const b = camPos.clone().sub(camTgt);
    const dir = a.clone().normalize().lerp(b.clone().normalize(), t).normalize();
    const rad = a.length() + (b.length() - a.length()) * t;
    camera.position.copy(tgt).addScaledVector(dir, rad);
    controls.target.copy(tgt);
  }

  for (const p of parts) {
    // position: authored explode vector, plus the camping rearrangement
    const camp = CAMP[p.id];
    let ox = 0, oy = 0, oz = 0;
    if (camp && camping > 0.001) {
      ox = camp.move[0] * camping;
      oy = camp.move[1] * camping;
      oz = camp.move[2] * camping;
    }
    p.obj.position.set(
      p.base.x + p.explode.x * explodeNow + ox,
      p.base.y + p.explode.y * explodeNow + oy + lift * (p.liftFactor || 0),
      p.base.z + p.explode.z * explodeNow + oz
    );

    if (camp && camp.yaw) {
      yawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), camp.yaw * camping);
      p.obj.quaternion.copy(tmpQ.copy(p.baseQuat).multiply(yawQ));
    }

    // ghosting
    p.vis += (p.visTarget - p.vis) * k;
    const o = GHOST + (1 - GHOST) * p.vis;
    for (const mesh of p.meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const target = (m.userData.baseOpacity ?? 1) * o;
        m.opacity = target;
        m.transparent = m.userData.baseTransparent || p.vis < 0.995;
        m.depthWrite = m.userData.baseTransparent ? false : p.vis > 0.6;
      }
      mesh.castShadow = p.vis > 0.5;
    }
  }

  updateHover();
  controls.update();
  renderer.render(scene, camera);
}
tick();

/* The page controller imports this module to gate wheel-zoom against the
 * document scroll. Standalone (atlas.html) nothing reads these. */
export { controls, camera, renderer, scene, setMode, parts };
