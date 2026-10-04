import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { PHOTOGRAPHY_STYLES } from "@/lib/photography-styles"

export const runtime = "nodejs"

const MAX_PICTURES_PER_STYLE = 80
const RECENT_STYLE_ID = "travel"

const safeTime = (value: string | null | undefined) => {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

type PictureTranslation = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
}

type PicturePayload = {
  id: number
  pictureSetId: number
  imageUrl: string
  rawImageUrl: string | null
  orderIndex: number | null
  createdAt: string
  tags: string[]
  categories: string[]
  set: {
    id: number
    title: string
    subtitle: string
    coverImageUrl: string | null
    translations: {
      en: PictureTranslation
      zh: PictureTranslation
    }
  }
  translations: {
    en: PictureTranslation
    zh: PictureTranslation
  }
}

export async function GET(request: Request) {
  try {
    if (!PHOTOGRAPHY_STYLES.length) {
      return NextResponse.json({ styles: {} })
    }

    const { searchParams } = new URL(request.url)
    const styleParam = searchParams.get("style")
    const targetStyles = styleParam
      ? PHOTOGRAPHY_STYLES.filter((style) => style.id === styleParam)
      : PHOTOGRAPHY_STYLES

    if (!targetStyles.length) {
      return NextResponse.json({ styles: {} })
    }

    const desiredTagNames = targetStyles.map((style) => style.tagName)
    const { data: tagRows, error: tagErr } = await supabaseAdmin
      .from("tags")
      .select("id,name,type")
      .eq("type", "style")
      .in("name", desiredTagNames)

    if (tagErr) {
      return NextResponse.json({ error: tagErr.message }, { status: 500 })
    }

    const tagIdByStyle: Record<string, number> = {}
    for (const style of targetStyles) {
      const match = (tagRows || []).find((row) => String(row.name).toLowerCase() === style.tagName.toLowerCase())
      if (match?.id) {
        tagIdByStyle[style.id] = match.id
      }
    }

    const styleIds = targetStyles.map((style) => style.id)
    let taggingRows: any[] = []
    const tagIdList = Object.values(tagIdByStyle)
    if (tagIdList.length > 0) {
      const { data: rows, error: taggingsErr } = await supabaseAdmin
        .from("picture_taggings")
        .select("picture_id, tag_id")
        .in("tag_id", tagIdList)

      if (taggingsErr) {
        return NextResponse.json({ error: taggingsErr.message }, { status: 500 })
      }
      taggingRows = rows || []
    }

    const pictureIdsByStyle: Record<string, Set<number>> = {}
    for (const styleId of styleIds) {
      pictureIdsByStyle[styleId] = new Set<number>()
    }

    for (const row of taggingRows || []) {
      const tagId = (row as any).tag_id as number
      const pictureId = (row as any).picture_id as number
      if (!tagId || !pictureId) continue
      const styleEntry = Object.entries(tagIdByStyle).find(([, id]) => id === tagId)
      if (!styleEntry) continue
      const [styleId] = styleEntry
      pictureIdsByStyle[styleId]?.add(pictureId)
    }

    // Fallback：如果没有样式标签，尝试通过分类名称匹配
    const styleCategoryAliases: Record<string, Set<string>> = {}
    for (const style of targetStyles) {
      const alias = new Set<string>()
      alias.add(style.tagName.toLowerCase())
      if (style.labels?.en) alias.add(style.labels.en.toLowerCase())
      if (style.labels?.zh) alias.add(style.labels.zh.toLowerCase())
      styleCategoryAliases[style.id] = new Set(Array.from(alias).filter(Boolean))
    }

    const categoryIdsByStyle: Record<string, Set<number>> = {}
    for (const style of targetStyles) {
      categoryIdsByStyle[style.id] = new Set<number>()
    }

    {
      const { data: categoryRows } = await supabaseAdmin
        .from("categories")
        .select("id,name")

      const categoriesByAlias: Record<string, Set<number>> = {}
      for (const row of categoryRows || []) {
        const alias = String((row as any).name || "").toLowerCase().trim()
        if (!alias) continue
        if (!categoriesByAlias[alias]) categoriesByAlias[alias] = new Set<number>()
        if (Number.isFinite((row as any).id)) categoriesByAlias[alias].add((row as any).id as number)
      }

      for (const style of targetStyles) {
        const aliasSet = styleCategoryAliases[style.id]
        for (const name of aliasSet) {
          const ids = categoriesByAlias[name]
          if (!ids) continue
          for (const cid of ids) categoryIdsByStyle[style.id].add(cid)
        }
      }

      const allCategoryIds = Array.from(new Set(Object.values(categoryIdsByStyle).flatMap((set) => Array.from(set))))
      if (allCategoryIds.length > 0) {
        const { data: pictureCategoryRows } = await supabaseAdmin
          .from("picture_categories")
          .select("picture_id, category_id")
          .in("category_id", allCategoryIds)

        for (const row of pictureCategoryRows || []) {
          const pid = (row as any).picture_id as number
          const cid = (row as any).category_id as number
          if (!pid || !cid) continue
          for (const style of targetStyles) {
            if (categoryIdsByStyle[style.id].has(cid)) {
              pictureIdsByStyle[style.id]?.add(pid)
            }
          }
        }
      }
    }

    const candidateIdsByStyle: Record<string, number[]> = {}
    for (const styleId of styleIds) {
      const rawIds = Array.from(pictureIdsByStyle[styleId] || new Set<number>())
      candidateIdsByStyle[styleId] = rawIds
        .filter((id) => Number.isFinite(id) && id > 0)
        .slice(0, MAX_PICTURES_PER_STYLE * 3)
    }

    if (styleIds.includes(RECENT_STYLE_ID)) {
      const { data: recentRows, error: recentErr } = await supabaseAdmin
        .from("pictures")
        .select("id, image_url, is_published, created_at")
        .order("created_at", { ascending: false })
        .limit(MAX_PICTURES_PER_STYLE * 3)
      if (recentErr) {
        return NextResponse.json({ error: recentErr.message }, { status: 500 })
      }
      const recentIds = (recentRows || [])
        .filter((row: any) => row && row.image_url && row.is_published !== false)
        .map((row: any) => row.id as number)
        .filter((id: number) => Number.isFinite(id) && id > 0)
      candidateIdsByStyle[RECENT_STYLE_ID] = recentIds
    }

    const allPictureIds = Array.from(
      new Set(Object.values(candidateIdsByStyle).flat()),
    )

    if (allPictureIds.length === 0) {
      const empty = targetStyles.reduce<Record<string, { id: string; pictures: PicturePayload[] }>>((acc, style) => {
        acc[style.id] = { id: style.id, pictures: [] }
        return acc
      }, {})
      return NextResponse.json({ styles: empty })
    }

    const { data: pictureRows, error: picturesErr } = await supabaseAdmin
      .from("pictures")
      .select("id, picture_set_id, image_url, raw_image_url, title, subtitle, description, order_index, created_at, is_published")
      .in("id", allPictureIds)

    if (picturesErr) {
      return NextResponse.json({ error: picturesErr.message }, { status: 500 })
    }

    const publishedPictures = (pictureRows || []).filter((picture: any) => picture && picture.image_url && picture.is_published !== false)

    const pictureIdSet = new Set(publishedPictures.map((picture: any) => picture.id as number))
    const setIds = Array.from(new Set(publishedPictures.map((picture: any) => picture.picture_set_id as number)))

    let setRows: any[] = []
    if (setIds.length) {
      const { data: setsData, error: setErr } = await supabaseAdmin
        .from("picture_sets")
        .select("id, title, subtitle, cover_image_url, is_published")
        .in("id", setIds)
      if (setErr) {
        return NextResponse.json({ error: setErr.message }, { status: 500 })
      }
      setRows = (setsData || []).filter((set: any) => set && set.is_published !== false)
    }

    const publishedSetIds = new Set(setRows.map((set) => set.id as number))

    const filteredPictures = publishedPictures.filter((picture: any) => publishedSetIds.has(picture.picture_set_id as number))
    const filteredPictureIds = filteredPictures.map((picture: any) => picture.id as number)

    if (filteredPictureIds.length === 0) {
      const empty = targetStyles.reduce<Record<string, { id: string; pictures: PicturePayload[] }>>((acc, style) => {
        acc[style.id] = { id: style.id, pictures: [] }
        return acc
      }, {})
      return NextResponse.json({ styles: empty })
    }

    const [{ data: picEn }, { data: picZh }] = await Promise.all([
      supabaseAdmin
        .from("picture_translations")
        .select("picture_id, title, subtitle, description")
        .eq("locale", "en")
        .in("picture_id", filteredPictureIds),
      supabaseAdmin
        .from("picture_translations")
        .select("picture_id, title, subtitle, description")
        .eq("locale", "zh")
        .in("picture_id", filteredPictureIds),
    ])

    const { data: pictureTagRows } = await supabaseAdmin
      .from('picture_taggings')
      .select('picture_id, tag_id')
      .in('picture_id', filteredPictureIds)

    const tagIdSet = new Set<number>()
    for (const row of pictureTagRows || []) {
      const tagId = (row as any).tag_id as number
      if (Number.isFinite(tagId)) tagIdSet.add(tagId)
    }

    let tagById: Record<number, { name: string; type: string }> = {}
    if (tagIdSet.size > 0) {
      const { data: tagRows } = await supabaseAdmin
        .from('tags')
        .select('id,name,type')
        .in('id', Array.from(tagIdSet))
      for (const row of tagRows || []) {
        const id = (row as any).id as number
        if (!Number.isFinite(id)) continue
        tagById[id] = {
          name: String((row as any).name || ''),
          type: String((row as any).type || ''),
        }
      }
    }

    const pictureTransMap = new Map<number, { en: PictureTranslation; zh: PictureTranslation }>()
    for (const picture of filteredPictures) {
      pictureTransMap.set(picture.id as number, {
        en: { title: picture.title || "", subtitle: picture.subtitle || "", description: picture.description || "" },
        zh: { title: "", subtitle: "", description: "" },
      })
    }
    for (const row of picEn || []) {
      const entry = pictureTransMap.get((row as any).picture_id)
      if (entry) {
        entry.en = {
          title: (row as any).title || entry.en.title,
          subtitle: (row as any).subtitle || entry.en.subtitle,
          description: (row as any).description || entry.en.description,
        }
      }
    }

    const pictureTagsMap: Record<number, string[]> = {}
    for (const row of pictureTagRows || []) {
      const tagId = (row as any).tag_id as number
      const tagInfo = tagById[tagId]
      if (!tagInfo) continue
      const type = String(tagInfo.type || '').toLowerCase()
      if (type !== 'topic') continue
      const name = String(tagInfo.name || '').trim()
      if (!name) continue
      const pid = (row as any).picture_id as number
      const existing = new Set(pictureTagsMap[pid] || [])
      existing.add(name)
      pictureTagsMap[pid] = Array.from(existing)
    }

    const { data: pictureCategoryNameRows } = await supabaseAdmin
      .from('picture_categories')
      .select('picture_id, category:categories(name)')
      .in('picture_id', filteredPictureIds)

    const pictureCategoriesMap: Record<number, string[]> = {}
    for (const row of pictureCategoryNameRows || []) {
      const pid = (row as any).picture_id as number
      const name = String(((row as any).category as any)?.name || '').trim()
      if (!pid || !name) continue
      const existing = new Set(pictureCategoriesMap[pid] || [])
      existing.add(name)
      pictureCategoriesMap[pid] = Array.from(existing)
    }
    for (const row of picZh || []) {
      const entry = pictureTransMap.get((row as any).picture_id)
      if (entry) {
        entry.zh = {
          title: (row as any).title || entry.zh.title,
          subtitle: (row as any).subtitle || entry.zh.subtitle,
          description: (row as any).description || entry.zh.description,
        }
      }
    }

    const setIdsFiltered = Array.from(publishedSetIds)
    const [{ data: setEn }, { data: setZh }] = await Promise.all([
      supabaseAdmin
        .from("picture_set_translations")
        .select("picture_set_id, title, subtitle, description")
        .eq("locale", "en")
        .in("picture_set_id", setIdsFiltered),
      supabaseAdmin
        .from("picture_set_translations")
        .select("picture_set_id, title, subtitle, description")
        .eq("locale", "zh")
        .in("picture_set_id", setIdsFiltered),
    ])

    const setTransMap = new Map<number, { en: PictureTranslation; zh: PictureTranslation }>()
    for (const setRow of setRows) {
      setTransMap.set(setRow.id as number, {
        en: { title: setRow.title || "", subtitle: setRow.subtitle || "", description: setRow.description || "" },
        zh: { title: "", subtitle: "", description: "" },
      })
    }
    for (const row of setEn || []) {
      const entry = setTransMap.get((row as any).picture_set_id)
      if (entry) {
        entry.en = {
          title: (row as any).title || entry.en.title,
          subtitle: (row as any).subtitle || entry.en.subtitle,
          description: (row as any).description || entry.en.description,
        }
      }
    }
    for (const row of setZh || []) {
      const entry = setTransMap.get((row as any).picture_set_id)
      if (entry) {
        entry.zh = {
          title: (row as any).title || entry.zh.title,
          subtitle: (row as any).subtitle || entry.zh.subtitle,
          description: (row as any).description || entry.zh.description,
        }
      }
    }

    const setById = new Map<number, any>()
    for (const setRow of setRows) {
      setById.set(setRow.id as number, setRow)
    }

    const picturesByStyle: Record<string, PicturePayload[]> = {}
    for (const styleId of styleIds) {
      const idsForStyle = candidateIdsByStyle[styleId] || []
      const payload: PicturePayload[] = []
      for (const pictureId of idsForStyle) {
        if (!pictureIdSet.has(pictureId)) continue
        const picture = filteredPictures.find((p: any) => p.id === pictureId)
        if (!picture) continue
        const relatedSet = setById.get(picture.picture_set_id as number)
        if (!relatedSet) continue
        const translationEntry = pictureTransMap.get(picture.id as number)
        const setTranslation = setTransMap.get(relatedSet.id as number)
      payload.push({
        id: picture.id as number,
        pictureSetId: relatedSet.id as number,
        imageUrl: picture.image_url as string,
        rawImageUrl: picture.raw_image_url || null,
        orderIndex: picture.order_index ?? null,
        createdAt: String(picture.created_at || ''),
        tags: pictureTagsMap[picture.id as number] || [],
        categories: pictureCategoriesMap[picture.id as number] || [],
        set: {
          id: relatedSet.id as number,
          title: relatedSet.title || "",
            subtitle: relatedSet.subtitle || "",
            coverImageUrl: relatedSet.cover_image_url || null,
            translations: {
              en: setTranslation?.en || { title: relatedSet.title || "", subtitle: relatedSet.subtitle || "", description: relatedSet.description || "" },
              zh: setTranslation?.zh || { title: "", subtitle: "", description: "" },
            },
          },
          translations: {
            en: translationEntry?.en || { title: picture.title || "", subtitle: picture.subtitle || "", description: picture.description || "" },
            zh: translationEntry?.zh || { title: "", subtitle: "", description: "" },
          },
        })
      }
      payload.sort((a, b) => {
        const dateDiff = safeTime(b.createdAt) - safeTime(a.createdAt)
        if (dateDiff !== 0) return dateDiff
        return (b.orderIndex ?? 0) - (a.orderIndex ?? 0)
      })
      picturesByStyle[styleId] = payload.slice(0, MAX_PICTURES_PER_STYLE)
    }

    const response = targetStyles.reduce<Record<string, { id: string; tagName: string; pictures: PicturePayload[] }>>((acc, style) => {
      acc[style.id] = {
        id: style.id,
        tagName: style.tagName,
        pictures: picturesByStyle[style.id] || [],
      }
      return acc
    }, {})

    return NextResponse.json({ styles: response })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
  }
}
