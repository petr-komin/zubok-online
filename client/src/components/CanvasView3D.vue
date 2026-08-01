<template>
  <div class="viewer-wrap">
    <!-- Toolbar -->
    <div class="viewer-toolbar">
      <div class="track-toggle">
        <button
          v-for="opt in trackOptions"
          :key="opt.value"
          :class="['track-btn', { active: visibleTrack === opt.value }]"
          @click="setTrack(opt.value)"
        >
          <span class="track-dot" :style="{ background: opt.dotColor }"></span>
          {{ opt.label }}
        </button>
      </div>

      <div class="anim-controls">
        <button class="btn-play" @click="togglePlay" :title="playing ? 'Pauza' : 'Přehrát'">
          {{ playing ? '⏸' : '▶' }}
        </button>
        <input
          class="anim-slider"
          type="range"
          min="0"
          :max="currentPathLen - 1"
          :value="animStep"
          @input="onSlider"
        />
        <span class="anim-pct">{{ animPct }}%</span>
      </div>

      <div class="view-buttons">
        <button class="btn-reset" @click="celniPohled" title="Pohled z čela — na profil spoje">&#9612;&#9616; Čelo</button>
        <button class="btn-reset" @click="resetCamera" title="Reset pohledu">&#8635; Reset</button>
      </div>
    </div>

    <!-- Canvas -->
    <div class="canvas-container" ref="containerRef"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const props = defineProps({
  pathsA: { type: Array, default: () => [] },
  pathsB: { type: Array, default: () => [] },
  meta:   { type: Object, default: () => ({}) },
});

const containerRef = ref(null);
const visibleTrack = ref('both');
const playing      = ref(false);
const animStep     = ref(0);

// ── Barvy ──────────────────────────────────────────────────────────
const COLOR_A       = 0xf59e0b;
const COLOR_B       = 0x60a5fa;
const COLOR_RAPID   = 0x556070;
const COLOR_BOARD   = 0x8B6914;
const COLOR_DRILL_A = 0xfcd34d;
const COLOR_DRILL_B = 0x93c5fd;
const FOV_3D   = 45;   // běžný prostorový pohled
const FOV_CELO = 12;   // čelní pohled na řez — skoro ortogonální

const COLOR_PROFIL_A = 0x4ade80;
const COLOR_PROFIL_B = 0xe879f9;

const trackOptions = [
  { value: 'a',    label: 'Dráha A', dotColor: '#f59e0b' },
  { value: 'b',    label: 'Dráha B', dotColor: '#60a5fa' },
  { value: 'both', label: 'Obě',     dotColor: '#a78bfa' },
];

// ── Aktuální dráha pro animaci (když je "both" → používá _a) ──────
const currentPaths = computed(() =>
  visibleTrack.value === 'b' ? props.pathsB : props.pathsA
);
const currentPathLen = computed(() => Math.max(currentPaths.value.length, 1));

const animPct = computed(() =>
  currentPathLen.value <= 1
    ? 0
    : Math.round((animStep.value / (currentPathLen.value - 1)) * 100)
);

// ── Three.js handles ──────────────────────────────────────────────
let renderer, scene, camera, controls;
let lineA = null, lineB = null;
let boardGroup  = null;
let grid        = null;
let drillMeshA  = null, drillMeshB = null;
let animId;
let resizeObserver = null;
let animFrameCount = 0;
const ANIM_SPEED        = 1;  // bodů za krok
const FRAMES_PER_STEP   = 4;  // framů mezi kroky (~60fps → ~15 kroků/s)

// ── Souřadnicový převod ───────────────────────────────────────────
// G-code:  X = šířka prkna, Y = tloušťka (hloubka scény), Z = frézovací výška
//          Z=0 povrch, Z>0 nad povrchem (safe height), Z<0 frézuje dolů do materiálu
// Three.js: x = gcode.X,  y = gcode.Z (povrch=0, dolů=záporné),  z = -gcode.Y
const toVec = (p) => new THREE.Vector3(p.x, p.z, -p.y);

