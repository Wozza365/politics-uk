// ONS PCON24NM and Parliament's "membershipFrom"/constituencyName generally
// agree; normalise away the handful of stylistic differences (ampersand vs
// "and", curly vs straight apostrophes, diacritics) before matching across
// sources keyed by constituency name.
export function normaliseConstituencyName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics, e.g. "Glyndŵr" -> "Glyndwr"
    .replace(/&/g, 'and')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
