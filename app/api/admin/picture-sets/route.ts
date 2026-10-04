import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { PHOTOGRAPHY_STYLES, PHOTOGRAPHY_STYLE_BY_ID, PHOTOGRAPHY_TAG_NAME_TO_ID } from "@/lib/photography-styles"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { triggerPictureEmbeddingBackfill } from "@/utils/picture-embeddings.server"
export const runtime = 'nodejs'

// --- Translation helpers (server-side bi-directional) ---
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const port = process.env.PORT || 3000
  return `http://localhost:${port}`
}

async function translateText(text: string, target: 'en' | 'zh'): Promise<string> {
  try {
    if (!text || !text.trim()) return ''
    const res = await fetch(`${getBaseUrl()}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang: 'auto', targetLang: target }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.translated as string) || ''
  } catch {
    return ''
  }
}

const looksZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))

function chooseLocalizedValue(existing: string, next: string, locale: 'en' | 'zh') {
  const current = String(existing || '').trim()
  const candidate = String(next || '').trim()
  if (!candidate) return current
  if (!current) return candidate
  if (locale === 'zh' && !looksZh(current) && looksZh(candidate)) return candidate
  if (locale === 'en' && looksZh(current) && !looksZh(candidate)) return candidate
  return current
}

async function asyncPool<T, R>(
  limit: number,
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = nextIndex++
      if (idx >= items.length) break
      results[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
  return results
}

async function upsertSetTranslationsRaw(picture_set_id: number, payload: any) {
  const en = payload?.en
  const zh = payload?.zh
  const ops: any[] = []
  if (en) {
    ops.push(
      supabaseAdmin.from('picture_set_translations').upsert(
        { picture_set_id, locale: 'en', title: en.title || '', subtitle: en.subtitle || null, description: en.description || null },
        { onConflict: 'picture_set_id,locale' },
      )
    )
  }
  if (zh) {
    ops.push(
      supabaseAdmin.from('picture_set_translations').upsert(
        { picture_set_id, locale: 'zh', title: zh.title || '', subtitle: zh.subtitle || null, description: zh.description || null },
        { onConflict: 'picture_set_id,locale' },
      )
    )
  }
  if (ops.length) await Promise.all(ops)
}

async function upsertPictureTranslationsRaw(picture_id: number, p: any) {
  const en = p?.en
  const zh = p?.zh
  const ops: any[] = []
  if (en) {
    ops.push(
      supabaseAdmin.from('picture_translations').upsert(
        { picture_id, locale: 'en', title: en.title || '', subtitle: en.subtitle || null, description: en.description || null },
        { onConflict: 'picture_id,locale' },
      )
    )
  }
  if (zh) {
    ops.push(
      supabaseAdmin.from('picture_translations').upsert(
        { picture_id, locale: 'zh', title: zh.title || '', subtitle: zh.subtitle || null, description: zh.description || null },
        { onConflict: 'picture_id,locale' },
      )
    )
  }
  if (ops.length) await Promise.all(ops)
}

function triggerAsyncEnrich(picture_set_id: number, payload: any, authorization?: string | null) {
  const url = `${getBaseUrl()}/api/admin/picture-sets/${picture_set_id}/enrich`
  const body = JSON.stringify({ ...payload, async_enrich: false })
  queueMicrotask(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authorization) headers.Authorization = authorization
    fetch(url, { method: 'POST', headers, body }).catch((err) => {
      console.error('Async enrich trigger failed:', err)
    })
  })
}

async function fillSetTranslationsBi(payload: any): Promise<{ en: any; zh: any }> {
  console.log('🔧 fillSetTranslationsBi received payload.en:', payload.en)
  console.log('🔧 fillSetTranslationsBi received payload.zh:', payload.zh)
  
  const base = {
    title: payload.title || '',
    subtitle: payload.subtitle || '',
    description: payload.description || '',
  }
  const enOut: any = {
    title: payload.en?.title || '',
    subtitle: payload.en?.subtitle || '',
    description: payload.en?.description || '',
  }
  const zhOut: any = {
    title: payload.zh?.title || '',
    subtitle: payload.zh?.subtitle || '',
    description: payload.zh?.description || '',
  }
  
  console.log('🔧 Initial enOut:', enOut)
  console.log('🔧 Initial zhOut:', zhOut)

  for (const key of ['title', 'subtitle', 'description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (looksZh(b)) {
        zhVal = b
        enVal = await translateText(b, 'en')
      } else {
        enVal = b
        zhVal = await translateText(b, 'zh')
      }
    } else if (!enVal && zhVal) {
      enVal = await translateText(zhVal, 'en')
    } else if (!zhVal && enVal) {
      zhVal = await translateText(enVal, 'zh')
    }
    enOut[key] = enVal
    zhOut[key] = zhVal
  }

  console.log('🔧 Final enOut:', enOut)
  console.log('🔧 Final zhOut:', zhOut)
  
  return { en: enOut, zh: zhOut }
}

async function fillPictureTranslationsBi(p: any): Promise<{ en: any; zh: any }> {
  const base = {
    title: p.title || '',
    subtitle: p.subtitle || '',
    description: p.description || '',
  }
  const enOut: any = {
    title: p.en?.title || '',
    subtitle: p.en?.subtitle || '',
    description: p.en?.description || '',
  }
  const zhOut: any = {
    title: p.zh?.title || '',
    subtitle: p.zh?.subtitle || '',
    description: p.zh?.description || '',
  }

  for (const key of ['title', 'subtitle', 'description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (looksZh(b)) {
        zhVal = b
        enVal = await translateText(b, 'en')
      } else {
        enVal = b
        zhVal = await translateText(b, 'zh')
      }
    } else if (!enVal && zhVal) {
      enVal = await translateText(zhVal, 'en')
    } else if (!zhVal && enVal) {
      zhVal = await translateText(enVal, 'zh')
    }
    enOut[key] = enVal
    zhOut[key] = zhVal
  }

  return { en: enOut, zh: zhOut }
}

async function fillPictureTitleSubtitleLocales(
  p: any,
): Promise<void> {
  const enOut: any = { ...(p.en || {}) }
  const zhOut: any = { ...(p.zh || {}) }

  for (const key of ['title', 'subtitle'] as const) {
    const base = String(p[key] || '').trim()
    let enVal = String(enOut[key] || '').trim()
    let zhVal = String(zhOut[key] || '').trim()

    if (!enVal && !zhVal && base) {
      if (looksZh(base)) zhVal = base
      else enVal = base
    }

    if (!enVal && !zhVal) continue

    if (!enVal && zhVal) enVal = await translateText(zhVal, 'en')
    if (!zhVal && enVal) zhVal = await translateText(enVal, 'zh')

    enOut[key] = enVal
    zhOut[key] = zhVal
  }

  p.en = enOut
  p.zh = zhOut
}

async function fillSetTitleSubtitleLocales(payload: any): Promise<void> {
  const enOut: any = { ...(payload.en || {}) }
  const zhOut: any = { ...(payload.zh || {}) }

  for (const key of ['title', 'subtitle'] as const) {
    const base = String(payload[key] || '').trim()
    let enVal = String(enOut[key] || '').trim()
    let zhVal = String(zhOut[key] || '').trim()

    if (!enVal && !zhVal && base) {
      if (looksZh(base)) zhVal = base
      else enVal = base
    }

    if (!enVal && !zhVal) continue

    if (!enVal && zhVal) enVal = await translateText(zhVal, 'en')
    if (!zhVal && enVal) zhVal = await translateText(enVal, 'zh')

    enOut[key] = enVal
    zhOut[key] = zhVal
  }

  payload.en = enOut
  payload.zh = zhOut
}

// 简化的工具：确保若干 tag 存在并返回它们的 id（按 type + slug 去重）
async function ensureTagIds(names: string[] = [], type: string = 'topic'): Promise<number[]> {
  const uniq = Array.from(new Set(names.map(n => String(n || '').trim()).filter(Boolean)))
  if (uniq.length === 0) return []
  const toInsert = uniq.map(name => ({
    name,
    type,
    // 加上 type 前缀以避免不同类型同名产生 slug 冲突
    slug: `${type}:${name.toLowerCase().replace(/\s+/g, '-')}`,
  }))
  // 尝试 upsert，若失败也不阻断后续 select
  await supabaseAdmin.from('tags').upsert(toInsert, { onConflict: 'slug' })
  const { data, error } = await supabaseAdmin
    .from('tags')
    .select('id, name')
    .in('name', uniq)
    .eq('type', type)
  if (error) throw error
  return (data || []).map(d => d.id)
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const payload = await request.json()
    const asyncEnrich = !!payload.async_enrich
    const autoFillLocalesAll = !!payload.auto_fill_locales_all
    const setRow = {
      title: payload.title || "",
      subtitle: payload.subtitle || "",
      description: payload.description || "",
      cover_image_url: payload.cover_image_url || null,
      cover_image_variants: payload.cover_image_variants || {},
      position: payload.position || "up",
      is_published: payload.is_published ?? true,
      primary_category_id: payload.primary_category_id ?? null,
      season_id: payload.season_id ?? null,
    }

    const { data: inserted, error: setErr } = await supabaseAdmin
      .from("picture_sets")
      .insert(setRow)
      .select("id")
      .single()

    if (setErr) {
      return NextResponse.json({ error: setErr.message }, { status: 400 })
    }

    const picture_set_id = inserted!.id as number

    const pictures: any[] = Array.isArray(payload.pictures) ? payload.pictures : []
    // 可选：根据 set 的 flags 传播季节/地点到图片
    let singleSeasonId: number | null = null
    const seasonIds: number[] = Array.isArray(payload.season_ids) ? payload.season_ids : []
    if (seasonIds.length === 1) singleSeasonId = seasonIds[0]
    const allowApplySetProps = !!(payload.fill_missing_from_set ?? payload.apply_set_props_to_pictures)
    const allowOverride = !!payload.override_existing_picture_props

    const autoGen = !!payload.autogen_titles_subtitles
    const bucketBaseUrl = process.env.NEXT_PUBLIC_BUCKET_URL || ''
    const makePublicUrl = (path?: string | null): string => {
      if (!path || !path.trim()) return ''
      if (/^https?:/i.test(path)) return path
      if (!bucketBaseUrl) return ''
      return `${bucketBaseUrl}${path}`
    }
    const serverAnalyze = async (imgUrl: string, type: 'title' | 'subtitle'): Promise<string> => {
      if (!imgUrl) return ''
      try {
        const res = await fetch(`${getBaseUrl()}/api/analyze-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: imgUrl, analysisType: type }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.success) return String(data.result || '').trim()
      } catch {}
      return ''
    }

    if (autoGen && !asyncEnrich) {
      await fillSetTitleSubtitleLocales(payload)
    }

    if (pictures.length > 0) {
      let insertedPictureIds: number[] = []
      const rows = pictures
        .filter((p: any) => typeof p.image_url === 'string' && p.image_url.length > 0)
        .map((p: any, idx: number) => ({
        picture_set_id,
        order_index: idx,
        title: p.title || "",
        subtitle: p.subtitle || "",
        description: p.description || "",
        image_url: p.image_url || null,
        raw_image_url: p.raw_image_url || null,
        image_variants: p.image_variants || {},
        season_id: (allowApplySetProps
          ? (allowOverride ? (singleSeasonId ?? p.season_id ?? null)
            : (p.season_id ?? (singleSeasonId ?? null)))
          : (p.season_id ?? null)),
      }))
      const { error: picErr } = await supabaseAdmin.from("pictures").insert(rows)
      if (picErr) {
        return NextResponse.json({ id: picture_set_id, error: picErr.message }, { status: 400 })
      }

      // 重新读取确保按 order_index 对齐
      const { data: allPics } = await supabaseAdmin
        .from('pictures')
        .select('id, order_index')
        .eq('picture_set_id', picture_set_id)
        .order('order_index', { ascending: true })
      const picIdByIndex: number[] = (allPics || [])
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((r: any) => r.id)
      insertedPictureIds = picIdByIndex

      // --- 每张图片：可选 AI 生成标题/副标题 + 翻译、标签、位置 ---
      // 预备 set 级别的 typed tags
      const setTags: string[] = Array.isArray(payload.tags) ? payload.tags : []
      let categoryTagIds: number[] = []
      let seasonTagIds: number[] = []
      // 来自多选 category_ids
      const categoryIds: number[] = Array.isArray(payload.category_ids) ? payload.category_ids : []
      if (categoryIds.length > 0) {
        const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', categoryIds)
        const names = (catRows || []).map((r: any) => r.name).filter(Boolean)
        categoryTagIds = await ensureTagIds(names, 'category')
      }
      // 来自多选 season_ids
      if (seasonIds.length > 0) {
        const { data: seaRows } = await supabaseAdmin.from('seasons').select('id,name').in('id', seasonIds)
        const names = (seaRows || []).map((r: any) => r.name).filter(Boolean)
        seasonTagIds = await ensureTagIds(names, 'season')
      }
      const topicTagIds = await ensureTagIds(setTags || [], 'topic')
      const setCombinedTagIds = Array.from(new Set([...(topicTagIds || []), ...(categoryTagIds || []), ...(seasonTagIds || [])]))

      // 设置 picture_set_taggings（typed tags）
      if (setCombinedTagIds.length) {
        const rows = setCombinedTagIds.map((tid: number) => ({ picture_set_id, tag_id: tid }))
        await supabaseAdmin.from('picture_set_taggings').insert(rows)
      }

      // 设置 picture_set_categories（多选分类，主分类置 is_primary=true）
      const selectedCategoryIds: number[] = Array.isArray(payload.category_ids)
        ? (Array.from(new Set(payload.category_ids as number[])) as number[])
        : []
      if (selectedCategoryIds.length) {
        const rows = selectedCategoryIds.map((cid: number) => ({ picture_set_id, category_id: cid, is_primary: cid === (payload.primary_category_id ?? null) }))
        await supabaseAdmin.from('picture_set_categories').insert(rows)
      }

      // set 翻译：仅在显式启用时自动补全，否则只保存手填内容
      try {
        if (autoFillLocalesAll && !asyncEnrich) {
          const filled = await fillSetTranslationsBi(payload)
          await supabaseAdmin
            .from('picture_set_translations')
            .upsert(
              { picture_set_id, locale: 'en', title: filled.en.title || '', subtitle: filled.en.subtitle || null, description: filled.en.description || null },
              { onConflict: 'picture_set_id,locale' },
            )
          await supabaseAdmin
            .from('picture_set_translations')
            .upsert(
              { picture_set_id, locale: 'zh', title: filled.zh.title || '', subtitle: filled.zh.subtitle || null, description: filled.zh.description || null },
              { onConflict: 'picture_set_id,locale' },
            )
        } else {
          await upsertSetTranslationsRaw(picture_set_id, payload)
        }
      } catch {}

      // set 主位置
      const nm = (payload.primary_location_name || '').trim()
      const lat = typeof payload.primary_location_latitude === 'number' ? payload.primary_location_latitude : null
      const lng = typeof payload.primary_location_longitude === 'number' ? payload.primary_location_longitude : null
      if (nm && typeof lat === 'number' && typeof lng === 'number') {
        let locationId: number | undefined
        const { data: found } = await supabaseAdmin
          .from('locations')
          .select('id')
          .eq('name', nm)
          .eq('latitude', lat)
          .eq('longitude', lng)
          .maybeSingle()
        if (found?.id) locationId = found.id
        else {
          const { data: created, error: locErr } = await supabaseAdmin
            .from('locations')
            .insert({ name: nm, latitude: lat, longitude: lng })
            .select('id')
            .single()
          if (locErr) throw locErr
          locationId = created!.id
        }
        if (locationId) {
          await supabaseAdmin.from('picture_set_locations').insert({ picture_set_id, location_id: locationId, is_primary: true })
        }
      }

      // picture 扩展：翻译、类型标签、主位置、分类（picture_categories）
      const propagateCategories = !!payload.propagate_categories_to_pictures
      const styleTagIdCache: Record<string, number | null> = {}
      const locCache = new Map<string, number>()
      const concurrency = Math.max(1, Math.min(6, Number(process.env.PICTURE_JOB_CONCURRENCY || 4)))

      await asyncPool(concurrency, pictures, async (p, i) => {
        const picture_id = picIdByIndex[i]
        if (!picture_id) return

        // 自动补齐图片标题/副标题的双语翻译；两侧都空时才用图片 AI 生成。
        try {
          if (autoGen && !asyncEnrich) {
            await fillPictureTitleSubtitleLocales(p)
          }
        } catch {}

        const tasks: Promise<any>[] = []

        // 翻译：仅在显式启用时自动补全，否则只保存手填内容
        tasks.push((async () => {
          try {
            if (autoFillLocalesAll && !asyncEnrich) {
              const filled = await fillPictureTranslationsBi(p)
              await Promise.all([
                supabaseAdmin
                  .from('picture_translations')
                  .upsert(
                    { picture_id, locale: 'en', title: filled.en.title || '', subtitle: filled.en.subtitle || null, description: filled.en.description || null },
                    { onConflict: 'picture_id,locale' },
                  ),
                supabaseAdmin
                  .from('picture_translations')
                  .upsert(
                    { picture_id, locale: 'zh', title: filled.zh.title || '', subtitle: filled.zh.subtitle || null, description: filled.zh.description || null },
                    { onConflict: 'picture_id,locale' },
                  ),
              ])
            } else {
              await upsertPictureTranslationsRaw(picture_id, p)
            }
          } catch {}
        })())

        // 类型标签：图片自己的 topic tags + per-picture categories；可选传播 set 的 category/season tags
        tasks.push((async () => {
          const pictureTopicTags: string[] = Array.isArray(p.tags) ? p.tags : []
          const pTopicIds = await ensureTagIds(pictureTopicTags, 'topic')
          let pCatTagIds: number[] = []
          const picCatIds = Array.isArray(p.picture_category_ids) ? p.picture_category_ids : []
          if (picCatIds.length > 0) {
            const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', picCatIds)
            const names = (catRows || []).map((r: any) => r.name).filter(Boolean)
            pCatTagIds = await ensureTagIds(names, 'category')
          }
          if (propagateCategories) {
            pCatTagIds = Array.from(new Set([...(pCatTagIds || []), ...(categoryTagIds || []), ...(seasonTagIds || [])]))
          }
          let styleTagIds: number[] = []
          const styleKey = typeof p.style === 'string' ? p.style : ''
          if (styleKey && PHOTOGRAPHY_STYLE_BY_ID[styleKey as keyof typeof PHOTOGRAPHY_STYLE_BY_ID]) {
            const tagName = PHOTOGRAPHY_STYLE_BY_ID[styleKey as keyof typeof PHOTOGRAPHY_STYLE_BY_ID].tagName
            const cached = styleTagIdCache[styleKey]
            if (typeof cached === 'number') {
              styleTagIds = [cached]
            } else {
              const ensured = await ensureTagIds([tagName], 'style')
              const firstId = ensured[0] ?? null
              styleTagIdCache[styleKey] = firstId
              if (typeof firstId === 'number') styleTagIds = [firstId]
            }
          }
          const combined = Array.from(new Set([...(pTopicIds || []), ...(pCatTagIds || []), ...(styleTagIds || [])]))
          if (combined.length) {
            const rows = combined.map((tid: number) => ({ picture_id, tag_id: tid }))
            await supabaseAdmin.from('picture_taggings').insert(rows)
          }
        })())

        // 主位置（若提供）
        tasks.push((async () => {
          const lnm = (p.location_name || '').trim()
          const llat = typeof p.location_latitude === 'number' ? p.location_latitude : null
          const llng = typeof p.location_longitude === 'number' ? p.location_longitude : null
          if (lnm && typeof llat === 'number' && typeof llng === 'number') {
            const cacheKey = `${lnm}|${llat}|${llng}`
            let locId = locCache.get(cacheKey)
            if (!locId) {
              const { data: found } = await supabaseAdmin
                .from('locations')
                .select('id')
                .eq('name', lnm)
                .eq('latitude', llat)
                .eq('longitude', llng)
                .maybeSingle()
              if (found?.id) locId = found.id
              else {
                const { data: created, error: locErr } = await supabaseAdmin
                  .from('locations')
                  .insert({ name: lnm, latitude: llat, longitude: llng })
                  .select('id')
                  .single()
                if (locErr) throw locErr
                locId = created!.id
              }
              if (locId) locCache.set(cacheKey, locId)
            }
            if (locId) await supabaseAdmin.from('picture_locations').insert({ picture_id, location_id: locId, is_primary: true })
          }
        })())

        // 分类（picture_categories）：按勾选保存
        tasks.push((async () => {
          const pCatIdsRaw: number[] = Array.isArray(p.picture_category_ids) ? (p.picture_category_ids as number[]) : []
          let pCatCats = Array.from(new Set(pCatIdsRaw)) as number[]
          if (propagateCategories) {
            const setCats: number[] = Array.isArray(payload.category_ids)
              ? (Array.from(new Set(payload.category_ids as number[])) as number[])
              : []
            pCatCats = Array.from(new Set([...(pCatCats || []), ...(setCats || [])])) as number[]
          }
          if (pCatCats.length) {
            const rows = pCatCats.map((cid: number) => ({ picture_id, category_id: cid, is_primary: false }))
            await supabaseAdmin.from('picture_categories').insert(rows)
          }
        })())

        await Promise.all(tasks)
      })

      triggerPictureEmbeddingBackfill(insertedPictureIds)
    }

    // sections 赋值：payload.section_ids + 根据 position 推断的一个默认 section（若存在）
    let desiredSectionIds: number[] = Array.isArray(payload.section_ids) ? Array.from(new Set(payload.section_ids)) : []
    try {
      const { data: secs } = await supabaseAdmin.from('sections').select('id,name')
      const findBy = (want: 'up' | 'down') => {
        const re = want === 'down' ? /\bdown\b|bottom|下|底/i : /\bup\b|top|上|顶/i
        return (secs || []).find((s: any) => re.test(String(s.name || '')))?.id as number | undefined
      }
      const pos = String(payload.position || '').trim().toLowerCase()
      const autoId = pos === 'down' ? findBy('down') : findBy('up')
      if (autoId && !desiredSectionIds.includes(autoId)) desiredSectionIds = [...desiredSectionIds, autoId]
      if (desiredSectionIds.length) {
        const rows = desiredSectionIds.map((id: number) => ({ picture_set_id, section_id: id, page_context: 'default', display_order: 0 }))
        await supabaseAdmin.from('picture_set_section_assignments').insert(rows)
      }
    } catch {}

    if (asyncEnrich) {
      triggerAsyncEnrich(picture_set_id, payload, request.headers.get("authorization"))
    }
    return NextResponse.json({ id: picture_set_id })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

