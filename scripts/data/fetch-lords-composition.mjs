// Writes House of Lords composition as of 2025-01-01 as a single synthetic
// Region (lords tier) to
// src/data/scenarios/uk-2025-01-01/composition.lords.json, matching the
// shape of src/types/region.ts.
//
// The Lords is "n/a (chamber)" per spec §4.1 row 2 — there's no constituency
// geometry to draw, just a peer count by party/group — so unlike every other
// tier this isn't built from per-seat Members API rows. It's modelled as one
// synthetic Region (id/geometryRef "lords", no boundary file, matching the
// "london-wide" synthetic-region pattern fetch-london-assembly-composition.mjs
// already uses for list seats with no drawable geometry) holding one
// unnamed Seat per peer, grouped by party/group so PartyPanel.vue's existing
// per-party seat-count filter (already wired against scenario.tiers.lords,
// P1.7) just works once this file exists. No memberName/electedAt: this
// pass captures group strengths, not the full ~800-name membership roll,
// and peers are appointed rather than elected.
//
// Source & provenance (see also sibling sources.json's "lords" entry):
// this environment's network egress policy blocks members-api.parliament.uk
// and lordslibrary.parliament.uk directly (live State-of-the-Parties figures
// for the exact 2025-01-01 date could not be fetched), so this snapshot is
// reconstructed from the most specific dated reporting available via search:
// LabourList's 20 Dec 2024 report on that month's new-peers list, which
// quotes the *pre-announcement* state of the parties — Conservative 273,
// Labour 187, Liberal Democrat 78, Crossbench 184, "57 from other parties
// and independents" — plus the usual ~25 Lords Spiritual (bishops), who
// aren't a "party" so aren't counted in that 57. That pre-announcement
// figure (not the post-announcement one) is used deliberately: introductions
// of newly-created peers take weeks after an announcement, so the
// announced December batch would mostly not yet have been formally seated
// by 1 January 2025 — consistent with a separately-reported "807 members
// as of 2025" headline total (804 here, within rounding/Bishops-fill
// distance of that figure). The "57 other parties and independents" bucket
// is split using the smaller named groups' typical sizes around this period
// (DUP 6, UUP 3, Green 2, Plaid Cymru 2), with the remainder folded into
// "independent" (non-affiliated peers, the Lord Speaker, and the one sitting
// Conservative-Independent peer — none of which move the count enough to
// warrant their own party-list entry). Treat these as a best-effort
// reconstruction, not an official as-at-date table — flagged here rather
// than presented as exact.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolvePartySlug } from './party-slugs.mjs'

const TIER = 'lords'

// Party/group -> peer count as of 2025-01-01 (see header comment for
// sourcing and the reconstruction method).
const GROUPS = {
  Conservative: 273,
  Labour: 187,
  Crossbench: 184,
  'Liberal Democrat': 78,
  Bishops: 25,
  'Non-affiliated': 44,
  'Democratic Unionist Party': 6,
  'Ulster Unionist Party': 3,
  'Green Party': 2,
  'Plaid Cymru': 2,
}

function main() {
  const seats = Object.entries(GROUPS).flatMap(([groupName, count]) => {
    const party = resolvePartySlug(groupName)
    return Array.from({ length: count }, () => ({ regionId: 'lords', party }))
  })

  const totalSeats = seats.length
  console.log(`Built 1 region, ${totalSeats} total seats (peers).`)

  const region = {
    id: 'lords',
    tier: TIER,
    name: 'House of Lords',
    geometryRef: 'lords',
    seats,
  }

  const outPath = fileURLToPath(
    new URL('../../src/data/scenarios/uk-2025-01-01/composition.lords.json', import.meta.url),
  )
  writeFileSync(outPath, JSON.stringify([region], null, 2))
  console.log(`Wrote ${outPath}`)
}

main()
