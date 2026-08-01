# Zubok Online

Webová aplikace pro generování CNC G-code pro frézování **dřevěných spojů**.
Generátory se přepínají záložkami:

| Záložka | Spoj |
|---------|------|
| **Zubok** | box-joint (prstový spoj) — přepis původního Ruby skriptu |
| **Schody** | schodový pokosový spoj — hrana zkosená po stupních místo roviny 45° |

Node.js/Vue 3 stack s 3D vizualizací dráhy frézy.

![screenshot](screenshot.png)
![Krabicky](krabicky.jpg)


## Funkce

- Zadání parametrů přes formulář, odvozené hodnoty se dopočítávají živě
- Import parametrů z `.yml` souboru
- Generování dvou G-code souborů (`_a.nc` a `_b.nc`) pro obě prkna spoje
- 3D vizualizace dráhy frézy v reálném čase (Three.js)
- Animace průjezdu frézy podél dráhy
- Čelní pohled na řez spojem pro kontrolu výsledného tvaru
- Stažení G-code přímo v prohlížeči

## Technologie

| Vrstva | Stack |
|--------|-------|
| Backend | Node.js, Express 5 |
| Frontend | Vue 3, Vite |
| 3D vizualizace | Three.js, OrbitControls |
| Bezpečnost | Helmet, express-rate-limit |

## Spuštění

### Vývoj

```bash
npm install
npm run dev
```

Frontend běží na `http://localhost:5173`, backend na `http://localhost:3000`.

### Produkce

```bash
npm run build
npm start
```

Aplikace běží na `http://localhost:3000` (Express servíruje i statické soubory).

## Parametry — Zubok

| Parametr | Popis |
|----------|-------|
| Název | Použije se jako název výstupního souboru |
| Tloušťka prkna | Tloušťka frézovaného materiálu (mm) |
| Šířka prkna | Celková šířka, z níž se počítá počet zubů (mm) |
| Počet zubů | Celé číslo |
| Hloubka zubu | Jak hluboko frézuje zub (mm) |
| Průměr frézy | Průměr stopkové frézy (mm) |
| Krok vnoření | Hloubka záběru na jeden průjezd (mm) |
| Drvení | Kladná = těsnější spoj, záporná = volnější spoj (mm) |

## Parametry — Schody

| Parametr | Popis |
|----------|-------|
| Název | Použije se jako název výstupního souboru |
| Tloušťka prkénka | Tloušťka materiálu; vychází z ní velikost schodu (mm) |
| Délka spoje | Celý bok prkénka (mm) |
| Počet schodů | Předvyplněno z tloušťky (~3 mm na schod), lze přepsat |
| Průměr frézy | Průměr stopkové frézy (mm) |
| Krok vnoření | Hloubka záběru na jeden průjezd (mm) |
| Vůle | Přídavek na každou stěnu schodu — kompenzace různých tvrdostí dřeva (mm) |
| Rychlost posuvu | F v G-code (mm/min) |
| Rozběh vřetene | Čekání na náběh otáček (G04) před prvním řezem (s) |

### Jak schodový spoj funguje

Prkénko je na hraně zkoseno o 45°, takže se slepí s druhým, kolmo postaveným
prkénkem. Zkosení ale není rovina — jde po stupních o straně
`s = tloušťka / počet schodů`. Schody zvětšují lepenou plochu a spoj se
při lepení sám polohuje.

```
 Y:  0────s───2s───3s───4s          (tloušťka = 4s)
     ┌────┐
  A  │    └────┐                    prkno A: hloubka schodu i = t-(i-1)s
     │         └────┐               → první schod jde skrz (ostří pokosu)
     │              └────┐
     └╌╌╌╌ prořez skrz

     ┌────┐
  B  │    └────┐                    prkno B: hloubka schodu i = t-i*s
     │         └────┐               → poslední schod se nefrézuje
     └──────────────┘
```

Prkna A a B jsou posunutá o jeden schod — jinak by do sebe nezapadla.
(Ověřeno rozkladem rohového čtverce na buňky `s × s`: A si bere buňky `i>j`,
B buňky `i<=j`, dohromady přesně celý čtverec bez překryvu i bez mezery.)

**Upnutí a nulování:** prkénko leží na ležato pohledovou stranou dolů, frézuje
se z vnitřní strany. X je podélná osa spoje, Y jde napříč prkénkem, Z se
prohlubuje v rámci tloušťky. Nuluje se stejně jako u zubok — frézou se ručně
dojede na okraj materiálu, takže materiál začíná o poloměr frézy dál.
Nejhlubší schod řeže skrz, **pod prkénko patří obětní deska**.

Program nejdřív roztočí vřeteno a počká na náběh otáček, pak schody odebírá
klikatým pohybem sem a tam po celé délce spoje. Zanořuje se vždy až za koncem
materiálu, tedy ve vzduchu.

## Výstup

Aplikace vygeneruje dva G-code soubory:

- `<nazev>_a.nc` — program pro první prkno
- `<nazev>_b.nc` — program pro druhé prkno (protikus spoje)

## Struktura projektu

```
zubok-online/
├── server/
│   ├── index.js        # Express server, /api/generate/:typ, security middleware
│   ├── util.js         # Sdílené pomocné funkce generátorů
│   ├── zubok.js        # G-code generátor box-joint (přepis zubok.rb)
│   └── schody.js       # G-code generátor schodového pokosu
├── client/
│   └── src/
│       ├── App.vue                      # Layout, záložky generátorů, API volání
│       ├── generators/                  # Definice polí a výchozích hodnot
│       │   ├── index.js                 # Seznam generátorů = pořadí záložek
│       │   ├── zubok.js
│       │   └── schody.js
│       └── components/
│           ├── ParamsForm.vue           # Obecný formulář řízený definicí polí
│           ├── FileUpload.vue           # Import .yml souboru
│           └── CanvasView3D.vue         # Three.js 3D vizualizace
└── examples/
    ├── zubky/
    │   ├── zubok.rb    # Původní Ruby skript (reference)
    │   └── zubok.yml   # Příklad parametrů
    └── schody/
        ├── schody.yml            # Příklad parametrů
        └── schodovy_spoj_[ab].nc # Ukázkový výstup
```

## Přidání dalšího generátoru

1. `server/<typ>.js` — třída s metodou `generate()` vracející
   `{ fn, a: {gcode, paths}, b: {gcode, paths}, meta }`.
   `meta.board` popisuje kvádr prkna pro 3D náhled, volitelné
   `meta.profil_a` / `meta.profil_b` obrys řezu.
2. `server/index.js` — přidat záznam do `GENERATORY` (třída + validační pravidla).
3. `client/src/generators/<typ>.js` — definice polí, výchozí hodnoty, `info()`.
4. `client/src/generators/index.js` — zařadit do seznamu.

Formulář i 3D náhled se pak vygenerují samy.

## Licence

MIT

## Plány do budoucna

- **Ukládání projektů do databáze** — parametry i vygenerované G-code soubory budou ukládány na serveru, což umožní historii projektů, sdílení a opětovné načtení. Toto je hlavní důvod pro zvolenou client-server architekturu.
