/**
 * zubok.js — JS přepis logiky z zubok.rb
 * Generátor G-code pro frézování dřevěných zubů (box joint / finger joint)
 */

'use strict';

const { sanitizeFilename, fmt, odhadDoby, formatDoba } = require('./util');

const SAFE_Z = 4;   // bezpečná výška nad povrchem (mm)

class Zubok {
  /**
   * @param {object} config
   * @param {string} config.nazev
   * @param {number} config.tloustka_prkna
   * @param {number} config.sirka_prkna
   * @param {number} config.pocet_zubu
   * @param {number} config.hloubka_zubu
   * @param {number} config.freza
   * @param {number} config.krok_vnoreni
   * @param {number} config.drveni
   * @param {number} config.posuv
   * @param {number} config.rozbeh   čekání na náběh otáček (s)
   */
  constructor(config) {
    this.nazev          = config.nazev          ?? 'output';
    this.tloustka_prkna = parseFloat(config.tloustka_prkna) || 18;
    this.sirka_prkna    = parseFloat(config.sirka_prkna)    || 120;
    this.pocet_zubu     = parseFloat(config.pocet_zubu)     || 6;
    this.sirka_zubku    = this.sirka_prkna / this.pocet_zubu;
    this.hloubka_zubu   = parseFloat(config.hloubka_zubu)   || 10;
    this.d              = parseFloat(config.freza)           || 4.0;
    this.r              = this.d / 2;
    this.krok_vnoreni   = parseFloat(config.krok_vnoreni)   || 1.0;
    this.drveni         = Number.isNaN(parseFloat(config.drveni)) ? 0 : parseFloat(config.drveni);
    this.posuv          = parseFloat(config.posuv)          || 300;
    this.rozbeh         = Number.isNaN(parseFloat(config.rozbeh)) ? 3 : parseFloat(config.rozbeh);
    this.fn             = sanitizeFilename(this.nazev);
  }

  /**
   * Generuje G-code pro offset `ofs` (0 pro _a, sirka_zubku pro _b)
   * @param {number} ofs
   * @returns {{ gcode: string, paths: Array<{x:number, y:number, z:number, rapid:boolean}>, doba_s: number }}
   */
  generovat(ofs = 0) {
    this.lines = [];
    this.paths = [];
    // Sledujeme aktuální pozici frézy pro doplnění chybějících os
    this._cx = 0;
    this._cy = 0;
    this._cz = SAFE_Z;
    this._zacatek = true;

    let n = 0;
    while (true) {
      this._zubok(n * this.sirka_zubku + ofs);
      this._zacatek = false;
      n += 2;
      if ((n * this.sirka_zubku + ofs) >= this.sirka_prkna) break;
    }

    this._wr(`G00 Z${SAFE_Z}`);
    this._move(this._cx, this._cy, SAFE_Z, true);
    this._wr('G00 X0 Y0');
    this._move(0, 0, SAFE_Z, true);
    this._wr('M05   (zastaveni frezy)');
    this._wr('M30   (konec programu)');

    // Hlavička se skládá až teď — obsahuje odhad doby spočítaný z hotové dráhy
    const doba = this._odhadDoby();

    return {
      gcode:  [...this._hlavicka(doba), ...this.lines].join('\n'),
      paths:  this.paths,
      doba_s: doba,
    };
  }

  /**
   * Generuje oba soubory najednou
   * @returns {{ fn: string, a: { gcode: string, paths: Array }, b: { gcode: string, paths: Array }, meta: object }}
   */
  generate() {
    const a = this.generovat(0);
    const b = this.generovat(this.sirka_zubku);

    return {
      fn:   this.fn,
      a,
      b,
      meta: {
        typ:            'zubok',
        sirka_prkna:    this.sirka_prkna,
        tloustka_prkna: this.tloustka_prkna,
        hloubka_zubu:   this.hloubka_zubu,
        sirka_zubku:    this.sirka_zubku,
        freza:          this.d,
        r:              this.r,
        doba_a_s:       a.doba_s,
        doba_b_s:       b.doba_s,
        // Kvádr prkna pro 3D náhled (souřadnice G-code)
        // Nulový bod = místo dotyku OKRAJE frézy, materiál tedy začíná na X=r a Y=r
        board: {
          x0: this.r, x1: this.r + this.sirka_prkna,
          y0: this.r, y1: this.r + this.tloustka_prkna,
          z0: -this.hloubka_zubu, z1: 0,
        },
      },
    };
  }

  // --- private helpers ---

  _wr(s = '') {
    this.lines.push(s);
  }

