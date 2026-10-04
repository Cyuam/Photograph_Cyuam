import { notFound } from "next/navigation"
import { Suspense } from "react"
import PortfolioDetail from "@/components/portfolio-detail"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"

const looksZh = (text?: string | null) => /[\u4e00-\u9fff]/.test(String(text || ""))

export const revalidate = 0 // Disable caching for this route

const normalizeText = (value?: string | null) => String(value || "").toLowerCase().trim()

const resolveStylePictureIds = async (styleConfig: { tagName: string; labels?: { en?: string; zh?: string } }, pictureIds: number[]) => {
  const matches = new Set<number>()
  if (!pictureIds.length) return matches

  const styleTagName = normalizeText(styleConfig.tagName)
  if (styleTagName) {
    const { data: tagRows } = await supabaseAdmin
      .from("tags")
      .select("id,name,type")
      .eq("type", "style")
      .ilike("name", styleConfig.tagName)

    const tagId = tagRows?.[0]?.id as number | undefined
    if (tagId) {
      const { data: taggingRows } = await supabaseAdmin
        .from("picture_taggings")
        .select("picture_id, tag_id")
        .eq("tag_id", tagId)
        .in("picture_id", pictureIds)

      for (const row of taggingRows || []) {
        const pid = (row as any).picture_id
        if (Number.isFinite(pid)) matches.add(pid as number)
      }
    }
  }

  const aliasSet = new Set<string>()
  if (styleConfig.tagName) aliasSet.add(normalizeText(styleConfig.tagName))
  if (styleConfig.labels?.en) aliasSet.add(normalizeText(styleConfig.labels.en))
  if (styleConfig.labels?.zh) aliasSet.add(normalizeText(styleConfig.labels.zh))

  if (aliasSet.size > 0) {
    const { data: categoryRows } = await supabaseAdmin
      .from("categories")
      .select("id,name")

    const categoryIds: number[] = []
    for (const row of categoryRows || []) {
      const name = normalizeText((row as any).name)
      if (!name || !aliasSet.has(name)) continue
      const id = (row as any).id
      if (Number.isFinite(id)) categoryIds.push(id as number)
    }

    if (categoryIds.length > 0) {
      const { data: pictureCategoryRows } = await supabaseAdmin
        .from("picture_categories")
        .select("picture_id, category_id")
        .in("category_id", categoryIds)
        .in("picture_id", pictureIds)

      for (const row of pictureCategoryRows || []) {
        const pid = (row as any).picture_id
        if (Number.isFinite(pid)) matches.add(pid as number)
      }
    }
  }

  return matches
}

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{
    style?: string
    origin?: string
    originStyle?: string
    originIndex?: string
    returnSet?: string
    pictureId?: string
  }>
}) {
  const { id: setId } = await params
  const resolvedSearchParams = await searchParams
  console.log(`Fetching pictures for set ID: ${setId}`)
  const requestedStyle = typeof resolvedSearchParams?.style === "string" ? resolvedSearchParams.style : null
  const origin = typeof resolvedSearchParams?.origin === "string" ? resolvedSearchParams.origin : null
  const originStyle = typeof resolvedSearchParams?.originStyle === "string" ? resolvedSearchParams.originStyle : null
  const returnSet = typeof resolvedSearchParams?.returnSet === "string" ? resolvedSearchParams.returnSet : null
  const originIndex = typeof resolvedSearchParams?.originIndex === "string" ? Number(resolvedSearchParams.originIndex) : null
  const styleConfig = requestedStyle
    ? PHOTOGRAPHY_STYLE_BY_ID[requestedStyle as keyof typeof PHOTOGRAPHY_STYLE_BY_ID]
    : undefined

  // Fetch pictures based on picture_set_id
  const { data: pictures, error: pictureError } = await supabaseAdmin
    .from("pictures")
    .select("*")
    .eq("picture_set_id", setId)
    .order("order_index", { ascending: true })

  if (pictureError) {
    console.error("Error fetching pictures:", pictureError)
    notFound()
  }

  console.log(`Found ${pictures?.length || 0} pictures for set ID: ${setId}`)

  const rawPictures = pictures || []
  if (rawPictures.length === 0) {
    console.log("No pictures found, returning 404")
    notFound()
  }

  let filteredPictures = rawPictures
  if (styleConfig && requestedStyle) {
    const styleKey = requestedStyle.toLowerCase()
    const directMatches = rawPictures.filter((pic: any) => String(pic.style || "").toLowerCase() === styleKey)
    if (directMatches.length > 0) {
      filteredPictures = directMatches
    } else {
      const pictureIds = rawPictures.map((p) => p.id)
      const resolvedIds = await resolveStylePictureIds(styleConfig, pictureIds)
      if (resolvedIds.size > 0) {
        filteredPictures = rawPictures.filter((pic: any) => resolvedIds.has(pic.id))
      } else {
        filteredPictures = []
      }
    }
    console.log(`Filtered to ${filteredPictures.length} pictures for style ${requestedStyle} in set ${setId}`)
  }

  if (styleConfig && filteredPictures.length === 0) {
    console.log("No matching style pictures found, returning 404")
    notFound()
  }

  const pictureIds = filteredPictures.map((p) => p.id)

  const { data: pictureTranslations } = pictureIds.length
    ? await supabaseAdmin
        .from('picture_translations')
        .select('picture_id, locale, title, subtitle, description')
        .in('picture_id', pictureIds)
    : { data: [] }

  const pictureTranslationsMap = new Map<number, { en: { title?: string | null; subtitle?: string | null; description?: string | null }; zh: { title?: string | null; subtitle?: string | null; description?: string | null } }>()

  for (const pic of filteredPictures) {
    pictureTranslationsMap.set(pic.id, {
      en: {
        title: pic.title ?? '',
        subtitle: pic.subtitle ?? '',
        description: pic.description ?? '',
      },
      zh: {
        title: '',
        subtitle: '',
        description: '',
      },
    })
  }

  for (const row of pictureTranslations || []) {
    const entry = pictureTranslationsMap.get(row.picture_id)
    if (!entry) continue
    const target = row.locale === 'zh' ? entry.zh : entry.en
    if (row.title) target.title = row.title
    if (row.subtitle) target.subtitle = row.subtitle
    if (row.description) target.description = row.description
  }

  for (const pic of filteredPictures) {
    const entry = pictureTranslationsMap.get(pic.id)
    if (!entry) continue
    const baseTitle = pic.title ?? ''
    const baseSubtitle = pic.subtitle ?? ''
    const baseDescription = pic.description ?? ''

    if (!entry.en.title && !looksZh(baseTitle)) entry.en.title = baseTitle
    if (!entry.en.subtitle && !looksZh(baseSubtitle)) entry.en.subtitle = baseSubtitle
    if (!entry.en.description && !looksZh(baseDescription)) entry.en.description = baseDescription

    if (!entry.zh.title && looksZh(baseTitle)) entry.zh.title = baseTitle
    if (!entry.zh.subtitle && looksZh(baseSubtitle)) entry.zh.subtitle = baseSubtitle
    if (!entry.zh.description && looksZh(baseDescription)) entry.zh.description = baseDescription
  }

  const images = filteredPictures.map((pic) => {
    const translationEntry = pictureTranslationsMap.get(pic.id) || { en: {}, zh: {} }
    return {
      id: pic.id,
      url: pic.image_url || "/placeholder.svg",
      rawUrl: pic.raw_image_url || pic.image_url,
      translations: {
        en: {
          title: translationEntry.en.title || '',
          subtitle: translationEntry.en.subtitle || '',
          description: translationEntry.en.description || '',
        },
        zh: {
          title: translationEntry.zh.title || '',
          subtitle: translationEntry.zh.subtitle || '',
          description: translationEntry.zh.description || '',
        },
      },
    }
  })

  const { data: pictureSet } = await supabaseAdmin
    .from('picture_sets')
    .select('title, subtitle, description, primary_location_name, primary_location_latitude, primary_location_longitude')
    .eq('id', setId)
    .single()

  const { data: setTranslations } = await supabaseAdmin
    .from('picture_set_translations')
    .select('locale, title, subtitle, description')
    .eq('picture_set_id', setId)

  const setEntry = {
    en: {
      title: pictureSet?.title ?? '',
      subtitle: pictureSet?.subtitle ?? '',
      description: pictureSet?.description ?? '',
    },
    zh: {
      title: '',
      subtitle: '',
      description: '',
    },
  }

  for (const row of setTranslations || []) {
    const target = row.locale === 'zh' ? setEntry.zh : setEntry.en
    if (row.title) target.title = row.title
    if (row.subtitle) target.subtitle = row.subtitle
    if (row.description) target.description = row.description
  }

  if (!setEntry.zh.title && looksZh(pictureSet?.title)) setEntry.zh.title = pictureSet?.title ?? ''
  if (!setEntry.zh.subtitle && looksZh(pictureSet?.subtitle)) setEntry.zh.subtitle = pictureSet?.subtitle ?? ''
  if (!setEntry.zh.description && looksZh(pictureSet?.description)) setEntry.zh.description = pictureSet?.description ?? ''

  const { data: setLocationRows, error: setLocationError } = await supabaseAdmin
    .from('picture_set_locations')
    .select('location_id, is_primary, location:locations(name, name_en, name_zh, latitude, longitude)')
    .eq('picture_set_id', setId)

  if (setLocationError) {
    console.warn('Failed to fetch set locations:', setLocationError)
  }

  const locations =
    setLocationRows
      ?.map((row) => {
        const loc = (row as any).location || (row as any).locations
        if (!loc) return null
        return {
          id: row.location_id ?? `loc-${setId}`,
          isPrimary: row.is_primary,
          name: loc.name as string | null | undefined,
          name_en: loc.name_en as string | null | undefined,
          name_zh: loc.name_zh as string | null | undefined,
          latitude: typeof loc.latitude === 'number' ? loc.latitude : Number(loc.latitude),
          longitude: typeof loc.longitude === 'number' ? loc.longitude : Number(loc.longitude),
        }
      })
      .filter(Boolean) ?? []

  const resolvedLocations = [...locations]
  if (resolvedLocations.length === 0 && pictureSet?.primary_location_name) {
    resolvedLocations.push({
      id: `primary-${setId}`,
      isPrimary: true,
      name: pictureSet.primary_location_name,
      name_en: pictureSet.primary_location_name,
      name_zh: pictureSet.primary_location_name,
      latitude: pictureSet.primary_location_latitude ?? null,
      longitude: pictureSet.primary_location_longitude ?? null,
    })
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PortfolioDetail
        id={setId}
        images={images}
        translations={setEntry}
        locations={resolvedLocations}
        returnContext={
          origin === "style" && originStyle
            ? {
                type: "style",
                styleKey: originStyle,
                styleIndex: Number.isFinite(originIndex as number) ? originIndex : 0,
              }
            : {
                type: "portfolio",
                returnSetId: returnSet || setId,
              }
        }
      />
    </Suspense>
  )
}
