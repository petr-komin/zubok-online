<template>
  <div class="proporce">
    <!-- ─── Volba systému ─── -->
    <div class="blok">
      <h3>Proporční systém</h3>
      <div class="chipy">
        <button
          v-for="s in SYSTEMY"
          :key="s.key"
          type="button"
          :class="['chip', { active: s.key === systemKey }]"
          @click="systemKey = s.key"
        >
          {{ s.label }}
          <small>{{ s.zapis }}</small>
        </button>
      </div>
      <p class="puvod">{{ sys.puvod }}</p>
    </div>

    <!-- ─── Způsob odvození ─── -->
    <div class="blok">
      <h3>Jak se dopočítávají</h3>
      <div class="prepinac">
        <button type="button" :class="['pul', { active: rezim === 'mocniny' }]" @click="rezim = 'mocniny'">
          Řada mocnin
          <small>a : a·r : a·r²</small>
        </button>
        <button type="button" :class="['pul', { active: rezim === 'stredy' }]" @click="rezim = 'stredy'">
          Střed (Alberti)
          <small>třetí rozměr jako průměr</small>
        </button>
        <button type="button" :class="['pul', { active: rezim === 'fibonacci' }]" @click="rezim = 'fibonacci'">
          Fibonacci
          <small>celá čísla blízká φ</small>
        </button>
      </div>

      <div v-if="rezim === 'fibonacci'" class="fib-volba">
        <label>
          Začátek řady
          <span class="fib-seed">
            <input type="number" step="1" min="1" v-model.number="seedA" />
            <span>a</span>
            <input type="number" step="1" min="1" v-model.number="seedB" />
          </span>
        </label>
        <p class="puvod">
          Každý člen je součtem dvou předchozích. Podíl sousedů se blíží zlatému řezu —
          od dvojice 8:13 je odchylka pod půl procenta, což na dřevě nerozeznáš.
          Řada konverguje k φ z <em>jakékoliv</em> počáteční dvojice, takže si můžeš
          zvolit kulaté rozměry a pořád být v poměru.
        </p>
        <div class="zebrik">
          <button
            v-for="(clen, i) in rada"
            :key="i"
            type="button"
            :class="['prycka', { vybrana: indexy.includes(i) }]"
            :title="indexy.includes(i) ? 'vybraný člen' : 'přiřadit nejbližšímu rozměru'"
            @click="klikniNaPrycku(i)"
          >{{ clen }}</button>
        </div>
      </div>

      <div v-if="rezim === 'stredy'" class="stred-volba">
        <label>
          Druh středu
          <select v-model="stredKey">
            <option v-for="s in STREDY" :key="s.key" :value="s.key">{{ s.label }} — {{ s.vzorec }}</option>
          </select>
        </label>
        <label>
          Dopočítává se
          <select v-model.number="odvozeny">
            <option v-for="(r, i) in ROZMERY" :key="r.key" :value="i">{{ r.label }}</option>
          </select>
        </label>
        <p class="puvod">{{ stredDef.popis }}</p>
      </div>
    </div>

    <!-- ─── Rozměry ─── -->
    <div class="blok">
      <h3>Rozměry</h3>
      <div class="rozmery">
        <div
          v-for="(r, i) in ROZMERY"
          :key="r.key"
          class="radek"
          :class="{ odvozeny: rezim === 'stredy' && i === odvozeny }"
        >
          <label :for="'rozmer-' + r.key">{{ r.label }}</label>

          <div class="input-wrap">
            <input
              :id="'rozmer-' + r.key"
              type="number"
              step="any"
              min="0"
              :value="zobrazene[i]"
              :readonly="rezim === 'stredy' && i === odvozeny"
              @input="zadej(i, $event.target.value)"
            />
            <span class="unit">mm</span>
          </div>

          <!-- mocnina má smysl jen v režimu řady -->
          <div v-if="rezim === 'fibonacci'" class="mocnina">
            <button type="button" @click="posunIndex(i, -1)" aria-label="o krok zpět v řadě">&minus;</button>
            <span class="mocnina-hodnota" :title="'člen č. ' + (indexy[i] + 1) + ' Fibonacciho řady'">
              #{{ indexy[i] + 1 }}
            </span>
            <button type="button" @click="posunIndex(i, +1)" aria-label="o krok vpřed v řadě">+</button>
          </div>

          <div v-else-if="rezim === 'mocniny'" class="mocnina">
            <button type="button" @click="posunMocninu(i, -1)" aria-label="snížit násobitel">&minus;</button>
            <span class="mocnina-hodnota" :title="'rozměr = základ × ' + sys.zapis.split(' : ')[1] + '^' + mocniny[i]">
              r<sup>{{ mocniny[i] }}</sup>
            </span>
            <button type="button" @click="posunMocninu(i, +1)" aria-label="zvýšit násobitel">+</button>
          </div>

          <span v-else class="odvozeny-znacka">
            {{ i === odvozeny ? stredDef.vzorec : '' }}
          </span>
        </div>
      </div>

      <label class="zaokrouhleni">
        Zaokrouhlit na
        <select v-model.number="krok">
          <option :value="0">přesně</option>
          <option :value="0.5">0,5 mm</option>
          <option :value="1">1 mm</option>
          <option :value="5">5 mm</option>
          <option :value="10">10 mm</option>
        </select>
      </label>
    </div>

    <!-- ─── Výsledek ─── -->
    <div class="vysledek">
      <div class="shrnuti">
        <strong>{{ shrnuti }}</strong>
        <button type="button" class="kopie" @click="zkopiruj">{{ zkopirovano ? 'zkopírováno' : 'kopírovat' }}</button>
      </div>

      <svg class="nahled" :viewBox="nahled.viewBox" preserveAspectRatio="xMidYMid meet" role="img"
           aria-label="Náhled proporcí krabičky">
        <polygon :points="nahled.horni"  class="stena horni" />
        <polygon :points="nahled.bocni"  class="stena bocni" />
        <polygon :points="nahled.predni" class="stena predni" />
      </svg>

      <dl class="pomery">
        <div v-for="(p, i) in pomeryText" :key="i">
          <dt>{{ p.label }}</dt>
          <dd :class="{ odchylka: p.odchyl }">{{ p.value }}</dd>
        </div>
      </dl>
      <p v-if="nejakaOdchylka" class="poznamka">{{ poznamka }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import {
  SYSTEMY, STREDY, system, stred,
  dopocitejMocniny, dopocitejStred, zaokrouhli, cislo, skutecnePomery,
  fibRada, nejblizsiIndex,
} from '../core/proporce.js';

const ROZMERY = [
  { key: 'sirka',   label: 'Šířka'   },
  { key: 'vyska',   label: 'Výška'   },
  { key: 'hloubka', label: 'Hloubka' },
];

const systemKey = ref('zlaty');
const rezim     = ref('mocniny');
const stredKey  = ref('geometricky');
const odvozeny  = ref(1);
const krok      = ref(1);

const sys      = computed(() => system(systemKey.value));
const stredDef = computed(() => stred(stredKey.value));

/** Mocnina u každého rozměru — tohle je ten „násobitel“ */
const mocniny = reactive([0, 1, 2]);

/** Fibonacci: počátek řady a indexy vybraných členů */
const seedA  = ref(30);
const seedB  = ref(50);
const indexy = reactive([0, 1, 2]);
const POCET_CLENU = 11;

const rada = computed(() => {
  const a = Number(seedA.value) > 0 ? Number(seedA.value) : 1;
  const b = Number(seedB.value) > 0 ? Number(seedB.value) : 1;
  return fibRada(a, b, POCET_CLENU);
});

/** Přesné hodnoty; v inputech se ukazují zaokrouhlené */
const presne = ref([50, 0, 0]);
/** Který rozměr uživatel zadal naposledy — od něj se počítá */
const kotva = ref(0);

function prepocitej() {
  if (rezim.value === 'fibonacci') {
    presne.value = indexy.map(i => rada.value[Math.min(i, rada.value.length - 1)]);
  } else if (rezim.value === 'mocniny') {
    presne.value = dopocitejMocniny(sys.value.pomer, mocniny, kotva.value, presne.value[kotva.value]);
  } else {
    presne.value = dopocitejStred(stredDef.value, presne.value, odvozeny.value);
  }
}

prepocitej();
watch(
  [systemKey, rezim, stredKey, odvozeny, () => [...mocniny], () => [...indexy], rada],
  prepocitej,
);

const zobrazene = computed(() => presne.value.map(n => cislo(zaokrouhli(n, krok.value), krok.value ? 2 : 3)));
/** Hodnoty, které uživatel opravdu odměří — z nich počítáme skutečné poměry */
const finalni   = computed(() => presne.value.map(n => zaokrouhli(n, krok.value)));

function zadej(i, raw) {
  const v = parseFloat(String(raw).replace(',', '.'));
  if (!isFinite(v) || v <= 0) return;

  // ve Fibonacciho režimu se ručně zadaná hodnota přichytí na nejbližší člen
  if (rezim.value === 'fibonacci') {
    indexy[i] = nejblizsiIndex(rada.value, v);
    prepocitej();
    return;
  }

  presne.value = presne.value.map((p, j) => (j === i ? v : p));
  // ve středovém režimu je kotvou vždy dvojice volných rozměrů
  if (rezim.value === 'mocniny') kotva.value = i;
  prepocitej();
}

function posunIndex(i, delta) {
  const novy = indexy[i] + delta;
  if (novy < 0 || novy >= rada.value.length) return;
  indexy[i] = novy;
}

/** Klik na člen řady ho přiřadí rozměru, jehož hodnota je nejblíž */
function klikniNaPrycku(i) {
  if (indexy.includes(i)) return;
  const cil = indexy
    .map((idx, r) => ({ r, vzdalenost: Math.abs(idx - i) }))
    .sort((a, b) => a.vzdalenost - b.vzdalenost)[0].r;
  indexy[cil] = i;
}

function posunMocninu(i, delta) {
  const nova = mocniny[i] + delta;
  if (nova < -3 || nova > 6) return;
  mocniny[i] = nova;
  // ať se kotva nezmění, uživatel by přišel o rozměr, který si nastavil
}

const shrnuti = computed(() =>
  finalni.value.map(n => cislo(n, krok.value ? 2 : 3)).join(' × ') + ' mm',
);

const pomeryText = computed(() => {
  const sk    = skutecnePomery(finalni.value);
  const ideal = sys.value.pomer;
  const popis = [`${ROZMERY[0].label} → ${ROZMERY[1].label}`, `${ROZMERY[1].label} → ${ROZMERY[2].label}`];
  return sk.map((p, i) => {
    // v režimu mocnin je ideál r na rozdíl mocnin, ne prostě r
    // ve Fibonacciho režimu je ideálem vždy φ, bez ohledu na zvolený systém
    const ocekavany = rezim.value === 'mocniny'
      ? Math.pow(ideal, mocniny[i + 1] - mocniny[i])
      : rezim.value === 'fibonacci'
        ? Math.pow((1 + Math.sqrt(5)) / 2, indexy[i + 1] - indexy[i])
        : null;
    const odchyl = ocekavany !== null && Math.abs(p - ocekavany) / ocekavany > 0.01;
    return {
      label:  popis[i],
      value:  '1 : ' + cislo(p, 3),
      odchyl,
    };
  });
});

const nejakaOdchylka = computed(() => pomeryText.value.some(p => p.odchyl));

/**
 * Proč se poměr liší od ideálu — v každém režimu z jiného důvodu,
 * a jen u mocnin za to opravdu může zaokrouhlení.
 */
const poznamka = computed(() => {
  if (rezim.value === 'fibonacci') {
    return 'Takhle blízko začátku řady se podíl od φ ještě znatelně liší. ' +
           'Posuň rozměry dál do řady (nebo zvol vyšší začátek) a odchylka klesne.';
  }
  return 'Zaokrouhlení posunulo poměr od ideálu. Na dřevě to nepoznáš, ale je to vidět tady.';
});

/** Kabinetní projekce krabičky — přední stěna v pravém úhlu, hloubka šikmo */
const nahled = computed(() => {
  const [w, h, d] = finalni.value.map(n => (isFinite(n) && n > 0 ? n : 1));
  const k  = 0.4;                 // zkrácení hloubky, aby to vypadalo jako kresba
  const dx = d * k, dy = -d * k;

  const F = [[0, 0], [w, 0], [w, h], [0, h]];
  const B = F.map(([x, y]) => [x + dx, y + dy]);

  const xs = [...F, ...B].map(p => p[0]);
  const ys = [...F, ...B].map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const sirka = Math.max(...xs) - x0, vyska = Math.max(...ys) - y0;
  const pad = Math.max(sirka, vyska) * 0.06;

  const bod = ([x, y]) => `${(x - x0 + pad).toFixed(2)},${(y - y0 + pad).toFixed(2)}`;
  const poly = pts => pts.map(bod).join(' ');

  return {
    viewBox: `0 0 ${(sirka + 2 * pad).toFixed(2)} ${(vyska + 2 * pad).toFixed(2)}`,
    predni:  poly(F),
    horni:   poly([F[0], F[1], B[1], B[0]]),
    bocni:   poly([F[1], F[2], B[2], B[1]]),
  };
});

const zkopirovano = ref(false);
async function zkopiruj() {
  try {
    await navigator.clipboard.writeText(shrnuti.value);
    zkopirovano.value = true;
    setTimeout(() => { zkopirovano.value = false; }, 1500);
  } catch {
    // schránka může být zakázaná (http, oprávnění) — tichý neúspěch stačí
  }
}
</script>

<style scoped>
.proporce {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 380px);
  gap: 1.25rem;
  align-items: start;
}

