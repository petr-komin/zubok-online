/**
 * zubok.js — JS přepis logiky z zubok.rb
 * Generátor G-code pro frézování dřevěných zubů (box joint / finger joint)
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
    this.drveni         = parseFloat(config.drveni)         || 0.1;
    this.fn             = sanitizeFilename(this.nazev);
  }

  /**
   * Generuje G-code pro offset `ofs` (0 pro _a, sirka_zubku pro _b)
   * @param {number} ofs
   * @returns {{ gcode: string, paths: Array<{x:number, y:number, z:number, rapid:boolean}> }}
   */
  generovat(ofs = 0) {
    this.lines = [];
    this.paths = [];
    // Sledujeme aktuální pozici frézy pro doplnění chybějících os
    this._cx = 0;
    this._cy = 0;
    this._cz = 4;
    this._zacatek = true;

    this._wr(`(zubok ${this.fn})`);
    this._wr(`(sirka zubu ${this.sirka_zubku})`);
    this._wr(`(tloustka prkna ${this.tloustka_prkna})`);
    this._wr(`(pocet zubu ${this.pocet_zubu})`);
    this._wr(`(hloubka zubu ${this.hloubka_zubu})`);
    this._wr(`(freza ${this.d})`);
    this._wr(`(krok vnoreni ${this.krok_vnoreni})`);
    this._wr('');
    this._wr('G90');
    this._wr('M03 S24000 F300     (spuštění pravých otáček vřetene)');

    let n = 0;
    while (true) {
      this._zubok(n * this.sirka_zubku + ofs);
      this._zacatek = false;
      n += 2;
      if ((n * this.sirka_zubku + ofs) >= this.sirka_prkna) break;
    }

    this._wr('G00 Z4');
    this._move(this._cx, this._cy, 4, true);
    this._wr('G00 X0 Y0');
    this._move(0, 0, 4, true);
    this._wr('M05   (zastaveni frezy)');
    this._wr('M30   (konec programu)');

    return {
      gcode: this.lines.join('\n'),
      paths: this.paths,
    };
  }

  /**
   * Generuje oba soubory najednou
   * @returns {{ fn: string, a: { gcode: string, paths: Array }, b: { gcode: string, paths: Array }, meta: object }}
   */
  generate() {
    return {
      fn:   this.fn,
      a:    this.generovat(0),
      b:    this.generovat(this.sirka_zubku),
      meta: {
        sirka_prkna:    this.sirka_prkna,
        tloustka_prkna: this.tloustka_prkna,
        hloubka_zubu:   this.hloubka_zubu,
        sirka_zubku:    this.sirka_zubku,
        freza:          this.d,
        r:              this.r,
      },
    };
  }

  // --- private helpers ---

  _wr(s = '') {
    this.lines.push(s);
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

    this._wr(`G00 X${fmt(x + this.d + leve_drveni)} Y0 Z4`);
    this._move(x + this.d + leve_drveni, 0, 4, true);

    let z = -this.krok_vnoreni;
    while (z > -this.hloubka_zubu) {
      this._vrstva(x, z, leve_drveni);
      z -= this.krok_vnoreni;
    }
    if (z < -this.hloubka_zubu) {
      this._vrstva(x, -this.hloubka_zubu, leve_drveni);
    }

    this._wr('G00 Z4');
    this._move(this._cx, this._cy, 4, true);
    this._wr('(-------------------)');
  }

  _vrstva(x, z, leve_drveni) {
    let spirala = 0;
    this._wr(` (vrstva ${z})`);
    this._wr(`G01 Z${fmt(z)}`);
    this._move(undefined, undefined, z, false);

    let d   = this.d;
    let drv = this.drveni;

    if (this.sirka_zubku < 2 * this.d) {
      // Úzký zub — jednoduchý průjezd
      this._wr(`G01 Y${fmt(this.tloustka_prkna + this.r)}`);
      this._move(undefined, this.tloustka_prkna + this.r, undefined);

      this._wr(`G01 X${fmt(x + this.sirka_zubku - drv)}`);
      this._move(x + this.sirka_zubku - drv, undefined, undefined);

      this._wr(`G01 Y${fmt(this.r)}`);
      this._move(undefined, this.r, undefined);

      this._wr(`G01 X${fmt(x + this.d + leve_drveni)} Y0`);
      this._move(x + this.d + leve_drveni, 0, undefined);
    } else {
      // Spirálový průjezd
      while ((d + d * spirala) < this.sirka_zubku / 2) {
        this._wr(`G01 Y${fmt(this.tloustka_prkna - d * spirala + this.r)}`);
        this._move(undefined, this.tloustka_prkna - d * spirala + this.r, undefined);

        this._wr(`G01 X${fmt(x + this.sirka_zubku - d * spirala - drv)}`);
        this._move(x + this.sirka_zubku - d * spirala - drv, undefined, undefined);

        this._wr(`G01 Y${fmt(d * spirala + this.r)}`);
        this._move(undefined, d * spirala + this.r, undefined);

        spirala += 1;
        d = this.d - 0.1;

        this._wr(`G01 X${fmt(x + d + d * spirala)}   (spiral ${spirala}end)`);
        this._move(x + d + d * spirala, undefined, undefined);

        drv = 0;
      }

      this._wr(`G01 Y${fmt(this.tloustka_prkna - this.d * spirala + this.d)}`);
      this._move(undefined, this.tloustka_prkna - this.d * spirala + this.d, undefined);

      this._wr(`G01 X${fmt(x + this.d + leve_drveni)} Y0`);
      this._move(x + this.d + leve_drveni, 0, undefined);
    }
  }
}

module.exports = { Zubok, sanitizeFilename };
