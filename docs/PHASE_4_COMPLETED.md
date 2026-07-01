# Politics UK - Phase 4: completed so far

> Use this file to record completed visual-polish work once tasks from
> [`PHASE_4_PLAN.md`](./PHASE_4_PLAN.md) begin landing.

## Completed tasks

### P4.0 - Visual audit, art direction, and design tokens

Completed on 2026-06-27.

- Added semantic visual tokens and Tailwind v4 aliases in [`src/style.css`](../src/style.css).
- Wrote the Phase 4 visual audit, art direction, contrast notes, motion/layout rules, and asset
  rules in [`phase4/P4.0-visual-audit-notes.md`](./phase4/P4.0-visual-audit-notes.md).
- Captured desktop and narrow baseline screenshots in
  [`phase4/screenshots/p4-0/`](./phase4/screenshots/p4-0/), with QA exceptions listed for map hover
  and result screen follow-up.

### P4.1 - Premium title, setup, loading, and result screens

Completed on 2026-06-30.

- Rebuilt the outer game loop screens around the P4.0 civic command-room tokens:
  [`TitleScreen.vue`](../src/screens/TitleScreen.vue),
  [`NewGameScreen.vue`](../src/screens/NewGameScreen.vue),
  [`LoadGameScreen.vue`](../src/screens/LoadGameScreen.vue),
  [`LoadingScreen.vue`](../src/screens/LoadingScreen.vue),
  [`RestoreScreen.vue`](../src/screens/RestoreScreen.vue), and
  [`ResultScreen.vue`](../src/screens/ResultScreen.vue).
- Reworked [`PartyCard.vue`](../src/components/PartyCard.vue) with an accent rail, party mark,
  dense stat tiles, and non-colour selected state.
- Added screen-flow scroll reset in [`App.vue`](../src/App.vue) so narrow screen transitions start
  at the top of the new view.
- Captured P4.1 screenshots and verification notes in
  [`phase4/P4.1-QA.md`](./phase4/P4.1-QA.md) and
  [`phase4/screenshots/p4-1/`](./phase4/screenshots/p4-1/).

### P4.2 - HUD surface system and shared interaction primitives

Completed on 2026-06-30.

- Added shared HUD primitives for panels, headers, icon buttons, segmented controls, status pills,
  stat tiles, modal surfaces, drawer panels, and tooltips under [`src/components`](../src/components).
- Centralised repeated HUD surface, button, segmented-control, status, stat-tile, modal, tooltip,
  reduced-motion, and forced-colors styling in [`src/style.css`](../src/style.css).
- Converted the game shell, event feed, party panel, clock, journal, goal strip, menu, save panel,
  by-elections panel, targeting panel, help panel, explanation dialog, confirm dialog, and view
  switcher onto shared primitives.