.blok { margin-bottom: 1.1rem; }
.blok:last-child { margin-bottom: 0; }

.proporce > .blok { grid-column: 1; }
.vysledek {
  grid-column: 2;
  grid-row: 1 / span 3;
  position: sticky;
  top: 0;
  background: #f8fafc;
  border: 1px solid #dde4ee;
  border-radius: 9px;
  padding: 1rem;
}

h3 {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7a8d;
  margin-bottom: 0.5rem;
}

/* ─── Chipy systémů ─── */
.chipy { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  padding: 0.3rem 0.6rem;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: #fff;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  color: #33445c;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.chip small { font-size: 0.68rem; font-weight: 400; opacity: 0.6; }
.chip:hover { border-color: var(--color-accent); }
.chip.active {
  border-color: var(--color-accent);
  background: #eef5ff;
  color: #14304f;
}

.puvod {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #5a6779;
}

/* ─── Přepínač režimu ─── */
.prepinac { display: flex; gap: 0.35rem; }

.pul {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.4rem 0.7rem;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: #fff;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: #33445c;
  cursor: pointer;
}

.pul small { font-size: 0.68rem; font-weight: 400; opacity: 0.6; }
.pul.active { border-color: var(--color-accent); background: #eef5ff; }

.stred-volba {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.6rem;
}

.stred-volba label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
  color: var(--color-label);
}

.stred-volba .puvod { flex-basis: 100%; margin-top: 0; }

select {
  padding: 0.3rem 0.4rem;
  border: 1.5px solid var(--color-border);
  border-radius: 5px;
  font-family: inherit;
  font-size: 0.85rem;
  background: #fff;
}

/* ─── Řádky rozměrů ─── */
.rozmery { display: flex; flex-direction: column; gap: 0.45rem; }

.radek {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
}

.radek > label { font-size: 0.85rem; color: var(--color-label); font-weight: 600; }

.input-wrap { position: relative; display: flex; align-items: center; }

.input-wrap input {
  width: 100%;
  padding: 0.35rem 2.2rem 0.35rem 0.5rem;
  border: 1.5px solid var(--color-border);
  border-radius: 5px;
  font-family: inherit;
  font-size: 0.95rem;
  text-align: right;
}

.input-wrap input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.radek.odvozeny .input-wrap input {
  background: #f1f4f9;
  color: #56637a;
  cursor: not-allowed;
}

.unit {
  position: absolute;
  right: 0.5rem;
  font-size: 0.75rem;
  color: #8894a6;
  pointer-events: none;
}

/* ─── Násobitel ─── */
.mocnina {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.mocnina button {
  width: 1.5rem;
  height: 1.5rem;
  border: 1.5px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1;
  color: #33445c;
  cursor: pointer;
}

.mocnina button:hover { border-color: var(--color-accent); color: var(--color-accent); }

.mocnina-hodnota {
  min-width: 2.1rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e2b3c;
  cursor: help;
}

.odvozeny-znacka {
  font-size: 0.72rem;
  color: #8894a6;
  white-space: nowrap;
}

.fib-volba { margin-top: 0.6rem; }

.fib-volba > label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--color-label);
}

