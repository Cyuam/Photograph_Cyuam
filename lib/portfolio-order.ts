import type { PictureSet } from "@/lib/pictureSet.types"

export const stableShuffleArray = (array: PictureSet[], seed: string): PictureSet[] => {
  const shuffled = [...array]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (hash * 9301 + 49297) % 233280
    if (hash < 0) hash += 233280
    const j = Math.abs(hash) % (i + 1)
    const tmp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = tmp
  }

  return shuffled
}

interface SectionAssignment {
  picture_set_id: number
  section_id: number
}

interface SectionRow {
  id: number
  name?: string | null
}

export const derivePortfolioBuckets = (
  sets: PictureSet[],
  assignments: SectionAssignment[] | null,
  sections: SectionRow[] | null,
) => {
  const secNameById: Record<number, string> = {}
  for (const row of sections || []) {
    const id = Number((row as any).id)
    if (!Number.isFinite(id)) continue
    secNameById[id] = String((row as any).name || '').toLowerCase().trim()
  }
  const isTop = (n?: string) => !!n && (/\bup\b|top|上|顶/.test(n))
  const isBottom = (n?: string) => !!n && (/\bdown\b|bottom|下|底/.test(n))
  const topIds = new Set<number>()
  const bottomIds = new Set<number>()
  for (const assign of assignments || []) {
    const sid = Number((assign as any).section_id)
    const psid = Number((assign as any).picture_set_id)
    if (!Number.isFinite(sid) || !Number.isFinite(psid)) continue
    const name = secNameById[sid]
    if (isTop(name)) topIds.add(psid)
    if (isBottom(name)) bottomIds.add(psid)
  }

  const topSets = sets.filter((s) => topIds.has(s.id))
  const bottomSets = sets.filter((s) => bottomIds.has(s.id))
  const legacyUp = sets.filter((s) => (s.position || '').trim().toLowerCase() === 'up' && !topIds.has(s.id))
  const legacyDown = sets.filter((s) => (s.position || '').trim().toLowerCase() === 'down' && !bottomIds.has(s.id))
  const upCombined = [...topSets, ...legacyUp]
  const downCombined = [...bottomSets, ...legacyDown]
  const seed = downCombined.map((s) => s.id).join('-')
  const shuffledDown = stableShuffleArray(downCombined, seed)

  return {
    upCombined,
    downCombined: shuffledDown,
  }
}

export const fallbackBuckets = (sets: PictureSet[]) => {
  const downSets = sets.filter((s) => (s.position || '').trim().toLowerCase() === 'down')
  const seed = downSets.map((s) => s.id).join('-')
  return {
    upCombined: sets.filter((s) => (s.position || '').trim().toLowerCase() === 'up'),
    downCombined: stableShuffleArray(downSets, seed),
  }
}
