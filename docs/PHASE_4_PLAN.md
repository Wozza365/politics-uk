# Politics UK - Phase 4 Work Breakdown

> **Purpose.** Phase 4 turns the playable strategy game into a visually premium product. It is a
> production-design phase: colour, typography, HUD surfaces, map rendering, motion, icons, assets,
> audio feedback, and release-quality visual QA. It assumes the Phase 3 campaign loop is complete
> and does not add new simulation mechanics except where a visual surface needs a small supporting
> UI primitive or preference.
>
> The authoritative game design remains [`GAME_SPEC.md`](./GAME_SPEC.md). This plan captures the
> visual upgrade path as implementation-ready contracts under `docs/phase4/`.

## 0. How to use this document

The conventions, status legend, and definition of done follow the previous phase plans. Every task
below has a dedicated brief in `phase4/`.

Phase 4's additional definition of done:

1. Visual decisions become reusable tokens, primitives, and asset conventions. Avoid one-off
   hard-coded colours, radii, shadows, easing curves, and inline icons in feature components.
2. The game keeps its dense, command-room feel. Visual richness should improve scanning and
   confidence, not turn the app into a marketing page.
3. Motion, colour, icons, and audio remain accessible: reduced-motion users get calm alternatives,
   colour is never the only state cue, all text meets contrast targets, and icon-only controls have
   names plus tooltips where helpful.
4. Screenshots are part of the work. Each task that changes visible UI should include desktop and
   narrow-viewport captures, plus notes for anything that cannot be automated yet.
5. `npm run build`, `npm test`, and `npm run validate:data` pass unless a task explicitly explains
   why data validation is unaffected and was not run.

## 1. Phase 4 - visual premium pass

### P4.0 - Visual audit, art direction, and design tokens `DONE`

See [`phase4/P4.0-visual-audit-art-direction.md`](./phase4/P4.0-visual-audit-art-direction.md).

### P4.1 - Premium title, setup, loading, and result screens `DONE`

See [`phase4/P4.1-premium-screen-flow.md`](./phase4/P4.1-premium-screen-flow.md).

### P4.2 - HUD surface system and shared interaction primitives `DONE`

See [`phase4/P4.2-hud-surface-system.md`](./phase4/P4.2-hud-surface-system.md).

### P4.3 - Map, geography, overlays, and region-detail polish `DONE`

See [`phase4/P4.3-map-geography-polish.md`](./phase4/P4.3-map-geography-polish.md).

### P4.4 - Hemicycle, charts, stats, and data-visualisation polish `DONE`

See [`phase4/P4.4-data-visualisation-polish.md`](./phase4/P4.4-data-visualisation-polish.md).

### P4.5 - Motion, transitions, feedback states, and tactile feel `DONE`

See [`phase4/P4.5-motion-feedback.md`](./phase4/P4.5-motion-feedback.md).

### P4.6 - Iconography, party identity, imagery, and app assets `TODO`

See [`phase4/P4.6-iconography-assets.md`](./phase4/P4.6-iconography-assets.md).

### P4.7 - Event presentation, microcopy, and narrative tone `TODO`

See [`phase4/P4.7-event-presentation-microcopy.md`](./phase4/P4.7-event-presentation-microcopy.md).

### P4.8 - Audio, ambience, and player presentation settings `TODO`

See [`phase4/P4.8-audio-ambience-settings.md`](./phase4/P4.8-audio-ambience-settings.md).

### P4.9 - Visual QA, performance budgets, and release packaging `TODO`

See [`phase4/P4.9-visual-qa-release.md`](./phase4/P4.9-visual-qa-release.md).

## 2. Scope and ordering

P4.0 must happen first: it names the visual target and creates the tokens that every later task
uses. P4.1 and P4.2 establish the main product shell. P4.3 and P4.4 make the core game information
feel premium. P4.5 and P4.6 should begin once the primitives exist, then continue across every
screen. P4.7 can land alongside the event/feed surfaces. P4.8 is optional in the sense that the game
must remain excellent when muted, but if sound is added it needs proper settings. P4.9 runs
throughout and closes the phase.

```
Phase 3 complete
      |
      +-- P4.0 visual audit + tokens
              |
              +-- P4.1 title/setup/results
              +-- P4.2 HUD primitives
                      |
                      +-- P4.3 map/geography polish
                      +-- P4.4 charts/hemicycle/stats
                      +-- P4.5 motion/feedback
                      +-- P4.6 icons/assets
                      +-- P4.7 event/microcopy tone
                      +-- P4.8 audio/settings
                              |
                              +-- P4.9 visual QA/release packaging
```

## 3. Cross-cutting visual decisions

- **Art direction.** Aim for a modern civic command room: documentary, precise, tense, and legible.
  The game should feel like a live election operations desk rather than a generic dark dashboard.
- **Palette.** Replace the current zinc-heavy look with semantic tokens: deep ink backgrounds,
  disciplined neutral surfaces, Westminster green as an institutional anchor, brass/gold as a
  scarce premium accent, cyan/blue for player focus, red/amber for risk, and party colours for
  political ownership. No single hue family should dominate the whole interface.
- **Surface language.** Use tighter 6-8px radii for tool surfaces, consistent 1px borders,
  deliberate elevation, and fewer nested cards. Reserve larger radii for modal containers only when
  the component system justifies it.
- **Typography.** Use a restrained UI type scale with tabular numerals for polling, money, dates,
  seats, countdowns, and deltas. Avoid oversized headings inside dense panels.
- **Icons.** Use a single icon system, preferably `lucide-vue-next`, behind shared wrappers. Replace
  manually drawn button SVGs and text-only utility buttons where a familiar icon is clearer.
- **Motion.** Use a small motion scale: quick control feedback, medium panel transitions, slower
  result reveals. All essential state changes must be understandable when motion is reduced.
- **Assets.** Use real or properly licensed assets only. Until rights are confirmed, use generated
  or custom placeholder portraits/marks that look intentional and are documented as placeholders in
  asset notes, not called out awkwardly in player-facing UI.

## 4. Explicitly deferred beyond Phase 4

- New gameplay systems, online services, cloud profiles, public leaderboards, and multiplayer.
- A full brand/marketing site.
- A real 3D renderer unless P4.3 proves the current SVG/CSS map cannot hit the desired look or
  performance budget.
- Expensive copyrighted photography, official party marks, or politician portraits without a clear
  usage decision.