.fib-seed { display: flex; align-items: center; gap: 0.3rem; }

.fib-seed input {
  width: 4rem;
  padding: 0.25rem 0.4rem;
  border: 1.5px solid var(--color-border);
  border-radius: 5px;
  font-family: inherit;
  font-size: 0.85rem;
  text-align: right;
}

.fib-seed span { font-size: 0.78rem; color: #8894a6; }

.zebrik {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.prycka {
  min-width: 2.6rem;
  padding: 0.25rem 0.4rem;
  border: 1.5px solid var(--color-border);
  border-radius: 5px;
  background: #fff;
  font-family: inherit;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: #56637a;
  cursor: pointer;
}

.prycka:hover { border-color: var(--color-accent); }

.prycka.vybrana {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
  font-weight: 700;
}

.zaokrouhleni {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.7rem;
  font-size: 0.8rem;
  color: var(--color-label);
}

/* ─── Výsledek ─── */
.shrnuti {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 1.05rem;
  color: #14304f;
}

.kopie {
  border: none;
  background: none;
  font-family: inherit;
  font-size: 0.72rem;
  color: var(--color-accent);
  cursor: pointer;
  padding: 0;
}

.kopie:hover { text-decoration: underline; }

.nahled {
  display: block;
  width: 100%;
  height: 170px;
  margin: 0.8rem 0;
}

.stena { stroke: #37506e; stroke-width: 0.6; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.predni { fill: #cddcf0; }
.horni  { fill: #eaf1fa; }
.bocni  { fill: #aec4de; }

.pomery { display: flex; flex-direction: column; gap: 0.25rem; }

.pomery > div {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}

.pomery dt { color: #6b7a8d; }
.pomery dd { font-weight: 600; color: #1e2b3c; }
.pomery dd.odchylka { color: #b07000; }

.poznamka {
  margin-top: 0.5rem;
  font-size: 0.73rem;
  line-height: 1.4;
  color: #8a6d3b;
}

@media (max-width: 860px) {
  .proporce { grid-template-columns: minmax(0, 1fr); }
  .proporce > .blok, .vysledek { grid-column: 1; }
  .vysledek { grid-row: auto; position: static; }
}
</style>
