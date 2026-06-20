'use strict';

const path      = require('path');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { Zubok } = require('./zubok');

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

// ── Validátor parametrů ───────────────────────────────────────────
const PARAM_RULES = {
  nazev:          { type: 'string', maxLen: 128 },
  tloustka_prkna: { min: 0.1,  max: 500  },
  sirka_prkna:    { min: 1,    max: 2000 },
  pocet_zubu:     { min: 1,    max: 500,  integer: true },
  hloubka_zubu:   { min: 0.1,  max: 200  },
  freza:          { min: 0.1,  max: 100  },
  krok_vnoreni:   { min: 0.01, max: 50   },
  drveni:         { min: -1,   max: 1    },
  posuv:          { min: 1,    max: 10000 },
};

function validateParams(body) {
  const errors = [];
  for (const [key, rule] of Object.entries(PARAM_RULES)) {
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
 * POST /api/generate
 */
app.post('/api/generate', (req, res) => {
  try {
    const config = req.body;

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ error: 'Neplatné tělo požadavku.' });
    }

    const errors = validateParams(config);
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const zubok  = new Zubok(config);
    const result = zubok.generate();

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
});

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
