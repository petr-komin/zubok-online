/**
 * valec.js — generátor G-code pro vyfrézování válce
 *
 * GEOMETRIE
 * ─────────
 * Uprostřed zůstane válec o průměru prumer_valce. Kolem něj fréza vyjede
 * kruhovou drážku (jednu šířku frézy) do hloubky hloubka_vnoreni.
 *
 * Řez rovinou XZ (× = nula X0 Y0):
 *
 *     ────┐   ┌─────×─────┐   ┌────   Z0 = povrch
 *         │   │   válec   │   │
 *         │   │           │   │
 *         └───┘           └───┘       Z = -hloubka_vnoreni
 *        drážka           drážka
 *
 * Střed frézy jede po kružnici o poloměru Rc = prumer_valce/2 + r.
 *
 * NULOVÁNÍ
 * ────────
 * Na rozdíl od zubok a schodů je nula ve STŘEDU válce (X0 Y0), Z0 je povrch.
 *
 * FRÉZOVÁNÍ
 * ─────────
 * Podobně jako zubok — po vrstvách krok_vnoreni. V každé vrstvě se fréza
 * zanoří kolmo v bodě (Rc, 0) a objede celou kružnici. Poslední vrstva je
 * vždy přesně na plné hloubce. Kružnice je rozdělená na dva půloblouky G02,
 * protože některé řídicí systémy neumí celý kruh jedním příkazem.
 * G02 (po směru hodin) = sousledné frézování na stěně válce → čistší povrch.
 */


import { sanitizeFilename, fmt, formatDoba, RYCHLOPOSUV } from './util.js';

const SAFE_Z       = 4;    // bezpečná výška nad povrchem (mm)
const NAJETI_Z     = 0.5;  // odkud se rychloposuvem sjede před prvním zanořením (mm)
const SEGMENTY_3D  = 48;   // počet úseček na kružnici v 3D náhledu
const OKRAJ_3D     = 5;    // přesah kvádru materiálu za drážku v náhledu (mm)
const EPS          = 1e-9;

export class Valec {
  /**
   * @param {object} config
   * @param {string} config.nazev
   * @param {number} config.prumer_valce     průměr válce, který zůstane (mm)
   * @param {number} config.hloubka_vnoreni  hloubka drážky (mm)
   * @param {number} config.freza            průměr stopkové frézy (mm)
   * @param {number} config.krok_vnoreni     hloubka záběru na průjezd (mm)
   * @param {number} config.posuv            posuv (mm/min)
   * @param {number} config.rozbeh           čekání na náběh otáček (s)
   */
  constructor(config) {
    this.nazev           = config.nazev ?? 'valec';
    this.prumer_valce    = parseFloat(config.prumer_valce)    || 10;
    this.hloubka_vnoreni = parseFloat(config.hloubka_vnoreni) || 8;
    this.d               = parseFloat(config.freza)           || 4;
    this.r               = this.d / 2;
    this.krok_vnoreni    = parseFloat(config.krok_vnoreni)    || 0.5;
    this.posuv           = parseFloat(config.posuv)           || 200;
    this.rozbeh          = Number.isNaN(parseFloat(config.rozbeh)) ? 3 : parseFloat(config.rozbeh);

    this.rc = this.prumer_valce / 2 + this.r;   // poloměr dráhy středu frézy
    this.fn = sanitizeFilename(this.nazev);
  }

  /**
   * @returns {{ gcode: string, paths: Array<{x:number,y:number,z:number,rapid:boolean}> }}
   */
  generovat() {
    this.lines = [];
    this.paths = [];
    this._cx = 0;
    this._cy = 0;
    this._cz = SAFE_Z;

    this._hlavicka();

    const hladiny = this._hladiny(this.hloubka_vnoreni);
    this._wr('');
    this._wr(`(drazka: polomer drahy stredu frezy ${fmt(this.rc)}, vrstev ${hladiny.length})`);
    this._wr(`G00 X${fmt(this.rc)} Y0`);
    this._move(this.rc, 0, undefined, true);
    this._wr(`G00 Z${NAJETI_Z}`);
    this._move(undefined, undefined, NAJETI_Z, true);

    for (const h of hladiny) {
      this._wr(` (vrstva Z${fmt(-h)})`);
      this._wr(`G01 Z${fmt(-h)}`);
      this._move(undefined, undefined, -h, false);
      this._kruh(-h);
    }

    this._wr('');
    this._wr(`G00 Z${SAFE_Z}`);
    this._move(undefined, undefined, SAFE_Z, true);
    this._wr('G00 X0 Y0');
    this._move(0, 0, undefined, true);
    this._wr('M05   (zastaveni frezy)');
    this._wr('M30   (konec programu)');

    return { gcode: this.lines.join('\n'), paths: this.paths };
  }

