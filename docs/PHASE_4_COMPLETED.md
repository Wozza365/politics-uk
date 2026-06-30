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

## Carry-forward notes

- Keep screenshots, visual QA notes, and any asset-rights decisions close to the task that made
  them necessary.
- When a Phase 4 task is finished, mark it `DONE` in `PHASE_4_PLAN.md` and link the completion
  record here.