- Added [`@lucide/vue`](https://www.npmjs.com/package/@lucide/vue) as the shared HUD icon library.
- Captured P4.2 screenshots and verification notes in
  [`phase4/P4.2-QA.md`](./phase4/P4.2-QA.md) and
  [`phase4/screenshots/p4-2/`](./phase4/screenshots/p4-2/).

### P4.3 - Map, geography, overlays, and region-detail polish

Completed on 2026-06-30.

- Reworked [`MapView.vue`](../src/components/MapView.vue) into a premium map-room surface with a
  cartographic backdrop, selected-region detail sheet, compact overlay legend, icon zoom controls,
  keyboard pan/zoom/reset support, and responsive narrow-screen collapse.
- Extended the renderer display contract in [`MapRenderer.ts`](../src/map/MapRenderer.ts) with
  stroke dash cues, then applied hatching, dashed/dotted overlay rails, hover highlights, and
  active-region depth in both [`SvgMapRenderer.ts`](../src/map/SvgMapRenderer.ts) and
  [`HexMapRenderer.ts`](../src/map/HexMapRenderer.ts).
- Added shared overlay visual metadata and coverage in
  [`visualState.ts`](../src/map/visualState.ts) and
  [`visualState.spec.ts`](../src/map/visualState.spec.ts).
- Captured P4.3 screenshots and verification notes in
  [`phase4/P4.3-QA.md`](./phase4/P4.3-QA.md) and
  [`phase4/screenshots/p4-3/`](./phase4/screenshots/p4-3/).

### P4.4 - Hemicycle, charts, stats, and data-visualisation polish

Completed on 2026-06-30.

- Added a shared data-visualisation theme and formatting helpers in
  [`dataVizTheme.ts`](../src/components/dataVizTheme.ts), with focused tests in
  [`dataVizTheme.spec.ts`](../src/components/dataVizTheme.spec.ts).
- Polished [`PollingHistoryChart.vue`](../src/components/PollingHistoryChart.vue) with themed
  axes/tooltips, series emphasis, trend deltas, and latest-poll text alternatives.
- Rebuilt [`HemicycleView.vue`](../src/components/HemicycleView.vue) around labelled party chips,
  top-party summaries, seats-per-dot explanation, non-colour grouping, and responsive SVG layout.
- Upgraded [`CompassView.vue`](../src/components/CompassView.vue) and
  [`ContestCard.vue`](../src/components/ContestCard.vue) with clearer analytical visuals and HUD
  data/action surfaces.
- Captured P4.4 screenshots and verification notes in
  [`phase4/P4.4-QA.md`](./phase4/P4.4-QA.md) and
  [`phase4/screenshots/p4-4/`](./phase4/screenshots/p4-4/).

### P4.5 - Motion, transitions, feedback states, and tactile feel

Completed on 2026-07-01.

- Added shared motion timings and transition classes for screen changes, HUD panels, popovers,
  modal surfaces, event-feed arrivals, and save-status feedback in [`src/style.css`](../src/style.css).
- Wrapped the title/setup/game screen outlet, save/help/targeting/by-election/menu panels,
  tutorial popover, explanation dialog, confirmation dialog, and event feed in deterministic Vue
  transitions.
- Added explicit save-status states in
  [`SaveStatusIndicator.vue`](../src/components/SaveStatusIndicator.vue) and reduced-motion
  substitutions for all new transition families.
- Captured P4.5 screenshots and verification notes in
  [`phase4/P4.5-QA.md`](./phase4/P4.5-QA.md) and
  [`phase4/screenshots/p4-5/`](./phase4/screenshots/p4-5/).

### P4.6 - Iconography, party identity, imagery, and app assets

Completed on 2026-07-01.

- Added shared party and leader identity components:
  [`PartyMark.vue`](../src/components/PartyMark.vue) and
  [`LeaderPortrait.vue`](../src/components/LeaderPortrait.vue).
- Replaced title/setup/load text glyph controls with lucide icons and reused party marks in
  polling, save, and setup surfaces.
- Replaced the starter favicon with project-owned ballot-shield assets in
  [`public/favicon.svg`](../public/favicon.svg), [`public/app-icon.svg`](../public/app-icon.svg),
  and [`public/manifest.webmanifest`](../public/manifest.webmanifest).
- Documented asset source and replacement rules in
  [`phase4/P4.6-asset-notes.md`](./phase4/P4.6-asset-notes.md), with QA screenshots in
  [`phase4/P4.6-QA.md`](./phase4/P4.6-QA.md) and
  [`phase4/screenshots/p4-6/`](./phase4/screenshots/p4-6/).

### P4.7 - Event presentation, microcopy, and narrative tone

Completed on 2026-07-01.

- Added feed scope/severity metadata for generated events, contests, elections, player levers,
  targeted campaigns, and commitment resolution in [`game.ts`](../src/stores/game.ts).
- Reworked [`EventFeed.vue`](../src/components/EventFeed.vue) into metadata-led event cards with
  clear decision, recorded, action-taken, effect, and explanation states.
- Polished action comparison surfaces in [`LeverCard.vue`](../src/components/LeverCard.vue) and
  [`TargetOptionRow.vue`](../src/components/TargetOptionRow.vue), then tightened tutorial,
  glossary, and explanation audit copy.
- Documented the tone guide in [`phase4/P4.7-tone-guide.md`](./phase4/P4.7-tone-guide.md), with
  QA screenshots in [`phase4/P4.7-QA.md`](./phase4/P4.7-QA.md) and
  [`phase4/screenshots/p4-7/`](./phase4/screenshots/p4-7/).

## Carry-forward notes

- Keep screenshots, visual QA notes, and any asset-rights decisions close to the task that made
  them necessary.
- When a Phase 4 task is finished, mark it `DONE` in `PHASE_4_PLAN.md` and link the completion
  record here.
