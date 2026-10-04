import { supabaseAdmin } from "@/utils/supabaseAdmin"
import type { PictureSet } from "@/lib/pictureSet.types"
import { derivePortfolioBuckets, fallbackBuckets } from "@/lib/portfolio-order"
import type { InitialPortfolioPayload } from "@/lib/portfolioInitialData"

export const fetchPortfolioInitialData = async (): Promise<InitialPortfolioPayload | null> => {
  try {
    const { data: setsData, error: setsError } = await supabaseAdmin
      .from('picture_sets')
      .select('id, created_at, updated_at, cover_image_url, title, subtitle, description, position, is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (setsError) {
      console.error('[portfolioInitialData] failed to fetch picture_sets', setsError)
      return null
    }

    const sets = (setsData || []) as PictureSet[]
    if (sets.length === 0) {
      return {
        pictureSets: [],
        transMap: {},
        setLocations: {},
        upSets: [],
        downSets: [],
      }
    }

    const ids = sets.map((s) => s.id)

    const [translationsEnRes, translationsZhRes, locationsRes, assignmentsRes, sectionsRes] = await Promise.all([
      supabaseAdmin
        .from('picture_set_translations')
        .select('picture_set_id, title, subtitle, description')
        .eq('locale', 'en')
        .in('picture_set_id', ids),
      supabaseAdmin
        .from('picture_set_translations')
        .select('picture_set_id, title, subtitle, description')
        .eq('locale', 'zh')
        .in('picture_set_id', ids),
      supabaseAdmin
        .from('picture_set_locations')
        .select('picture_set_id, is_primary, location:locations(name, name_en, name_zh, latitude, longitude)')
        .in('picture_set_id', ids)
        .eq('is_primary', true),
      supabaseAdmin
        .from('picture_set_section_assignments')
        .select('picture_set_id, section_id')
        .in('picture_set_id', ids),
      supabaseAdmin
        .from('sections')
        .select('id, name'),
    ])

    const transMap: Record<number, { en?: any; zh?: any }> = {}
    for (const row of translationsEnRes.data || []) {
      const id = (row as any).picture_set_id as number
      const existing = transMap[id] || {}
      existing.en = {
        title: (row as any).title || undefined,
        subtitle: (row as any).subtitle || undefined,
        description: (row as any).description || undefined,
      }
      transMap[id] = existing
    }
    for (const row of translationsZhRes.data || []) {
      const id = (row as any).picture_set_id as number
      const existing = transMap[id] || {}
      existing.zh = {
        title: (row as any).title || undefined,
        subtitle: (row as any).subtitle || undefined,
        description: (row as any).description || undefined,
      }
      transMap[id] = existing
    }

    const setLocations: Record<number, { name?: string | null; name_en?: string | null; name_zh?: string | null; latitude: number; longitude: number }> = {}
    for (const row of locationsRes.data || []) {
      const psid = Number((row as any).picture_set_id)
      const loc = (row as any).location || (row as any).locations
      if (!loc) continue
      const lat = Number((loc as any).latitude)
      const lng = Number((loc as any).longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      setLocations[psid] = {
        name: (loc as any).name,
        name_en: (loc as any).name_en,
        name_zh: (loc as any).name_zh,
        latitude: lat,
        longitude: lng,
      }
    }

    let upSets: PictureSet[] = []
    let downSets: PictureSet[] = []
    try {
      const { upCombined, downCombined } = derivePortfolioBuckets(
        sets,
        assignmentsRes.data || [],
        sectionsRes.data || [],
      )
      upSets = upCombined
      downSets = downCombined
    } catch (err) {
      console.warn('[portfolioInitialData] derive buckets failed, fallback to position only', err)
      const fallback = fallbackBuckets(sets)
      upSets = fallback.upCombined
      downSets = fallback.downCombined
    }

    return {
      pictureSets: sets,
      transMap,
      setLocations,
      upSets,
      downSets,
    }
  } catch (err) {
    console.error('[portfolioInitialData] unexpected failure', err)
    return null
  }
}
