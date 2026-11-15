/**
 * Konfigurace generátoru "dira" — vyfrézování kruhové díry
 *
 * Kolem středu (nula X0 Y0) se vyfrézuje kruhová drážka do dané hloubky,
 * její vnější stěna je hotová díra, špunt uprostřed je odpad.
 * Výstupem je jediný G-code soubor.
 */
import { formatDoba } from '../utils/doba.js';

export default {
  key:      'dira',
  label:    'Díra',
  popis:    'kruhová díra, odpad uvnitř',

  defaults: {
    nazev:           'dira',
    prumer_diry:     20,
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
      placeholder: 'dira',
      hint: 'Použije se jako název souboru',
      fullWidth: true,
    },
    {
      key: 'prumer_diry',
      label: 'Průměr díry',
      unit: 'mm',
      step: 0.1,
      min: 0.2,
      placeholder: '20',
      hint: 'Výsledná díra — musí být větší než fréza',
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
    const dd = parseFloat(p.prumer_diry);
    const d  = parseFloat(p.freza);
    const h  = parseFloat(p.hloubka_vnoreni);
    const k  = parseFloat(p.krok_vnoreni);
    const f  = parseFloat(p.posuv);
    const rb = parseFloat(p.rozbeh);
    if (!dd || !d || !h || !k) return [];
    if (dd <= d) return [{ label: 'Pozor', value: 'díra musí být větší než fréza' }];

    const vrstev = pocetVrstev(h, k);
    const out = [
      { label: 'Průměr dráhy frézy', value: `${(dd - d).toFixed(2)} mm` },
      { label: 'Průměr odpadu', value: dd > 2 * d ? `${(dd - 2 * d).toFixed(2)} mm` : 'žádný (celé vyfrézuje)' },
      { label: 'Počet oběhů', value: vrstev },
    ];
    if (f > 0) {
      out.push({
        label: 'Odhadovaná doba',
        value: formatDoba(odhadDoby(dd / 2 - d / 2, h, vrstev, f, Number.isNaN(rb) ? 0 : rb)),
      });
    }
    return out;
  },
};

// Musí odpovídat core/valec.js (_hladiny, _odhadDoby), který Dira dědí — hlavička G-code
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

