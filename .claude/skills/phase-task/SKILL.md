---
name: phase-task
description: Pick up a single phase task by its ID (e.g. P2.4, P3.1) without loading the full phase plan or game spec. Use whenever asked to implement, continue, or check status on a task referenced by a P<N>.<M> id.
---

Goal: do the task with the smallest possible amount of doc-reading.

1. Find the task's own file: `docs/phase<N>/P<N>.<M>-*.md`. Read only that file. It already
   contains Goal/Steps/Files/Acceptance criteria — that's normally sufficient.
   - If no per-task file exists yet, read just that task's section inside
     `docs/PHASE_<N>_PLAN.md` (search for the task id, don't read the whole doc).
   - Only open `docs/GAME_SPEC.md` if the task file points at a specific `§N` you need to
     resolve an ambiguity — read that section, not the whole spec.
2. Conventions and the definition of done are already in `CLAUDE.md` — don't re-derive them from
   the phase plan's "How to use this document" section.
3. Implement against the task's Steps/Files/Acceptance criteria.
4. Run the definition-of-done checks from `CLAUDE.md` (`npm run build`, tests/dev reachability).
5. Commit and push (no PR unless explicitly asked).
6. Update tracking: flip the task's status marker (`🔲`/`🟠`/`✅`) in `docs/PHASE_<N>_PLAN.md`. If
   the task is fully done, move its detail into `docs/PHASE_<N>_COMPLETED.md` and leave a short
   pointer behind in the plan, mirroring how already-completed tasks (e.g. P2.3) are recorded —
   this keeps future sessions from re-reading finished work.
7. If the task is listed as "independent" in the phase plan's dependency graph and is sizeable,
   consider delegating it to a subagent instead of doing the research inline.
