/**
 * proporce.js — proporční systémy pro návrh rozměrů
 *
 * Není to generátor G-code, jen počítadlo: zadáš jeden rozměr a ostatní
 * dopočítá podle zvoleného poměru.
 *
 * DVA ZPŮSOBY, JAK Z POMĚRU UDĚLAT TŘI ROZMĚRY
 * ────────────────────────────────────────────
 * 1) MOCNINY (řada) — každý rozměr je násobek předchozího:
 *        a : a·r : a·r²
 *    Mocnina u každého rozměru se dá nastavit zvlášť, takže podlouhlá
 *    krabička = delší strana s mocninou 2 místo 1. Tohle je způsob, jakým
 *    se zlatý řez používá dodnes.
 *
 * 2) STŘEDY (Alberti, Palladio) — třetí rozměr je "průměr" dvou zbylých.
 *    Leon Battista Alberti v De re aedificatoria (1452) odvozuje výšku
 *    místnosti z délky a šířky jedním ze tří pythagorejských středů.
 *    Palladio je v Quattro libri (1570) používá stejně. Pro krabičku to
 *    funguje doslova stejně jako pro sál.
 */

/** Plastické číslo — reálný kořen x³ = x + 1 */
const PSI = 1.324717957244746;
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Proporční systémy. `pomer` je vždy číslo > 1, kterým se násobí.
 * `puvod` je poznámka odkud to pochází — ať je vidět, co je doopravdy
 * středověké a co se tak jen tváří.
 */
export const SYSTEMY = [
  {
    key:   'zlaty',
    label: 'Zlatý řez (φ)',
    pomer: PHI,
    zapis: '1 : 1,618',
    puvod: 'Eukleidés jako „dělení krajním a středním poměrem“; Fibonacci 1202 přináší řadu, ' +
           'Pacioli ji roku 1509 v De divina proportione pojmenuje božskou. Ve středověkém ' +
           'stavitelství je doložený hůř, než se běžně tvrdí — tesařské a zednické hutě počítaly spíš s odmocninami.',
  },
  {
    key:   'kvadratum',
    label: 'Ad quadratum (√2)',
    pomer: Math.SQRT2,
    zapis: '1 : 1,414',
    puvod: 'Úhlopříčka čtverce. Nejrozšířenější skutečně středověký postup — ' +
           'ze čtverce se otáčením dostane další čtverec a řada 1, √2, 2, 2√2… ' +
           'Stačí na to provázek, žádné počítání. Zná ho Villard de Honnecourt (kolem 1230).',
  },
  {
    key:   'triangulum',
    label: 'Ad triangulum (√3)',
    pomer: Math.sqrt(3),
    zapis: '1 : 1,732',
    puvod: 'Odvozeno z rovnostranného trojúhelníku. Roku 1392 se kvůli volbě mezi ' +
           'ad quadratum a ad triangulum pohádali stavitelé milánského dómu — ' +
           'spor je zapsaný a je to nejlepší přímý doklad, že hutě takhle opravdu uvažovaly.',
  },
  {
    key:   'odmocnina5',
    label: 'Odmocnina z 5 (√5)',
    pomer: Math.sqrt(5),
    zapis: '1 : 2,236',
    puvod: 'Úhlopříčka dvojčtverce; souvisí se zlatým řezem (√5 = 2φ − 1). ' +
           'Protáhlý formát pro věci výrazně delší než široké.',
  },
  {
    key:   'oktava',
    label: 'Oktáva (1 : 2)',
    pomer: 2,
    zapis: '1 : 2',
    puvod: 'Hudební poměr. Boëthius předal středověku pythagorejskou nauku, ' +
           'že souzvuk čísel je týž v tónech i v rozměrech — proto se stavělo ' +
           'v celých číslech. Alberti tyhle poměry pro místnosti předepisuje přímo.',
  },
  {
    key:   'kvinta',
    label: 'Kvinta (2 : 3)',
    pomer: 3 / 2,
    zapis: '2 : 3',
    puvod: 'Diapente. Z Albertiho a Palladiova seznamu doporučených poměrů — ' +
           'klidnější a „zabydlenější“ než zlatý řez.',
  },
  {
    key:   'kvarta',
    label: 'Kvarta (3 : 4)',
    pomer: 4 / 3,
    zapis: '3 : 4',
    puvod: 'Diatessaron. Nejkrotší z hudebních poměrů, blízko čtverci.',
  },
  {
    key:   'sexta',
    label: 'Sexta (3 : 5)',
    pomer: 5 / 3,
    zapis: '3 : 5',
    puvod: 'Celočíselná náhrada zlatého řezu — 5/3 = 1,667 se od φ liší o 3 %. ' +
           'Sousedé z Fibonacciho řady (3, 5, 8, 13) dávají poměry, které se k φ blíží ' +
           'a přitom se dají odměřit metrem.',
  },
  {
    key:   'plasticke',
    label: 'Plastické číslo (ψ)',
    pomer: PSI,
    zapis: '1 : 1,325',
    puvod: 'Dom Hans van der Laan, benediktin, 1928–1960 — tedy ne středověk, ale klášter. ' +
           'Kořen rovnice x³ = x + 1. Tvrdil, že to je nejmenší rozdíl velikostí, který oko ' +
           'ještě spolehlivě rozezná, a stavěl podle toho. Na malé předměty sedí lépe než φ, ' +
           'protože řada roste pomaleji a rozměry zůstanou pohromadě.',
  },
];

