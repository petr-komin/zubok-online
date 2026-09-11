/**
 * Konfigurace generátoru "valec" — vyfrézování válce
 *
 * Kolem středu (nula X0 Y0) se vyfrézuje kruhová drážka do dané hloubky,
 * uprostřed zůstane válec. Výstupem je jediný G-code soubor.
 */
export default {
  key:      'valec',
  label:    'Válec',
  popis:    'válec uprostřed, drážka kolem',
  endpoint: '/api/generate/valec',

  defaults: {
    nazev:           'valec',
    prumer_valce:    10,
    hloubka_vnoreni: 8,
    freza:           4,
    krok_vnoreni:    0.5,
    posuv:           200,
    rozbeh:          3,
  },

  fields: [
    {
      key: 'nazev',
      label: 'Název',
      type: 'text',
      step: undefined,
      min: undefined,
      placeholder: 'valec',
      hint: 'Použije se jako název souboru',
      fullWidth: true,
    },
    {
      key: 'prumer_valce',
      label: 'Průměr válce',
      unit: 'mm',
      step: 0.1,
      min: 0.1,
      placeholder: '10',
      hint: 'Válec, který zůstane uprostřed',
    },
    {
      key: 'hloubka_vnoreni',
      label: 'Hloubka vnoření',
      unit: 'mm',
      step: 0.1,
      min: 0.1,
      placeholder: '8',
      hint: 'Do jaké hloubky fréza jede',
    },
    {
      key: 'freza',
      label: 'Průměr frézy',
      unit: 'mm',
      step: 0.1,
      placeholder: '4',
      hint: 'Průměr stopkové frézy',
    },
    {
      key: 'krok_vnoreni',
      label: 'Velikost kroku',
      unit: 'mm',
      step: 0.1,
      placeholder: '0.5',
      hint: 'Hloubka záběru na jeden oběh',
    },
    {
      key: 'posuv',
      label: 'Rychlost posuvu',
      unit: 'mm/min',
      step: 1,
      min: 1,
      placeholder: '200',
      hint: 'Posuv frézy (F v G-code)',
    },
    {
      key: 'rozbeh',
      label: 'Rozběh vřetene',
      unit: 's',
      step: 0.5,
      min: 0,
      max: 60,
      placeholder: '3',
      hint: 'Čekání na náběh otáček (G04) před prvním řezem',
    },
  ],

  info(p) {
    const dv = parseFloat(p.prumer_valce);
    const d  = parseFloat(p.freza);
    const h  = parseFloat(p.hloubka_vnoreni);
    const k  = parseFloat(p.krok_vnoreni);
    const f  = parseFloat(p.posuv);
    const rb = parseFloat(p.rozbeh);
    if (!dv || !d || !h || !k) return [];

    const vrstev = pocetVrstev(h, k);
    const out = [
      { label: 'Průměr dráhy frézy', value: `${(dv + d).toFixed(2)} mm` },
      { label: 'Vnější průměr drážky', value: `${(dv + 2 * d).toFixed(2)} mm` },
      { label: 'Počet oběhů', value: vrstev },
    ];
    if (f > 0) {
      out.push({
        label: 'Odhadovaná doba',
        value: formatDoba(odhadDoby(dv / 2 + d / 2, h, vrstev, f, Number.isNaN(rb) ? 0 : rb)),
      });
    }
    return out;
  },
};

// Musí odpovídat server/valec.js (_hladiny, _odhadDoby) — hlavička G-code
// ukazuje tentýž odhad
const SAFE_Z      = 4;
const NAJETI_Z    = 0.5;
const RYCHLOPOSUV = 1000;   // mm/min, předpoklad pro G00

function pocetVrstev(h, k) {
  let n = 1;   // poslední vrstva na plné hloubce
  for (let z = k; z < h - 1e-9; z += k) n++;
  return n;
}

/** Sekundy: rozběh + dráha / posuv, bez zrychlení stroje */
function odhadDoby(rc, h, vrstev, posuv, rozbeh) {
  const rez    = vrstev * 2 * Math.PI * rc + NAJETI_Z + h;
  const rychle = 2 * rc + (SAFE_Z - NAJETI_Z) + (SAFE_Z + h);
  return rozbeh + (rez / posuv + rychle / RYCHLOPOSUV) * 60;
}

function formatDoba(s) {
  const celk = Math.round(s);
  const h    = Math.floor(celk / 3600);
  const min  = Math.floor((celk % 3600) / 60);
  const sek  = celk % 60;
  if (h)   return `${h} h ${min} min`;
  if (min) return `${min} min ${sek} s`;
  return `${sek} s`;
}
