'use strict';

const path      = require('path');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { Zubok }  = require('./zubok');
const { Schody } = require('./schody');

const app  = express();
const PORT = process.env.PORT || 3020;

// ── Security headers ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],  // Vite SPA potřebuje inline
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      workerSrc:  ["'self'", 'blob:'],
    },
  },
}));

// ── CORS — pouze same-origin (SPA je na stejném portu) ────────────
// Na VPS není potřeba CORS vůbec, SPA i API jsou na stejném origin.
// Cors middleware vypnut — browser to nevyžaduje.

// ── Body limit ────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Rate limiting ─────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minuta
  max: 30,               // max 30 requestů / minutu / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Příliš mnoho požadavků, zkuste to za chvíli.' },
});
app.use('/api/', apiLimiter);

// ── Statické soubory ──────────────────────────────────────────────
const DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(DIST));

// ── Generátory + validace parametrů ───────────────────────────────
const GENERATORY = {
  zubok: {
    Klass: Zubok,
    rules: {
      nazev:          { type: 'string', maxLen: 128 },
      tloustka_prkna: { min: 0.1,  max: 500  },
      sirka_prkna:    { min: 1,    max: 2000 },
      pocet_zubu:     { min: 1,    max: 500,  integer: true },
      hloubka_zubu:   { min: 0.1,  max: 200  },
      freza:          { min: 0.1,  max: 100  },
      krok_vnoreni:   { min: 0.01, max: 50   },
      drveni:         { min: -1,   max: 1    },
      posuv:          { min: 1,    max: 10000 },
    },
  },
  schody: {
    Klass: Schody,
    rules: {
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
  },
};

function validateParams(body, rules) {
  const errors = [];
  for (const [key, rule] of Object.entries(rules)) {
    const val = body[key];
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
    if (!isFinite(n) || isNaN(n))          { errors.push(`${key}: neplatná hodnota`); continue; }
    if (n < rule.min)                       { errors.push(`${key}: minimum je ${rule.min}`); }
    if (n > rule.max)                       { errors.push(`${key}: maximum je ${rule.max}`); }
    if (rule.integer && !Number.isInteger(n)) { errors.push(`${key}: musí být celé číslo`); }
  }
  return errors;
}

/**
 * POST /api/generate/:typ  (zubok | schody)
 * POST /api/generate       — zpětná kompatibilita, výchozí typ zubok
 */
function handleGenerate(typ, req, res) {
  try {
    const gen = GENERATORY[typ];
    if (!gen) {
      return res.status(404).json({ error: `Neznámý typ generátoru: ${typ}` });
    }

    const config = req.body;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ error: 'Neplatné tělo požadavku.' });
    }

    const errors = validateParams(config, gen.rules);
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const result = new gen.Klass(config).generate();

    res.json({
      fn:      result.fn,
      gcode_a: result.a.gcode,
      gcode_b: result.b.gcode,
      paths_a: result.a.paths,
      paths_b: result.b.paths,
      meta:    result.meta,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chyba při generování.' }); // neodesílat stack trace
  }
}

app.post('/api/generate',      (req, res) => handleGenerate('zubok', req, res));
app.post('/api/generate/:typ', (req, res) => handleGenerate(req.params.typ, req, res));

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// SPA fallback
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Zubok běží na http://localhost:${PORT}`);
});
