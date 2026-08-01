/**
 * Konfigurace generátoru "schody" — schodový pokosový spoj
 *
 * Prkénko je na hraně zkoseno pod 45°, ale ne rovinou — po schodech
 * o straně tloustka_prkna / pocet_schodu. Dvě prkna se pak slepí kolmo
 * na sebe a schody zvětší lepenou plochu i samopolohování spoje.
 */
export default {
  key:      'schody',
  label:    'Schody',
  popis:    'schodový pokosový spoj',
  endpoint: '/api/generate/schody',

  defaults: {
    nazev:          'schodovy spoj',
    tloustka_prkna: 12,
    delka_spoje:    100,
    pocet_schodu:   4,
    freza:          4,
    krok_vnoreni:   1,
    vule:           0.05,
    posuv:          300,
    rozbeh:         3,
  },

  fields: [
    {
      key: 'nazev',
      label: 'Název',
      type: 'text',
      step: undefined,
      min: undefined,
      placeholder: 'schodovy spoj',
      hint: 'Použije se jako název souboru',
      fullWidth: true,
    },
    {
      key: 'tloustka_prkna',
      label: 'Tloušťka prkénka',
      unit: 'mm',
      step: 0.1,
      min: 1,
      placeholder: '12',
      hint: 'Z tloušťky vychází velikost i počet schodů',
    },
    {
      key: 'delka_spoje',
      label: 'Délka spoje',
      unit: 'mm',
      step: 0.1,
      min: 1,
      placeholder: '100',
      hint: 'Celý bok prkénka',
    },
    {
      key: 'pocet_schodu',
      label: 'Počet schodů',
      step: 1,
      min: 2,
      max: 100,
      placeholder: '4',
      hint: 'Předvyplněno z tloušťky, lze přepsat',
      // ~3 mm na schod, dokud to uživatel nepřepíše
      auto: (p) => {
        const t = parseFloat(p.tloustka_prkna);
        if (!t || !isFinite(t)) return undefined;
        return Math.min(20, Math.max(2, Math.round(t / 3)));
      },
    },
    {
      key: 'freza',
      label: 'Průměr frézy',
      unit: 'mm',
      step: 0.1,
      placeholder: '4',
      hint: 'Průměr stopkové frézy',
    },
    {
      key: 'krok_vnoreni',
      label: 'Krok vnoření',
      unit: 'mm',
      step: 0.1,
      placeholder: '1',
      hint: 'Hloubka záběru na jeden průjezd',
    },
    {
      key: 'vule',
      label: 'Vůle (úběr navíc)',
      unit: 'mm',
      step: 0.01,
      min: -1,
      max: 2,
      placeholder: '0.05',
      hint: 'Přídavek na každou stěnu schodu — tvrdší dřevo snese méně. Ve spoji se projeví dvojnásobně.',
    },
    {
      key: 'posuv',
      label: 'Rychlost posuvu',
      unit: 'mm/min',
      step: 1,
      min: 1,
      placeholder: '300',
      hint: 'Posuv frézy (F v G-code)',
    },
    {
      key: 'rozbeh',
      label: 'Rozběh vřetene',
      unit: 's',
      step: 0.5,
      min: 0,
      max: 60,
      placeholder: '3',
      hint: 'Čekání na náběh otáček (G04) před prvním řezem',
    },
  ],

  info(p) {
    const t = parseFloat(p.tloustka_prkna);
    const n = parseFloat(p.pocet_schodu);
    if (!t || !n) return [];
    return [
      { label: 'Velikost schodu', value: `${(t / n).toFixed(3)} mm` },
      { label: 'Nejhlubší řez',   value: `${t.toFixed(1)} mm (prořez skrz)` },
    ];
  },
};
