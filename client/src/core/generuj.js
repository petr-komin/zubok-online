/**
 * generuj.js — vstupní bod generátorů
 *
 * Nahrazuje bývalý endpoint POST /api/generate/:typ. Vrací stejný tvar dat,
 * jaký dřív posílal server, takže UI zůstává beze změny.
 */

import { Zubok }  from './zubok.js';
import { Schody } from './schody.js';
import { Valec }  from './valec.js';
import { PRAVIDLA, validuj } from './validace.js';

const KLASY = { zubok: Zubok, schody: Schody, valec: Valec };

/** Chyba s hláškou určenou uživateli (dřív přicházela jako 400 z API) */
export class ChybaParametru extends Error {}

/**
 * @param {'zubok'|'schody'|'valec'} typ
 * @param {object} params  hodnoty z formuláře
 * @returns {{fn:string, gcode_a:string, gcode_b?:string, paths_a:Array, paths_b?:Array, meta:object}}
 */
export function generuj(typ, params) {
  const Klass = KLASY[typ];
  if (!Klass) throw new ChybaParametru(`Neznámý typ generátoru: ${typ}`);

  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new ChybaParametru('Neplatné parametry.');
  }

  const errors = validuj(params, PRAVIDLA[typ]);
  if (errors.length) throw new ChybaParametru(errors.join('; '));

  const result = new Klass(params).generate();

  // generátor s jediným programem (valec) variantu b nevrací
  return {
    fn:      result.fn,
    gcode_a: result.a.gcode,
    gcode_b: result.b?.gcode,
    paths_a: result.a.paths,
    paths_b: result.b?.paths,
    meta:    result.meta,
  };
}
