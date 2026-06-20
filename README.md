# Politics UK

A political simulator: run a real UK political party from a real-world scenario start date,
through to a UK General Election. See [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md) for the full design spec.

## Stack

Vite + Vue 3 (`<script setup>`, TypeScript) + Pinia + Tailwind CSS. Map rendering sits behind a
backend-agnostic `MapRenderer` interface (`src/map/`); the MVP backend is SVG via d3-geo +
topojson-client, with a future true-3D (TresJS) backend swappable per-view without touching game
logic (spec §9.1).

## Getting started

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
```

## Project layout

```
src/
  types/         Scenario/Party/Region/Seat entity shapes (spec §4.2)
  map/           MapRenderer interface + SvgMapRenderer implementation
  stores/        Pinia stores
  data/scenarios/ Versioned, date-stamped scenario datasets (spec §5)
  components/    Vue components
scripts/data/    Data acquisition scripts (boundaries, composition, …)
docs/            Game specification
```

`src/data/scenarios/uk-2025-01-01/` currently ships a **placeholder** fixture, not real UK data —
see the README in that directory for why, and how to replace it.
