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

module.exports = { sanitizeFilename, fmt };