/** @param {string} key @returns {object} */
export function system(key) {
  return SYSTEMY.find(s => s.key === key) ?? SYSTEMY[0];
}

export const STREDY = [
  {
    key:   'aritmeticky',
    label: 'Aritmetický',
    vzorec: '(a + c) / 2',
    fn:    (a, c) => (a + c) / 2,
    popis: 'Prostřední hodnota. Nejvyšší ze tří středů — dá nejvyšší krabičku.',
  },
  {
    key:   'geometricky',
    label: 'Geometrický',
    vzorec: '√(a · c)',
    fn:    (a, c) => Math.sqrt(a * c),
    popis: 'Stejný poměr k oběma stranám (a : b = b : c). Leží mezi zbylými dvěma středy.',
  },
  {
    key:   'harmonicky',
    label: 'Harmonický',
    vzorec: '2ac / (a + c)',
    fn:    (a, c) => (a + c) === 0 ? 0 : (2 * a * c) / (a + c),
    popis: 'Střed hudebních intervalů. Nejnižší ze tří — nejpodsaditější tvar.',
  },
];

/** @param {string} key @returns {object} */
export function stred(key) {
  return STREDY.find(s => s.key === key) ?? STREDY[1];
}

/**
 * Režim MOCNINY: rozměry jsou r^e, škálované tak, aby rozměr `kotva`
 * měl přesně hodnotu `hodnota`.
 *
 * @param {number} pomer      poměr systému (> 1)
 * @param {number[]} mocniny  mocnina pro každý rozměr, např. [0, 1, 2]
 * @param {number} kotva      index rozměru, který uživatel zadal
 * @param {number} hodnota    jeho hodnota
 * @returns {number[]} všechny rozměry
 */
export function dopocitejMocniny(pomer, mocniny, kotva, hodnota) {
  const zaklad = hodnota / Math.pow(pomer, mocniny[kotva]);
  return mocniny.map(e => zaklad * Math.pow(pomer, e));
}

/**
 * Režim STŘEDY: dva rozměry jsou zadané, třetí je jejich střed.
 *
 * @param {object} stredDef   položka ze STREDY
 * @param {number[]} rozmery  aktuální hodnoty [a, b, c]
 * @param {number} odvozeny   index dopočítávaného rozměru
 * @returns {number[]}
 */
export function dopocitejStred(stredDef, rozmery, odvozeny) {
  const zbyle = rozmery.filter((_, i) => i !== odvozeny);
  const out   = [...rozmery];
  out[odvozeny] = stredDef.fn(zbyle[0], zbyle[1]);
  return out;
}

/**
 * Zaokrouhlení na zvolený krok (0 = bez zaokrouhlení).
 * Dřevo se řeže na milimetry, ne na setiny.
 */
export function zaokrouhli(n, krok) {
  if (!krok) return n;
  return Math.round(n / krok) * krok;
}

/** Hezký zápis čísla — nejvýš `des` desetinných míst, bez koncových nul */
export function cislo(n, des = 2) {
  if (!isFinite(n)) return '—';
  return parseFloat(n.toFixed(des)).toLocaleString('cs-CZ');
}

/**
 * Skutečné poměry mezi sousedními rozměry — kontrola, jak moc
 * zaokrouhlení rozhodilo ideál.
 * @param {number[]} r
 * @returns {number[]} [r1/r0, r2/r1]
 */
export function skutecnePomery(r) {
  const out = [];
  for (let i = 1; i < r.length; i++) out.push(r[i - 1] ? r[i] / r[i - 1] : NaN);
  return out;
}

/**
 * FIBONACCIHO ŘADA
 * ────────────────
 * Každý člen je součtem dvou předchozích. Podíl sousedů se blíží zlatému řezu
 * — střídavě zespoda a shora, a čím dál v řadě, tím přesněji:
 *
 *      2:3  = 1,500   −7,3 %
 *      3:5  = 1,667   +3,0 %
 *      5:8  = 1,600   −1,1 %
 *      8:13 = 1,625   +0,4 %
 *     13:21 = 1,615   −0,2 %
 *     21:34 = 1,619   +0,06 %
 *
 * Smysl pro dílnu: dostaneš celá čísla, která se dají odměřit metrem, a přitom
 * jsou prakticky ve zlatém řezu. Navíc řada konverguje k φ z JAKÉKOLIV počáteční
 * dvojice — takže si můžeš zvolit vlastní kulaté rozměry (30, 50 → 80, 130, 210)
 * a pořád jsi v poměru. Tohle je princip, na kterém stojí i Le Corbusierův
 * Modulor.
 */

/**
 * @param {number} a       první člen
 * @param {number} b       druhý člen
 * @param {number} pocet   kolik členů vygenerovat
 * @returns {number[]}
 */
export function fibRada(a, b, pocet = 14) {
  const out = [a, b];
  while (out.length < pocet) out.push(out[out.length - 1] + out[out.length - 2]);
  return out.slice(0, pocet);
}

/**
 * Index členu, který je nejblíž zadané hodnotě — pro „přichytávání“
 * ručně zadaného rozměru na řadu.
 * @param {number[]} rada
 * @param {number} hodnota
 * @returns {number}
 */
export function nejblizsiIndex(rada, hodnota) {
  let nej = 0;
  for (let i = 1; i < rada.length; i++) {
    if (Math.abs(rada[i] - hodnota) < Math.abs(rada[nej] - hodnota)) nej = i;
  }
  return nej;
}