  /**
   * Úvodní řádky programu. Vřeteno se roztočí a G04 počká na náběh otáček,
   * teprve pak přijde první pohyb.
   * @param {number} doba  odhad doby v sekundách (do komentáře)
   * @returns {string[]}
   */
  _hlavicka(doba) {
    return [
      `(zubok ${this.fn})`,
      `(sirka zubu ${this.sirka_zubku})`,
      `(tloustka prkna ${this.tloustka_prkna})`,
      `(pocet zubu ${this.pocet_zubu})`,
      `(hloubka zubu ${this.hloubka_zubu})`,
      `(freza ${this.d})`,
      `(krok vnoreni ${this.krok_vnoreni})`,
      `(posuv ${this.posuv})`,
      `(odhadovana doba ${formatDoba(doba)} - bez zrychleni stroje)`,
      '',
      'G90   (absolutni souradnice)',
      'G21   (milimetry)',
      'M03 S24000   (spusteni pravych otacek vretene)',
      `G04 P${fmt(this.rozbeh)}   (cekani na nabehnuti otacek)`,
      `F${fmt(this.posuv)}   (posuv mm/min)`,
    ];
  }

  /**
   * Odhad doby programu v sekundách — rozběh vřetene plus dráha / posuv.
   * Fréza startuje v nule v bezpečné výšce.
   * @returns {number}
   */
  _odhadDoby() {
    return odhadDoby(this.paths, {
      posuv:  this.posuv,
      rozbeh: this.rozbeh,
      start:  { x: 0, y: 0, z: SAFE_Z },
    });
  }

  /**
   * Zaznamená pohyb — vždy doplní chybějící osy z aktuální pozice
   * @param {number|undefined} x
   * @param {number|undefined} y
   * @param {number|undefined} z
   * @param {boolean} rapid
   */
  _move(x, y, z, rapid = false) {
    const nx = x !== undefined ? x : this._cx;
    const ny = y !== undefined ? y : this._cy;
    const nz = z !== undefined ? z : this._cz;
    this._cx = nx;
    this._cy = ny;
    this._cz = nz;
    this.paths.push({ x: nx, y: ny, z: nz, rapid });
  }

  _zubok(x) {
    const leve_drveni = this._zacatek ? 0 : this.drveni;

    this._wr(`G00 X${fmt(x + this.d + leve_drveni)} Y0 Z${SAFE_Z}`);
    this._move(x + this.d + leve_drveni, 0, SAFE_Z, true);

    // tolerance proti hromadění chyby u desetinného kroku (běžný případ)
    const eps = 1e-9;
    let z = -this.krok_vnoreni;
    while (z > -this.hloubka_zubu + eps) {
      this._vrstva(x, z, leve_drveni);
      z -= this.krok_vnoreni;
    }
    // poslední vrstvu vždy dofrézovat přesně na plnou hloubku
    // (cyklus nikdy nedojede přesně na -hloubka_zubu; eps brání duplicitní vrstvě)
    this._vrstva(x, -this.hloubka_zubu, leve_drveni);

    this._wr(`G00 Z${SAFE_Z}`);
    this._move(this._cx, this._cy, SAFE_Z, true);
    this._wr('(-------------------)');
  }

  _vrstva(x, z, leve_drveni) {
    this._wr(` (vrstva ${z})`);
    this._wr(`G01 Z${fmt(z)}`);
    this._move(undefined, undefined, z, false);

    // Středy frézy u stěn drážky a na lících prkna
    const xL   = x + this.d + leve_drveni;
    const xR   = x + this.sirka_zubku - this.drveni;
    const yBot = this.r;
    const yTop = this.tloustka_prkna + this.r;

    // Obrys: levá stěna nahoru, přes horní líc, pravá stěna dolů
    // (s pravotočivým vřetenem jsou obě stěny frézované sousledně)
    this._wr(`G01 Y${fmt(yTop)}`);
    this._move(undefined, yTop, undefined);

    this._wr(`G01 X${fmt(xR)}`);
    this._move(xR, undefined, undefined);

    this._wr(`G01 Y${fmt(yBot)}`);
    this._move(undefined, yBot, undefined);

    // Zbytek mezi stěnami rovnoměrně rozdělený na průjezdy skrz celou tloušťku
    // (drážka je z obou líců otevřená, spirála v Y není potřeba).
    // Rozestup nejvýš d − 0.1, aby mezi průjezdy nezůstal hřebínek.
    const max_krok = this.d - 0.1;
    const eps      = 1e-9;
    const mezery   = Math.max(1, Math.ceil((xR - xL) / max_krok - eps));
    const krok     = (xR - xL) / mezery;
    let y = yBot;
    for (let i = 1; i < mezery; i++) {
      const xi = xR - i * krok;
      y = y === yBot ? yTop : yBot;

      this._wr(`G01 X${fmt(xi)}   (pruchod ${i})`);
      this._move(xi, undefined, undefined);

      this._wr(`G01 Y${fmt(y)}`);
      this._move(undefined, y, undefined);
    }

    this._wr(`G01 X${fmt(xL)} Y0`);
    this._move(xL, 0, undefined);
  }
}

module.exports = { Zubok, sanitizeFilename };
