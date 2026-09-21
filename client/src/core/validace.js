/**
 * validace.js — kontrola rozsahů parametrů
 *
 * Pravidla přenesená ze server/index.js. Na serveru chránila API před
 * nesmyslnými vstupy; tady drží uživatele v rozsahu, ve kterém generátory
 * dávají smysl (a ve kterém je stroj schopen dráhu ujet).
 */

export const PRAVIDLA = {
  zubok: {
    nazev:          { type: 'string', maxLen: 128 },
    tloustka_prkna: { min: 0.1,  max: 500  },
    sirka_prkna:    { min: 1,    max: 2000 },
    pocet_zubu:     { min: 1,    max: 500,  integer: true },
    hloubka_zubu:   { min: 0.1,  max: 200  },
    freza:          { min: 0.1,  max: 100  },
    krok_vnoreni:   { min: 0.01, max: 50   },
    drveni:         { min: -1,   max: 1    },
    posuv:          { min: 1,    max: 10000 },
    rozbeh:         { min: 0,    max: 60   },
  },
  schody: {
    nazev:          { type: 'string', maxLen: 128 },
    tloustka_prkna: { min: 1,    max: 500  },
    delka_spoje:    { min: 1,    max: 3000 },
    pocet_schodu:   { min: 2,    max: 100,  integer: true },
    freza:          { min: 0.1,  max: 100  },
    krok_vnoreni:   { min: 0.01, max: 50   },
    vule:           { min: -1,   max: 2    },
    posuv:          { min: 1,    max: 10000 },
    rozbeh:         { min: 0,    max: 60   },
  },
  valec: {
    nazev:           { type: 'string', maxLen: 128 },
    prumer_valce:    { min: 0.1,  max: 2000 },
    hloubka_vnoreni: { min: 0.1,  max: 200  },
    freza:           { min: 0.1,  max: 100  },
    krok_vnoreni:    { min: 0.01, max: 50   },
    posuv:           { min: 1,    max: 10000 },
    rozbeh:          { min: 0,    max: 60   },
  },
};

/**
 * @param {object} params
 * @param {object} rules
 * @returns {string[]} seznam chyb, prázdný když je vše v pořádku
 */
export function validuj(params, rules) {
  const errors = [];
  for (const [key, rule] of Object.entries(rules)) {
    const val = params[key];
    if (val === undefined || val === '') {
      errors.push(`Chybí pole: ${key}`);
      continue;
    }
    if (rule.type === 'string') {
      if (typeof val !== 'string') { errors.push(`${key}: musí být řetězec`); continue; }
      if (val.length > rule.maxLen) { errors.push(`${key}: příliš dlouhý (max ${rule.maxLen})`); }
      continue;
    }
    const n = parseFloat(val);
    if (!isFinite(n) || isNaN(n))             { errors.push(`${key}: neplatná hodnota`); continue; }
    if (n < rule.min)                         { errors.push(`${key}: minimum je ${rule.min}`); }
    if (n > rule.max)                         { errors.push(`${key}: maximum je ${rule.max}`); }
    if (rule.integer && !Number.isInteger(n)) { errors.push(`${key}: musí být celé číslo`); }
  }
  return errors;
}
