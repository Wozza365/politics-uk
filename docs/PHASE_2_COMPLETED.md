# Politics UK — Phase 2: completed so far

> Phase 2 is **in progress** — this file is the record of what's already
> built and how, kept out of [`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md) so that
> document only carries still-relevant, forward-looking work. The
> authoritative design remains [`GAME_SPEC.md`](./GAME_SPEC.md). See
> `PHASE_2_PLAN.md` §A for what's still open and the current critical path.

## P2.0 — Polling-driven seat projection at the GE ✅

- `src/sim/projection.ts` (new) — `projectSeatsByParty(regions, startPolling, currentPolling)`: a
  pure, deterministic uniform-national-swing projection. `nationalSwing()` computes each party's
  polling movement since the scenario's day-one snapshot; every seat's last real `results`
  breakdown (P1.14's `CandidateResult[]`) is shifted by its party's swing (floored at 0%), and
  whichever candidate now has the highest projected share wins the seat. A seat with no `results`
  data just keeps its recorded incumbent rather than guessing. Unit-tested in
  `src/sim/projection.spec.ts` the same way `src/sim/poll.ts` is.
- `src/stores/game.ts` — added `projectedCommonsSeatsByParty`/`projectedPlayerSeatCount` getters
  built on `projectSeatsByParty`, and `checkElectionResult()` now judges the win/lose threshold
  against the projection instead of the unchanged starting `commonsSeatsByParty`/`playerSeatCount`
  (those two getters are kept as-is — still useful as the "starting position" to compare against).
- **The GE is the headline moment, not a finale.** Added `game.continuePlaying()` (resumes the
  clock; deliberately leaves `result` set so `checkElectionResult`'s existing guard doesn't
  re-fire it) and wired it into `ResultScreen.vue` as a "Continue playing" button alongside the
  existing "Play again" restart — `ResultScreen.vue` now shows the projected seat count and lets
  the player drop straight back into live play with the same party/date/polling rather than
  ending the run.
- **Scoped deliberately narrow:** `ResultScreen.vue`/`game.result` remain GE-specific. Other
  regular elections (devolved parliaments, councils, mayors/PCCs, by-elections) are intentionally
  **not** routed through this win/lose screen — none of their composition data exists yet
  (P2.1/P2.3/P2.4 are still open) — and per the doc's own no-speculative-building rule, a generic
  multi-election-result system wasn't built ahead of that data landing. `PHASE_2_PLAN.md`'s P2.0
  entry and P2.8 carry forward notes for whoever picks those up: non-GE results should be a
  non-blocking "here's what happened" notice, not a second win/lose gate.
- **Known follow-on, not fixed here:** once the GE date passes, `GameClock.vue`'s countdown has
  nothing left to count toward and just shows "General Election day" indefinitely — deciding what
  the clock counts down to next is tied to P2.8's "list all upcoming elections" note, so it's left
  there rather than patched in isolation.
- Covered by `src/stores/game.spec.ts` (`checkElectionResult` judges the projection not the static
  count; doesn't re-evaluate once a result is recorded; `continuePlaying` resumes the clock without
  clearing the result) and `src/sim/projection.spec.ts` (swing computation; incumbent-keeps-seat
  with no swing; seat flips once swing overtakes the local gap; sums across many seats; falls back
  to the incumbent with no `results` data; never projects a negative vote share).
- **Acceptance:** the GE result reflects in-game polling movement, not just the scenario's starting
  seats, and offers a real "continue playing" path back into the live game; `npm run build` and
  `npm run test` clean.