// ── Init scény ────────────────────────────────────────────────────
function initScene() {
  const el = containerRef.value;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x111827, 1);
  resize();
  el.appendChild(renderer.domElement);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV_3D, el.clientWidth / el.clientHeight, 0.1, 5000);
  camera.position.set(60, 50, 80);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping    = true;
  controls.dampingFactor    = 0.08;
  controls.screenSpacePanning = true;

  buildAxes();
  rebuildScene();
  animate();
}

function animate() {
  animId = requestAnimationFrame(animate);
  controls.update();

  if (playing.value && currentPaths.value.length > 1) {
    animFrameCount++;
    if (animFrameCount >= FRAMES_PER_STEP) {
      animFrameCount = 0;
      const next = animStep.value + ANIM_SPEED;
      if (next >= currentPaths.value.length) {
        animStep.value = currentPaths.value.length - 1;
        playing.value  = false;
      } else {
        animStep.value = next;
      }
      moveDrill(currentPaths.value[animStep.value]);
    }
  }

  renderer.render(scene, camera);
}

function resize() {
  if (!containerRef.value || !renderer) return;
  const el = containerRef.value;
  renderer.setSize(el.clientWidth, el.clientHeight);
  if (camera) {
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
  }
}

// ── Osy XYZ ───────────────────────────────────────────────────────
function buildAxes() {
  const LEN = 45;
  const axes = [
    { dir: new THREE.Vector3(1, 0, 0),  color: 0xff4444, label: 'X' },
    { dir: new THREE.Vector3(0, 1, 0),  color: 0x44ff44, label: 'Z' },
    { dir: new THREE.Vector3(0, 0, -1), color: 0x4488ff, label: 'Y' },
  ];
  for (const ax of axes) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      ax.dir.clone().multiplyScalar(LEN),
    ]);
    scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ax.color })));
    const sp = makeTextSprite(ax.label, ax.color);
    sp.position.copy(ax.dir.clone().multiplyScalar(LEN + 5));
    scene.add(sp);
  }

  // Grid v rovině Y=0 (povrch prkna)
  grid = new THREE.GridHelper(300, 30, 0x1e3a4a, 0x162330);
  grid.position.set(60, 0, -15);
  scene.add(grid);
}

/** Posune grid pod aktuální prkno */
function placeGrid() {
  const b = props.meta?.board;
  if (!grid || !b) return;
  grid.position.set((b.x0 + b.x1) / 2, 0, -(b.y0 + b.y1) / 2);
}

