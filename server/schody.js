/**
 * schody.js — generátor G-code pro schodový (stupňovitý) pokosový spoj
 *
 * GEOMETRIE
 * ─────────
 * Dvě prkna se spojují kolmo na sebe. Klasický pokos je rovina pod 45°,
 * tady je nahrazena "schodištěm" ze čtvercových stupňů o straně
 *     s = tloustka_prkna / pocet_schodu
 * Schody zvětšují lepenou plochu a spoj se sám polohuje.
 *
 * Řez prknem (Y = vzdálenost od hrany, Z = hloubka od frézované plochy):
 *
 *      Y:  0────s───2s───3s───4s          (tloustka = 4s)
 *          ┌────┐
 *      A   │    └────┐                    prkno A: hloubka schodu i = t-(i-1)s
 *          │         └────┐               → 1. schod jde SKRZ (ostří pokosu)
 *          │              └────┐
 *          └╌╌╌╌ prořez skrz
 *
 *          ┌────┐
 *      B   │    └────┐                    prkno B: hloubka schodu i = t-i*s
 *          │         └────┐               → poslední schod se nefrézuje
 *          └──────────────┘
 *
 * Prkna A a B jsou posunutá o jeden schod — jinak by do sebe nezapadla.
 * Ověřeno rozkladem rohového čtverce na buňky s×s: A si bere buňky (i>j),
 * B buňky (i<=j) — dohromady přesně celý čtverec, bez překryvu a bez mezery.
 *
 * FRÉZOVÁNÍ
 * ─────────
 * Prkno leží na ležato pohledovou (vnější) stranou DOLŮ, frézuje se z vnitřní
 * strany. X je podélná osa spoje, Y jde napříč prknem, Z se prohlubuje jen
 * v rámci tloušťky (nejhlubší schod = celá tloušťka, tedy prořez skrz).
 *
 * Nulování stejné jako u zubok — fréza se ručně dojede na okraj materiálu,
 * takže se nula hledá snadno a materiál začíná o poloměr frézy dál:
 * v X od r do delka_spoje+r, v Y od r. Z0 je povrch.
 * Schody se frézují od nejmělčího (nejdál od hrany) k nejhlubšímu, aby
 * odřezek u hrany držel co nejdéle. Materiál se odebírá klikatě (sem a tam)
 * podél celé délky spoje, s postupným zanořováním po krok_vnoreni.
 */

'use strict';

const { sanitizeFilename, fmt } = require('./util');

const SAFE_Z      = 4;     // bezpečná výška nad povrchem (mm)
const PRUREZ_SKRZ = 0.2;   // přejezd pod dno u prořezu skrz (mm)
const PREKRYV     = 0.6;   // krok do strany jako podíl průměru frézy
const EPS         = 1e-9;

class Schody {
  /**
   * @param {object} config
   * @param {string} config.nazev
   * @param {number} config.tloustka_prkna  tloušťka materiálu (mm)
   * @param {number} config.delka_spoje     délka celého boku prkna (mm)
   * @param {number} config.pocet_schodu    počet stupňů přes tloušťku
   * @param {number} config.freza           průměr stopkové frézy (mm)
   * @param {number} config.krok_vnoreni    hloubka záběru na průjezd (mm)
   * @param {number} config.vule            přídavek na stěnu schodu (mm)
   * @param {number} config.posuv           posuv (mm/min)
   * @param {number} config.rozbeh          čekání na náběh otáček (s)
   */
  constructor(config) {
    this.nazev          = config.nazev ?? 'schody';
    this.tloustka_prkna = parseFloat(config.tloustka_prkna) || 12;
    this.delka_spoje    = parseFloat(config.delka_spoje)    || 100;
    this.pocet_schodu   = Math.max(1, Math.round(parseFloat(config.pocet_schodu) || 4));
    this.d              = parseFloat(config.freza)          || 4;
    this.r              = this.d / 2;
    this.krok_vnoreni   = parseFloat(config.krok_vnoreni)   || 1;
    this.vule           = Number.isNaN(parseFloat(config.vule)) ? 0 : parseFloat(config.vule);
    this.posuv          = parseFloat(config.posuv)          || 300;
    this.rozbeh         = Number.isNaN(parseFloat(config.rozbeh)) ? 3 : parseFloat(config.rozbeh);

    this.velikost_schodu = this.tloustka_prkna / this.pocet_schodu;
    this.fn              = sanitizeFilename(this.nazev);
  }

