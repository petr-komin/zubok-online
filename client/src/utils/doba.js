/**
 * Formátování odhadované doby frézování.
 * Stejný tvar má i server/util.js — odhad v hlavičce G-code a v UI musí
 * vypadat stejně.
 */

/** 219 → "3 min 39 s", 3900 → "1 h 5 min" */
export function formatDoba(s) {
  const celk = Math.round(s);
  const h    = Math.floor(celk / 3600);
  const min  = Math.floor((celk % 3600) / 60);
  const sek  = celk % 60;
  if (h)   return `${h} h ${min} min`;
  if (min) return `${min} min ${sek} s`;
  return `${sek} s`;
}
