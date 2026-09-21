/**
 * util.js — sdílené pomocné funkce generátorů G-code
 */

'use strict';

/**
 * Nahradí diakritiku a mezery pro bezpečný název souboru
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  const from = 'áäčďéěíľĺňóôöőřšťúüűýžÁÄČĎÉĚÍĽĹŇÓÔÖŐŘŠŤÚÜŰÝŽ';
  const to   = 'aacdeeillnoooorstuuuyzAACDEEILLNOOOORSTUUUYZ';
  let result = '';
  for (const ch of filename) {
    const idx = [...from].indexOf(ch);
    result += idx >= 0 ? to[idx] : ch;
  }
  // Whitelist: pouze bezpečné znaky, bez path traversal
  result = result
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')  // odstranit vše mimo whitelist
    .replace(/^\.+/, '')               // odstranit tečky na začátku
    .slice(0, 64);                     // max délka
  return result || 'zubok';            // fallback pokud je prázdný
}

/**
 * Formátuje číslo — odstraní zbytečné nuly pro čistější G-code
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return parseFloat(n.toFixed(4)).toString();
}

const RYCHLOPOSUV = 1000;   // předpokládaná rychlost G00 pro odhad doby (mm/min)

/**
 * Odhad doby běhu programu v sekundách ze seznamu pohybů.
 * Rozběh vřetene + dráha / posuv. Nepočítá se zrychlením a zpomalením
 * stroje, skutečnost bude o něco delší.
 * @param {Array<{x:number,y:number,z:number,rapid:boolean}>} paths
 * @param {{posuv:number, rozbeh?:number, start?:{x:number,y:number,z:number}}} opts
 * @returns {number} sekundy
 */
function odhadDoby(paths, { posuv, rozbeh = 0, start = { x: 0, y: 0, z: 0 } }) {
  let rez = 0, rychle = 0;
  let p = start;
  for (const q of paths) {
    const l = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    if (q.rapid) rychle += l; else rez += l;
    p = q;
  }
  return rozbeh + (rez / posuv + rychle / RYCHLOPOSUV) * 60;
}

/** 219 → "3 min 39 s", 3900 → "1 h 5 min" (bez diakritiky — jde do G-code) */
function formatDoba(s) {
  const celk = Math.round(s);
  const h    = Math.floor(celk / 3600);
  const min  = Math.floor((celk % 3600) / 60);
  const sek  = celk % 60;
  if (h)   return `${h} h ${min} min`;
  if (min) return `${min} min ${sek} s`;
  return `${sek} s`;
}

module.exports = { sanitizeFilename, fmt, odhadDoby, formatDoba, RYCHLOPOSUV };