  /**
   * Rozpis schodů pro variantu.
   * Vůle posouvá svislou stěnu o +vule (ven, do materiálu) a dno o +vule
   * hlouběji — obě protilehlé plochy tedy uvolní spoj o 2× vůli.
   * @param {'a'|'b'} varianta
   * @returns {Array<{i:number, y0:number, y1:number, hloubka:number, skrz:boolean}>}
   */
  schody(varianta) {
    const s = this.velikost_schodu;
    const t = this.tloustka_prkna;
    const v = this.vule;
    const h = this.r;   // hrana materiálu leží o poloměr frézy od nuly
    const out = [];

    for (let i = 1; i <= this.pocet_schodu; i++) {
      // ideální (nulová vůle) hloubka schodu; A je o jeden schod hlubší než B
      const zaklad = varianta === 'b' ? t - i * s : t - (i - 1) * s;
      if (zaklad <= EPS) continue;                    // u B poslední schod odpadá

      const skrz = zaklad >= t - EPS;                 // ostří pokosu = řez skrz
      out.push({
        i,
        y0:      h + (i === 1 ? 0 : (i - 1) * s + v), // u hrany se vůle neuplatní
        y1:      h + i * s + v,
        hloubka: skrz ? t + PRUREZ_SKRZ : zaklad + v,
        skrz,
      });
    }
    return out;
  }

  /**
   * Obrys řezu zbylým materiálem — uzavřená lomená čára pro 3D náhled.
   * @param {'a'|'b'} varianta
   * @returns {Array<{y:number, z:number}>}
   */
  profil(varianta) {
    const t     = this.tloustka_prkna;
    const kroky = this.schody(varianta);
    const konec = (kroky.length ? kroky[kroky.length - 1].y1 : this.r) + this.velikost_schodu;

    const pts = [{ y: this.r, z: -t }];
    for (const sch of kroky) {
      const z = -Math.min(sch.hloubka, t);   // prořez skrz kreslíme jen po dno
      pts.push({ y: sch.y0, z });
      pts.push({ y: sch.y1, z });
    }
    pts.push({ y: pts[pts.length - 1].y, z: 0 });  // stoupání na povrch
    pts.push({ y: konec, z: 0 });                  // zbytek prkna
    pts.push({ y: konec, z: -t });
    pts.push({ y: this.r, z: -t });
    return pts;
  }

