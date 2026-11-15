/**
 * dira.js — generátor G-code pro vyfrézování kruhové díry
 *
 * GEOMETRIE
 * ─────────
 * Obdoba válce, jen obráceně: odpad je UVNITŘ kruhu. Fréza vyjede kruhovou
 * drážku (jednu šířku frézy) do hloubky hloubka_vnoreni; její vnější stěna
 * je hotová díra o průměru prumer_diry. Špunt uprostřed je odpad.
 *
 * Řez rovinou XZ (× = nula X0 Y0):
 *
 *     ──────┐   ┌──×──┐   ┌──────   Z0 = povrch
 *           │   │odpad│   │
 *           │   │     │   │
 *           └───┘     └───┘         Z = -hloubka_vnoreni
 *          ├──── prumer_diry ────┤
 *
 * Střed frézy jede po kružnici o poloměru Rc = prumer_diry/2 - r.
 * Díra musí být větší než fréza (Rc > 0).
 *
 * NULOVÁNÍ
 * ────────
 * Stejně jako u válce: nula je ve STŘEDU díry (X0 Y0), Z0 je povrch.
 *
 * FRÉZOVÁNÍ
 * ─────────
 * Jako válec — po vrstvách krok_vnoreni, zanoření v (Rc, 0), celý kruh
 * dvěma půloblouky. Směr je ale G03 (proti směru hodin): na vnitřní stěně
 * díry je to sousledné frézování, tedy čistší povrch hotové díry.
 */

import { fmt, formatDoba } from './util.js';
import { Valec, SAFE_Z } from './valec.js';

const SEGMENTY_3D = 48;   // počet úseček na kružnici v 3D náhledu
const OKRAJ_3D    = 5;    // přesah kvádru materiálu za díru v náhledu (mm)

export class Dira extends Valec {
  /**
   * @param {object} config
   * @param {string} config.nazev
   * @param {number} config.prumer_diry      průměr výsledné díry (mm)
   * @param {number} config.hloubka_vnoreni  hloubka díry (mm)
   * @param {number} config.freza            průměr stopkové frézy (mm)
   * @param {number} config.krok_vnoreni     hloubka záběru na průjezd (mm)
   * @param {number} config.posuv            posuv (mm/min)
   * @param {number} config.rozbeh           čekání na náběh otáček (s)
   */
  constructor(config) {
    super({ ...config, nazev: config.nazev ?? 'dira' });
    this.prumer_diry = parseFloat(config.prumer_diry) || 20;
    this.rc = this.prumer_diry / 2 - this.r;   // poloměr dráhy středu frézy
  }

  /** Chyby, které nejdou vyjádřit rozsahem jednoho pole */
  static kontrola(params) {
    const D = parseFloat(params.prumer_diry);
    const d = parseFloat(params.freza);
    return D > d ? [] : ['Průměr díry musí být větší než průměr frézy.'];
  }

  generate() {
    const R = this.prumer_diry / 2 + OKRAJ_3D;   // polovina strany kvádru v náhledu
    return {
      fn:   this.fn,
      a:    this.generovat(),
      meta: {
        typ:             'dira',
        prumer_diry:     this.prumer_diry,
        hloubka_vnoreni: this.hloubka_vnoreni,
        freza:           this.d,
        r:               this.r,
        doba_s:          this._odhadDoby(),
        board: {
          x0: -R, x1: R,
          y0: -R, y1: R,
          z0: -this.hloubka_vnoreni, z1: 0,
        },
        dira: {
          r:      this.prumer_diry / 2,
          odpad:  Math.max(this.prumer_diry / 2 - this.d, 0),
          h:      this.hloubka_vnoreni,
        },
      },
    };
  }

  _hlavicka() {
    this._wr(`(dira ${this.fn})`);
    this._wr(`(prumer diry ${this.prumer_diry})`);
    this._wr(`(hloubka vnoreni ${this.hloubka_vnoreni})`);
    this._wr(`(freza ${this.d})`);
    this._wr(`(krok vnoreni ${this.krok_vnoreni})`);
    this._wr(`(posuv ${this.posuv})`);
    this._wr(`(odhadovana doba ${formatDoba(this._odhadDoby())} - bez zrychleni stroje)`);
    this._wr('');
    this._wr('(nulovani: X0 Y0 = STRED diry, Z0 = povrch)');
    this._wr('');
    this._wr('G90   (absolutni souradnice)');
    this._wr('G21   (milimetry)');
    this._wr('G17   (rovina XY pro oblouky)');
    this._wr(`G00 Z${SAFE_Z}`);
    this._move(0, 0, SAFE_Z, true);
    this._wr('M03 S24000   (spusteni pravych otacek vretene)');
    this._wr(`G04 P${fmt(this.rozbeh)}   (cekani na nabehnuti otacek)`);
    this._wr(`F${fmt(this.posuv)}   (posuv mm/min)`);
  }

  /**
   * Celá kružnice ze startu (Rc, 0) zpět do (Rc, 0) proti směru hodin.
   * Dva půloblouky přes (-Rc, 0); střed oblouku je vždy v počátku.
   */
  _kruh(z) {
    const rc = this.rc;
    this._wr(`G03 X${fmt(-rc)} Y0 I${fmt(-rc)} J0`);
    this._wr(`G03 X${fmt(rc)} Y0 I${fmt(rc)} J0`);

    // 3D náhled neumí oblouky — rozložit na úsečky (proti směru hodin = úhel roste)
    for (let i = 1; i <= SEGMENTY_3D; i++) {
      const u = 2 * Math.PI * i / SEGMENTY_3D;
      this._move(rc * Math.cos(u), rc * Math.sin(u), z, false);
    }
  }
}