  /**
   * Válec má jediný program — vrací jen variantu a
   * @returns {{fn:string, a:object, meta:object}}
   */
  generate() {
    const R = this.rc + this.r + OKRAJ_3D;   // polovina strany kvádru v náhledu
    return {
      fn:   this.fn,
      a:    this.generovat(),
      meta: {
        typ:             'valec',
        prumer_valce:    this.prumer_valce,
        hloubka_vnoreni: this.hloubka_vnoreni,
        freza:           this.d,
        r:               this.r,
        doba_s:          this._odhadDoby(),
        board: {
          x0: -R, x1: R,
          y0: -R, y1: R,
          z0: -this.hloubka_vnoreni, z1: 0,
        },
        valec: {
          r: this.prumer_valce / 2,
          h: this.hloubka_vnoreni,
        },
      },
    };
  }

  // --- private helpers ---

  _wr(s = '') {
    this.lines.push(s);
  }

  /**
   * Zaznamená pohyb — vždy doplní chybějící osy z aktuální pozice
   */
  _move(x, y, z, rapid = false) {
    this._cx = x !== undefined ? x : this._cx;
    this._cy = y !== undefined ? y : this._cy;
    this._cz = z !== undefined ? z : this._cz;
    this.paths.push({ x: this._cx, y: this._cy, z: this._cz, rapid });
  }

  _hlavicka() {
    this._wr(`(valec ${this.fn})`);
    this._wr(`(prumer valce ${this.prumer_valce})`);
    this._wr(`(hloubka vnoreni ${this.hloubka_vnoreni})`);
    this._wr(`(freza ${this.d})`);
    this._wr(`(krok vnoreni ${this.krok_vnoreni})`);
    this._wr(`(posuv ${this.posuv})`);
    this._wr(`(odhadovana doba ${formatDoba(this._odhadDoby())} - bez zrychleni stroje)`);
    this._wr('');
    this._wr('(nulovani: X0 Y0 = STRED valce, Z0 = povrch)');
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
   * Odhad doby běhu programu v sekundách: rozběh + dráha / posuv.
   * Nepočítá se zrychlením a zpomalením stroje, skutečnost bude o něco delší.
   * Stejný vzorec má client/src/generators/valec.js pro živý odhad ve formuláři.
   */
  _odhadDoby() {
    const h      = this.hloubka_vnoreni;
    const vrstev = this._hladiny(h).length;
    const rez    = vrstev * 2 * Math.PI * this.rc   // oběhy
                 + NAJETI_Z + h;                    // zanořování
    const rychle = 2 * this.rc                      // ze středu na kružnici a zpět
                 + (SAFE_Z - NAJETI_Z)              // sjetí nad povrch
                 + (SAFE_Z + h);                    // vyjetí ze dna drážky
    return this.rozbeh + (rez / this.posuv + rychle / RYCHLOPOSUV) * 60;
  }

  /** Hloubky jednotlivých vrstev (kladná čísla) */
  _hladiny(hloubka) {
    const out = [];
    for (let z = this.krok_vnoreni; z < hloubka - EPS; z += this.krok_vnoreni) out.push(z);
    out.push(hloubka);   // poslední vrstva vždy přesně na plnou hloubku
    return out;
  }

  /**
   * Celá kružnice ze startu (Rc, 0) zpět do (Rc, 0) po směru hodin.
   * Dva půloblouky přes (-Rc, 0); střed oblouku je vždy v počátku.
   */
  _kruh(z) {
    const rc = this.rc;
    this._wr(`G02 X${fmt(-rc)} Y0 I${fmt(-rc)} J0`);
    this._wr(`G02 X${fmt(rc)} Y0 I${fmt(rc)} J0`);

    // 3D náhled neumí oblouky — rozložit na úsečky (po směru hodin = úhel klesá)
    for (let i = 1; i <= SEGMENTY_3D; i++) {
      const u = -2 * Math.PI * i / SEGMENTY_3D;
      this._move(rc * Math.cos(u), rc * Math.sin(u), z, false);
    }
  }
}