// 服务端读取：列表 + 搜索（包含每个 set 的精简图片列表）
export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    let sets: any[] = []
    if (q.length === 0) {
      const { data, error } = await supabaseAdmin
        .from('picture_sets')
        .select('*')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      sets = data || []
    } else {
      // 优先 FTS
      const fts = await supabaseAdmin
        .from('picture_sets')
        .select('*')
        .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
        .order('updated_at', { ascending: false })
        .limit(200)
      if (fts.error) {
        // 退回到 search_text AND 检索
        const terms = q.split(/\s+/).filter(Boolean)
        let builder: any = supabaseAdmin.from('picture_sets').select('*')
        for (const t of terms) builder = builder.ilike('search_text', `%${t}%`)
        const { data, error } = await builder.order('updated_at', { ascending: false }).limit(200)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        sets = data || []
      } else {
        sets = fts.data || []
      }
    }

    const ids = sets.map((s: any) => s.id)
    let picsBySet: Record<number, any[]> = {}
    const translationsBySet: Record<number, { en?: any; zh?: any }> = {}
    if (ids.length) {
      const [{ data: pics }, { data: translations }] = await Promise.all([
        supabaseAdmin
          .from('pictures')
          .select('id,picture_set_id,order_index,image_url,title,subtitle,description')
          .in('picture_set_id', ids),
        supabaseAdmin
          .from('picture_set_translations')
          .select('picture_set_id,locale,title,subtitle,description')
          .in('picture_set_id', ids),
      ])
      for (const p of pics || []) {
        const sid = (p as any).picture_set_id
        picsBySet[sid] = [...(picsBySet[sid] || []), p]
      }
      for (const row of translations || []) {
        const sid = (row as any).picture_set_id
        const locale = (row as any).locale === 'zh' ? 'zh' : 'en'
        const existing = translationsBySet[sid]?.[locale] || {}
        translationsBySet[sid] = {
          ...(translationsBySet[sid] || {}),
          [locale]: {
            title: chooseLocalizedValue(existing.title || '', (row as any).title || '', locale),
            subtitle: chooseLocalizedValue(existing.subtitle || '', (row as any).subtitle || '', locale),
            description: chooseLocalizedValue(existing.description || '', (row as any).description || '', locale),
          },
        }
      }
      for (const sid of Object.keys(picsBySet)) {
        picsBySet[Number(sid)] = (picsBySet[Number(sid)] || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      }
    }

    const out = sets.map((s: any) => ({
      ...s,
      en: translationsBySet[s.id]?.en || { title: '', subtitle: '', description: '' },
      zh: translationsBySet[s.id]?.zh || { title: '', subtitle: '', description: '' },
      pictures: picsBySet[s.id] || [],
    }))
    return NextResponse.json({ items: out })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
