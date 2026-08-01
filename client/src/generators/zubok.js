/**
 * Konfigurace generátoru "zubok" — box joint / prstový spoj
 */
export default {
  key:      'zubok',
  label:    'Zubok',
  popis:    'box-joint (prstový spoj)',
  endpoint: '/api/generate/zubok',

  defaults: {
    nazev:          'jasanova krabicka',
    tloustka_prkna: 12,
    sirka_prkna:    28,
    pocet_zubu:     6,
    hloubka_zubu:   5,
    freza:          4,
    krok_vnoreni:   1,
    drveni:         0,
    posuv:          300,
  },

  fields: [
    {
      key: 'nazev',
      label: 'Název',
      type: 'text',
      step: undefined,
      min: undefined,
      placeholder: 'jasanova krabicka',
      hint: 'Použije se jako název souboru',
      fullWidth: true,
    },
    {
      key: 'tloustka_prkna',
      label: 'Tloušťka prkna',
      unit: 'mm',
      step: 0.1,
      placeholder: '12',
      hint: 'Tloušťka frézovaného materiálu',
    },
    {
      key: 'sirka_prkna',
      label: 'Šířka prkna',
      unit: 'mm',
      step: 0.1,
      placeholder: '28',
      hint: 'Celková šířka, z níž se počítá počet zubů',
    },
    {
      key: 'pocet_zubu',
      label: 'Počet zubů',
      step: 1,
      min: 1,
      placeholder: '6',
      hint: 'Musí být celé číslo',
    },
    {
      key: 'hloubka_zubu',
      label: 'Hloubka zubu',
      unit: 'mm',
      step: 0.1,
      placeholder: '5',
      hint: 'Jak hluboko frézuje zub',
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
      placeholder: '2',
      hint: 'Hloubka záběru na jeden průjezd',
    },
    {
      key: 'drveni',
      label: 'Drvení',
      unit: 'mm',
      step: 0.01,
      min: -1,
      max: 1,
      placeholder: '0',
      hint: 'Kladná hodnota = drážka užší (těsnější spoj), záporná = drážka širší (volnější spoj)',
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
  ],

  /** Dopočítané hodnoty zobrazené pod formulářem */
  info(p) {
    const s = parseFloat(p.sirka_prkna);
    const n = parseFloat(p.pocet_zubu);
    if (!s || !n) return [];
    return [{ label: 'Šířka zubku', value: `${(s / n).toFixed(3)} mm` }];
  },
};