function makeTextSprite(text, hexColor) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = `#${hexColor.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(6, 6, 1);
  return sp;
}

// ── Rebuild všeho při změně dat ───────────────────────────────────
function rebuildScene() {
  placeGrid();
  rebuildBoard();
  rebuildLines();
  rebuildDrills();
  applyVisibility();
  autoCenterCamera();
  // Reset animace
  animStep.value = 0;
  playing.value  = false;
}

// ── Prkno ─────────────────────────────────────────────────────────
//
// Rozměry kvádru posílá server v meta.board jako rozsah v souřadnicích
// G-code: { x0, x1, y0, y1, z0, z1 }. Povrch materiálu je Z=0, frézuje se
// do záporných Z. Převod do Three.js dělá toVec().
//
function rebuildBoard() {
  if (boardGroup) { scene.remove(boardGroup); boardGroup = null; }

  const b = props.meta?.board;
  if (!b) return;

  const sw  = b.x1 - b.x0;   // délka (osa X)
  const th  = b.y1 - b.y0;   // hloubka scény (osa Y G-code)
  const dep = b.z1 - b.z0;   // výška (osa Z G-code)
  if (!(sw > 0 && th > 0 && dep > 0)) return;

  boardGroup = new THREE.Group();

  // Plný průhledný box
  const geo = new THREE.BoxGeometry(sw, dep, th);
  const mat = new THREE.MeshBasicMaterial({
    color: COLOR_BOARD, transparent: true, opacity: 0.12,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Three.y = gcode.Z, Three.z = -gcode.Y
  mesh.position.set(b.x0 + sw / 2, b.z0 + dep / 2, -(b.y0 + th / 2));
  boardGroup.add(mesh);

  // Wireframe
  const wmat = new THREE.LineBasicMaterial({ color: 0xb08030, transparent: true, opacity: 0.45 });
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wmat);
  wire.position.copy(mesh.position);
  boardGroup.add(wire);

  // Vizuální značka nulového bodu (malá kružnice v rovině Z=0 / Y Three=0)
  const ring = new THREE.RingGeometry(0.4, 0.9, 24);
  const rm   = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false });
  const rMesh = new THREE.Mesh(ring, rm);
  rMesh.rotation.x = -Math.PI / 2;
  rMesh.position.set(0, 0.01, 0);
  boardGroup.add(rMesh);

  scene.add(boardGroup);
}

// ── Dráhy frézy ───────────────────────────────────────────────────
function buildPathLines(paths, cutColor) {
  const group = new THREE.Group();
  if (!paths || paths.length < 2) return group;

  const cutPts = [], rapPts = [];
  for (let i = 1; i < paths.length; i++) {
    const a = paths[i - 1], b = paths[i];
    if (b.rapid || a.rapid) { rapPts.push(toVec(a), toVec(b)); }
    else                    { cutPts.push(toVec(a), toVec(b)); }
  }

  if (cutPts.length >= 2) {
    const g = new THREE.BufferGeometry().setFromPoints(cutPts);
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cutColor, linewidth: 2 })));
  }
  if (rapPts.length >= 2) {
    const g = new THREE.BufferGeometry().setFromPoints(rapPts);
    const l = new THREE.LineSegments(g, new THREE.LineDashedMaterial({
      color: COLOR_RAPID, linewidth: 1, dashSize: 1.5, gapSize: 1,
    }));
    l.computeLineDistances();
    group.add(l);
  }
  return group;
}

// ── Cílový profil spoje ───────────────────────────────────────────
// Server může poslat obrys řezu hotovým prknem (meta.profil_a / _b) jako
// lomenou čáru v rovině (Y, Z). Vykreslíme ji na obou koncích spoje
// a propojíme, aby byl schodový tvar hned vidět.
function buildProfile(profil, color) {
  const b = props.meta?.board;
  if (!profil || profil.length < 2 || !b) return null;

  const group = new THREE.Group();
  const mat   = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });

  // Vyplněný řez zbylým materiálem na obou koncích spoje.
  // Shape je v rovině (X=gcode Y, Y=gcode Z), otočením kolem osy Y
  // se dostane do roviny kolmé na osu X.
  const shape    = new THREE.Shape(profil.map(p => new THREE.Vector2(p.y, p.z)));
  const shapeGeo = new THREE.ShapeGeometry(shape);
  const shapeMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.22,
    depthWrite: false, side: THREE.DoubleSide,
  });

  for (const x of [b.x0, b.x1]) {
    const pts = profil.map(p => new THREE.Vector3(x, p.z, -p.y));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));

    const rez = new THREE.Mesh(shapeGeo, shapeMat);
    rez.rotation.y = Math.PI / 2;
    rez.position.x = x;
    group.add(rez);
  }

  const spojnice = [];
  for (const p of profil) {
    spojnice.push(new THREE.Vector3(b.x0, p.z, -p.y), new THREE.Vector3(b.x1, p.z, -p.y));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spojnice), mat));
  return group;
}

function rebuildLines() {
  if (lineA) { scene.remove(lineA); lineA = null; }
  if (lineB) { scene.remove(lineB); lineB = null; }
  lineA = buildPathLines(props.pathsA, COLOR_A);
  lineB = buildPathLines(props.pathsB, COLOR_B);

  const profA = buildProfile(props.meta?.profil_a, COLOR_PROFIL_A);
  const profB = buildProfile(props.meta?.profil_b, COLOR_PROFIL_B);
  if (profA) lineA.add(profA);
  if (profB) lineB.add(profB);

  scene.add(lineA);
  scene.add(lineB);
}

// ── Válec frézy ───────────────────────────────────────────────────
//
// Souřadnicový systém (po opravě toVec):
//   Three Y = gcode Z → povrch prkna = Y=0, nad povrchem Y>0, frézuje Y<0
//
// Válec frézy:
//   - skupina (drillGroup) se pohybuje na pozici toVec(pt) — tedy Y odpovídá hloubce
//   - SPODNÍ hrana válce = Y skupiny (špička frézy je na aktuální hloubce)
//   - válec sahá NAHORU o overhang mm (viditelná stopka nad povrchem)
//   - CylinderGeometry má střed uprostřed → posun mesh.y = overhang/2
//
function buildDrillMesh(drillColor) {
  const m        = props.meta;
  const r        = (m?.r) || (m?.freza ? m.freza / 2 : 2);  // fallback r=2 (freza 4mm)
  const overhang = 8;

  // Válec: spodní hrana = Y=0 skupiny (špička frézy), sahá nahoru
  const geo = new THREE.CylinderGeometry(r, r, overhang, 48, 1, false);
  const mat = new THREE.MeshBasicMaterial({
    color: drillColor, transparent: true, opacity: 0.55,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = overhang / 2;

  const wmat = new THREE.LineBasicMaterial({ color: drillColor, transparent: true, opacity: 0.85 });
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), wmat));

  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

// Výchozí pozice frézy — safe height nad nulou
const HOME_PT = { x: 0, y: 0, z: 4 };

function rebuildDrills() {
  if (drillMeshA) { scene.remove(drillMeshA); drillMeshA = null; }
  if (drillMeshB) { scene.remove(drillMeshB); drillMeshB = null; }

  drillMeshA = buildDrillMesh(COLOR_DRILL_A);
  drillMeshB = buildDrillMesh(COLOR_DRILL_B);

  if (drillMeshA) scene.add(drillMeshA);
  if (drillMeshB) scene.add(drillMeshB);

  // Vždy začít na home pozici [0,0,safe]
  moveDrillTo(drillMeshA, HOME_PT);
  moveDrillTo(drillMeshB, HOME_PT);
}

function moveDrillTo(drillGroup, pt) {
  if (!drillGroup || !pt) return;
  const v = toVec(pt);
  drillGroup.position.set(v.x, v.y, v.z);
}

// Posun frézy animované dráhy
function moveDrill(pt) {
  if (!pt) return;
  const drill = visibleTrack.value === 'b' ? drillMeshB : drillMeshA;
  moveDrillTo(drill, pt);
}

// ── Viditelnost ───────────────────────────────────────────────────
function applyVisibility() {
  if (lineA)     lineA.visible     = visibleTrack.value !== 'b';
  if (lineB)     lineB.visible     = visibleTrack.value !== 'a';
  if (drillMeshA) drillMeshA.visible = visibleTrack.value !== 'b';
  if (drillMeshB) drillMeshB.visible = visibleTrack.value !== 'a';
}

function setTrack(val) {
  visibleTrack.value = val;
  applyVisibility();
  // Reset animace na začátek nové dráhy
  animStep.value = 0;
  playing.value  = false;
  moveDrillTo(visibleTrack.value === 'b' ? drillMeshB : drillMeshA, HOME_PT);
}

// ── Animace — slider ──────────────────────────────────────────────
function togglePlay() {
  if (animStep.value >= currentPaths.value.length - 1) {
    animStep.value = 0; // restart
  }
  playing.value = !playing.value;
}

function onSlider(e) {
  playing.value  = false;
  animStep.value = parseInt(e.target.value, 10);
  moveDrill(currentPaths.value[animStep.value]);
}

// ── Kamera ────────────────────────────────────────────────────────
function autoCenterCamera() {
  const allPts = [...props.pathsA, ...props.pathsB];
  if (!allPts.length) return;

  camera.fov = FOV_3D;
  camera.updateProjectionMatrix();

  const xs   = allPts.map(p => p.x);
  const ys   = allPts.map(p => p.y);
  const zs   = allPts.map(p => p.z);
  const cx   = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy   = (Math.max(...ys) + Math.min(...ys)) / 2;
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
    20,
  );

  // Three.js target = střed dat
  controls.target.set(cx, 0, -cy);
  camera.position.set(cx + span * 1.1, span * 0.9, -cy + span * 1.2);
  controls.update();
}

function resetCamera() {
  autoCenterCamera();
}

/**
 * Pohled zepředu podél osy X — na řez spojem.
 * Používá úzký zorný úhel (teleobjektiv): perspektiva jinak rozhodí dráhu
 * po celé délce spoje do vějíře přes profil.
 */
function celniPohled() {
  const b = props.meta?.board;
  if (!b) return;

  const cy   = (b.y0 + b.y1) / 2;
  const cz   = (b.z0 + b.z1) / 2;
  const span = Math.max((b.y1 - b.y0) / camera.aspect, b.z1 - b.z0, 10);

  camera.fov = FOV_CELO;
  camera.updateProjectionMatrix();

  // přesně v ose X, aby se řez promítl bez zkreslení
  const dist = (span / 2) / Math.tan((FOV_CELO / 2) * Math.PI / 180) * 1.2;
  controls.target.set(b.x0, cz, -cy);
  camera.position.set(b.x0 - dist, cz, -cy);
  controls.update();
}

// ── Lifecycle ─────────────────────────────────────────────────────
onMounted(() => {
  initScene();
  window.addEventListener('resize', resize);
  // Panel se po vygenerování rozjíždí CSS přechodem — samotné window resize
  // by rozměry změřilo dřív, než je layout hotový, a scéna by zůstala zkreslená
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(containerRef.value);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animId);
  window.removeEventListener('resize', resize);
  resizeObserver?.disconnect();
  renderer.dispose();
});

watch(() => [props.pathsA, props.pathsB], () => {
  if (!scene) return;
  rebuildScene();
}, { deep: false });
</script>

<style scoped>
.viewer-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #111827;
  border-radius: 10px;
  overflow: hidden;
}

/* ── Toolbar ───────────────────────────────────────────────── */
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.9rem;
  background: #0c1322;
  border-bottom: 1px solid #1e2d42;
  flex-shrink: 0;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.track-toggle {
  display: flex;
  gap: 0.35rem;
}

.track-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.28rem 0.7rem;
  border: 1.5px solid #1e2d42;
  border-radius: 6px;
  background: #111827;
  color: #8899aa;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.track-btn:hover   { border-color: #4a90e2; color: #ccd; }
.track-btn.active  { border-color: #4a90e2; background: #162235; color: #fff; }

.track-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Animační controls ─────────────────────────────────────── */
.anim-controls {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
  max-width: 280px;
}

.btn-play {
  width: 28px;
  height: 28px;
  border: 1.5px solid #2a3f58;
  border-radius: 6px;
  background: #162235;
  color: #dde;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s;
}
.btn-play:hover { border-color: #4a90e2; background: #1d3450; }

.anim-slider {
  flex: 1;
  min-width: 0;
  accent-color: #4a90e2;
  cursor: pointer;
  height: 4px;
}

.anim-pct {
  font-size: 0.75rem;
  color: #668;
  width: 34px;
  text-align: right;
  flex-shrink: 0;
}

.view-buttons {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.btn-reset {
  padding: 0.28rem 0.7rem;
  border: 1.5px solid #1e2d42;
  border-radius: 6px;
  background: #111827;
  color: #8899aa;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.btn-reset:hover { border-color: #aab; color: #eee; }

/* ── Canvas ────────────────────────────────────────────────── */
.canvas-container {
  flex: 1;
  min-height: 0;
}
.canvas-container canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