  /**
   * Generuje program pro jednu variantu prkna
   * @param {'a'|'b'} varianta
   * @returns {{ gcode: string, paths: Array<{x:number,y:number,z:number,rapid:boolean}> }}
   */
  generovat(varianta = 'a') {
    this.lines = [];
    this.paths = [];
    this._cx = 0;
    this._cy = 0;
    this._cz = SAFE_Z;

    // materiál leží v X od r do delka_spoje + r, fréza musí oba konce přejet
    const x0 = 0;
    const x1 = this.delka_spoje + 2 * this.r;

    this._hlavicka(varianta);

    // od nejmělčího schodu (nejdál od hrany) k nejhlubšímu u hrany
    const kroky = this.schody(varianta);
    let smerX = 1;
    for (let k = kroky.length - 1; k >= 0; k--) {
      smerX = this._schod(kroky[k], x0, x1, smerX);
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
   * Generuje oba programy najednou
   * @returns {{fn:string, a:object, b:object, meta:object}}
   */
  generate() {
    const t = this.tloustka_prkna;
    return {
      fn:   this.fn,
      a:    this.generovat('a'),
      b:    this.generovat('b'),
      meta: {
        typ:             'schody',
        tloustka_prkna:  t,
        delka_spoje:     this.delka_spoje,
        pocet_schodu:    this.pocet_schodu,
        velikost_schodu: this.velikost_schodu,
        vule:            this.vule,
        freza:           this.d,
        r:               this.r,
        board: {
          x0: this.r,   x1: this.r + this.delka_spoje,
          y0: this.r,   y1: this.r + t * 1.5 + this.vule,
          z0: -t,       z1: 0,
        },
        profil_a: this.profil('a'),
        profil_b: this.profil('b'),
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

  _hlavicka(varianta) {
    const V = varianta === 'b' ? 'B' : 'A';
    this._wr(`(schody ${this.fn} - prkno ${V})`);
    this._wr(`(tloustka prkna ${this.tloustka_prkna})`);
    this._wr(`(delka spoje ${this.delka_spoje})`);
    this._wr(`(pocet schodu ${this.pocet_schodu})`);
    this._wr(`(velikost schodu ${fmt(this.velikost_schodu)})`);
    this._wr(`(freza ${this.d})`);
    this._wr(`(krok vnoreni ${this.krok_vnoreni})`);
    this._wr(`(vule ${this.vule})`);
    this._wr(`(posuv ${this.posuv})`);
    this._wr('');
    this._wr('(nulovani jako u zubok: freza se dotkne cela i hrany prkna, Z0 = povrch)');
    this._wr(`(material tedy zacina na X${fmt(this.r)} Y${fmt(this.r)} - o polomer frezy)`);
    this._wr('(prkno lezi na lezato pohledovou strankou DOLU, frezuje se z vnitrni strany)');
    if (varianta !== 'b') {
      this._wr('(POZOR: nejhlubsi schod u hrany rezze SKRZ - nutna obetni deska)');
    }
    this._wr('');
    this._wr('G90   (absolutni souradnice)');
    this._wr('G21   (milimetry)');
    this._wr(`G00 Z${SAFE_Z}`);
    this._move(0, 0, SAFE_Z, true);
    this._wr('M03 S24000   (spusteni pravych otacek vretene)');
    this._wr(`G04 P${fmt(this.rozbeh)}   (cekani na nabehnuti otacek)`);
    this._wr(`F${fmt(this.posuv)}   (posuv mm/min)`);
  }

  /**
   * Y-souřadnice středu frézy pro jeden schod.
   * Poslední průjezd dojíždí přesně na stěnu schodu (y1 - r) — čistá stěna
   * se tak frézuje až nakonec.
   * @returns {number[]}
   */
  _prujezdy(sch) {
    const cmax = sch.y1 - this.r;              // stěna schodu
    const cmin = Math.min(sch.y0, cmax);       // fréza smí přesahovat do už odebrané strany
    const krok = Math.max(this.d * PREKRYV, 0.1);
    const n    = (cmax - cmin) > EPS ? Math.ceil((cmax - cmin) / krok) + 1 : 1;

    const ys = [];
    for (let i = 0; i < n; i++) {
      ys.push(n === 1 ? cmax : cmin + ((cmax - cmin) * i) / (n - 1));
    }
    return ys;
  }

  /** Hloubky jednotlivých vrstev (kladná čísla) */
  _hladiny(hloubka) {
    const out = [];
    for (let z = this.krok_vnoreni; z < hloubka - EPS; z += this.krok_vnoreni) out.push(z);
    out.push(hloubka);   // poslední vrstva vždy přesně na plnou hloubku
    return out;
  }

  /**
   * Vyfrézuje jeden schod klikatým pohybem sem a tam
   * @returns {number} směr v ose X pro navazující schod
   */
  _schod(sch, x0, x1, smerX) {
    const ys      = this._prujezdy(sch);
    const hladiny = this._hladiny(sch.hloubka);

    this._wr('');
    this._wr(`(schod ${sch.i}: Y ${fmt(sch.y0)}..${fmt(sch.y1)}, hloubka ${fmt(sch.hloubka)}${sch.skrz ? ' - PROREZ SKRZ' : ''})`);
    this._wr(`(prujezdu ${ys.length}, vrstev ${hladiny.length})`);

    // najetí mimo materiál — zanořuje se vždy ve vzduchu za koncem prkna
    const xStart = smerX > 0 ? x0 : x1;
    this._wr(`G00 X${fmt(xStart)} Y${fmt(ys[0])}`);
    this._move(xStart, ys[0], undefined, true);

    let iy   = 0;
    let smerY = 1;
    for (const h of hladiny) {
      this._wr(` (vrstva Z${fmt(-h)})`);
      this._wr(`G01 Z${fmt(-h)}`);
      this._move(undefined, undefined, -h, false);

      for (let p = 0; p < ys.length; p++) {
        const cil = smerX > 0 ? x1 : x0;
        this._wr(`G01 X${fmt(cil)}`);
        this._move(cil, undefined, undefined, false);
        smerX = -smerX;

        if (p < ys.length - 1) {
          iy += smerY;
          this._wr(`G01 Y${fmt(ys[iy])}`);
          this._move(undefined, ys[iy], undefined, false);
        }
      }
      smerY = -smerY;   // další vrstva se klikatí zpátky
    }

    this._wr(`G00 Z${SAFE_Z}`);
    this._move(undefined, undefined, SAFE_Z, true);
    return smerX;
  }
}

module.exports = { Schody };
