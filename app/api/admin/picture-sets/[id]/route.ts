import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { PHOTOGRAPHY_STYLE_BY_ID, PHOTOGRAPHY_TAG_NAME_TO_ID } from "@/lib/photography-styles"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { collectImageAssetKeys, deleteObjectKeysFromR2 } from "@/utils/r2-assets.server"
import { triggerPictureEmbeddingBackfill } from "@/utils/picture-embeddings.server"

export const runtime = 'nodejs'

// Helpers
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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sourceLang: 'auto', targetLang: target })
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (data.translated as string) || ''
  } catch { return '' }
}

const looksZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))

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
  console.log('🔧 [PUT] fillSetTranslationsBi received payload.en:', payload.en)
  console.log('🔧 [PUT] fillSetTranslationsBi received payload.zh:', payload.zh)
  
  const base = { title: payload.title || '', subtitle: payload.subtitle || '', description: payload.description || '' }
  const enOut: any = { title: payload.en?.title || '', subtitle: payload.en?.subtitle || '', description: payload.en?.description || '' }
  const zhOut: any = { title: payload.zh?.title || '', subtitle: payload.zh?.subtitle || '', description: payload.zh?.description || '' }
  
  console.log('🔧 [PUT] Initial enOut:', enOut)
  console.log('🔧 [PUT] Initial zhOut:', zhOut)
  
  for (const key of ['title','subtitle','description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (looksZh(b)) { zhVal = b; enVal = await translateText(b, 'en') } else { enVal = b; zhVal = await translateText(b, 'zh') }
    } else if (!enVal && zhVal) { enVal = await translateText(zhVal, 'en') }
    else if (!zhVal && enVal) { zhVal = await translateText(enVal, 'zh') }
    enOut[key] = enVal; zhOut[key] = zhVal
  }
  console.log('🔧 [PUT] Final enOut:', enOut)
  console.log('🔧 [PUT] Final zhOut:', zhOut)
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
  for (const key of ['title','subtitle','description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (looksZh(b)) { zhVal = b; enVal = await translateText(b, 'en') }
      else { enVal = b; zhVal = await translateText(b, 'zh') }
    } else if (!enVal && zhVal) {
      enVal = await translateText(zhVal, 'en')
    } else if (!zhVal && enVal) {
      zhVal = await translateText(enVal, 'zh')
    }
    enOut[key] = enVal; zhOut[key] = zhVal
  }
  return { en: enOut, zh: zhOut }
}

async function fillPictureTitleSubtitleLocales(
  p: any,
): Promise<void> {
  const enOut: any = { ...(p.en || {}) }
  const zhOut: any = { ...(p.zh || {}) }

  for (const key of ['title','subtitle'] as const) {
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

  for (const key of ['title','subtitle'] as const) {
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

async function ensureTagIds(names: string[] = [], type: string = 'topic'): Promise<number[]> {
  const uniq = Array.from(new Set(names.map(n => String(n || '').trim()).filter(Boolean)))
  if (uniq.length === 0) return []
  const toInsert = uniq.map(name => ({ name, type, slug: `${type}:${name.toLowerCase().replace(/\s+/g,'-')}` }))
  await supabaseAdmin.from('tags').upsert(toInsert, { onConflict: 'slug' })
  const { data } = await supabaseAdmin.from('tags').select('id,name').in('name', uniq).eq('type', type)
  return (data || []).map(d => d.id)
}

async function runMutation(label: string, query: any) {
  const { error } = await query
  if (error) {
    throw new Error(`${label} failed: ${error.message}`)
  }
}

async function deletePictureRows(pictureIds: number[]) {
  if (!pictureIds.length) return

  await runMutation('delete picture embeddings', supabaseAdmin.from('picture_embeddings').delete().in('picture_id', pictureIds))
  await runMutation('delete picture likes', supabaseAdmin.from('picture_likes').delete().in('picture_id', pictureIds))
  await runMutation('delete picture comments', supabaseAdmin.from('picture_comments').delete().in('picture_id', pictureIds))
  await runMutation('delete picture participants', supabaseAdmin.from('picture_participants').delete().in('picture_id', pictureIds))
  await runMutation('delete picture section assignments', supabaseAdmin.from('picture_section_assignments').delete().in('picture_id', pictureIds))
  await runMutation('delete picture taggings', supabaseAdmin.from('picture_taggings').delete().in('picture_id', pictureIds))
  await runMutation('delete picture categories', supabaseAdmin.from('picture_categories').delete().in('picture_id', pictureIds))
  await runMutation('delete picture locations', supabaseAdmin.from('picture_locations').delete().in('picture_id', pictureIds))
  await runMutation('delete picture translations', supabaseAdmin.from('picture_translations').delete().in('picture_id', pictureIds))
  await runMutation('delete pictures', supabaseAdmin.from('pictures').delete().in('id', pictureIds))
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const idNum = Number(ctx.params.id)
    if (!Number.isFinite(idNum) || idNum <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { data: setRow, error: setErr } = await supabaseAdmin.from('picture_sets').select('*').eq('id', idNum).single()
    if (setErr || !setRow) return NextResponse.json({ error: setErr?.message || 'Not found' }, { status: 404 })

    const [{ data: enT }, { data: zhT }] = await Promise.all([
      supabaseAdmin.from('picture_set_translations').select('title,subtitle,description').eq('picture_set_id', idNum).eq('locale','en').maybeSingle(),
      supabaseAdmin.from('picture_set_translations').select('title,subtitle,description').eq('picture_set_id', idNum).eq('locale','zh').maybeSingle(),
    ])

    const [{ data: secAssigns }, { data: catAssigns }] = await Promise.all([
      supabaseAdmin.from('picture_set_section_assignments').select('section_id').eq('picture_set_id', idNum),
      supabaseAdmin.from('picture_set_categories').select('category_id').eq('picture_set_id', idNum),
    ])
    const section_ids = (secAssigns || []).map(r => (r as any).section_id as number)
    const category_ids = (catAssigns || []).map(r => (r as any).category_id as number)

    // primary location via two-step
    let primary_location_name: string | undefined
    let primary_location_latitude: number | null = null
    let primary_location_longitude: number | null = null
    const { data: setLocRow } = await supabaseAdmin.from('picture_set_locations').select('location_id').eq('picture_set_id', idNum).eq('is_primary', true).maybeSingle()
    const setLocationId = (setLocRow as any)?.location_id as number | undefined
    if (setLocationId) {
      const { data: loc } = await supabaseAdmin.from('locations').select('name,latitude,longitude').eq('id', setLocationId).maybeSingle()
      if (loc) { primary_location_name = (loc as any).name; primary_location_latitude = (loc as any).latitude ?? null; primary_location_longitude = (loc as any).longitude ?? null }
    }

    // set tags (topic names)
    let setTags: string[] = []
    const { data: setTagRows } = await supabaseAdmin.from('picture_set_taggings').select('tag_id').eq('picture_set_id', idNum)
    if (setTagRows?.length) {
      const tagIds = Array.from(new Set((setTagRows as any[]).map(r => (r as any).tag_id).filter(Boolean)))
      if (tagIds.length) {
        const { data: tags } = await supabaseAdmin.from('tags').select('id,name,type').in('id', tagIds)
        setTags = (tags || []).filter((t: any) => String(t.type || '') === 'topic').map((t: any) => String(t.name || '')).filter(Boolean)
      }
    }

    // pictures and related info
    const { data: pictures, error: picErr } = await supabaseAdmin.from('pictures').select('*').eq('picture_set_id', idNum).order('order_index', { ascending: true })
    if (picErr) return NextResponse.json({ error: picErr.message }, { status: 400 })
    const picIds = (pictures || []).map(p => p.id)
    const [pen, pzh, pcat, ptagRows, pLocRows] = await Promise.all([
      supabaseAdmin.from('picture_translations').select('picture_id,title,subtitle,description').eq('locale','en').in('picture_id', picIds),
      supabaseAdmin.from('picture_translations').select('picture_id,title,subtitle,description').eq('locale','zh').in('picture_id', picIds),
      supabaseAdmin.from('picture_categories').select('picture_id,category_id').in('picture_id', picIds),
      supabaseAdmin.from('picture_taggings').select('picture_id,tag_id').in('picture_id', picIds),
      supabaseAdmin.from('picture_locations').select('picture_id,location_id').eq('is_primary', true).in('picture_id', picIds),
    ])

    const enMap: Record<number, any> = {}; for (const r of pen.data || []) enMap[(r as any).picture_id] = { title: (r as any).title || '', subtitle: (r as any).subtitle || '', description: (r as any).description || '' }
    const zhMap: Record<number, any> = {}; for (const r of pzh.data || []) zhMap[(r as any).picture_id] = { title: (r as any).title || '', subtitle: (r as any).subtitle || '', description: (r as any).description || '' }
    const catMap: Record<number, number[]> = {}
    for (const r of pcat.data || []) { const pid = (r as any).picture_id as number; const cid = (r as any).category_id as number; catMap[pid] = Array.from(new Set([...(catMap[pid] || []), cid])) }
    const tagMap: Record<number, string[]> = {}
    const styleMap: Record<number, string | undefined> = {}
    if (ptagRows.data && ptagRows.data.length) {
      const tagIds = Array.from(new Set((ptagRows.data as any[]).map(r => (r as any).tag_id).filter(Boolean)))
      const { data: tags } = await supabaseAdmin.from('tags').select('id,name,type').in('id', tagIds)
      const byId: Record<number, any> = {}; for (const t of tags || []) byId[(t as any).id] = t
      for (const r of ptagRows.data) {
        const pid = (r as any).picture_id as number
        const tinfo = byId[(r as any).tag_id]
        if (!tinfo) continue
        if (tinfo?.type === 'topic' && tinfo?.name) {
          tagMap[pid] = Array.from(new Set([...(tagMap[pid] || []), String(tinfo.name)]))
        } else if (tinfo?.type === 'style' && tinfo?.name) {
          const mapped = PHOTOGRAPHY_TAG_NAME_TO_ID[String(tinfo.name || '').toLowerCase()]
          styleMap[pid] = mapped || String(tinfo.name)
        }
      }
    }
    const locMap: Record<number, { name?: string; latitude?: number | null; longitude?: number | null }> = {}
    if (pLocRows.data && pLocRows.data.length) {
      const locIds = Array.from(new Set((pLocRows.data as any[]).map(r => (r as any).location_id).filter(Boolean)))
      const { data: locs } = await supabaseAdmin.from('locations').select('id,name,latitude,longitude').in('id', locIds)
      const byId: Record<number, any> = {}; for (const l of locs || []) byId[(l as any).id] = l
      for (const r of pLocRows.data) { const pid = (r as any).picture_id as number; const l = byId[(r as any).location_id]; if (l) locMap[pid] = { name: l.name, latitude: l.latitude ?? null, longitude: l.longitude ?? null } }
    }

    const pictureOut = (pictures || []).map((p: any) => ({
      id: p.id,
      picture_set_id: p.picture_set_id,
      order_index: p.order_index,
      title: p.title || '',
      subtitle: p.subtitle || '',
      description: p.description || '',
      image_url: p.image_url || '',
      raw_image_url: p.raw_image_url || '',
      image_variants: p.image_variants || {},
      season_id: p.season_id ?? null,
      location_name: locMap[p.id]?.name || '',
      location_latitude: locMap[p.id]?.latitude ?? null,
      location_longitude: locMap[p.id]?.longitude ?? null,
      picture_category_ids: catMap[p.id] || [],
      style: styleMap[p.id] || null,
      tags: tagMap[p.id] || [],
      en: enMap[p.id] || { title: '', subtitle: '', description: '' },
      zh: zhMap[p.id] || { title: '', subtitle: '', description: '' },
    }))

    const item = { ...setRow, section_ids, category_ids, primary_location_name, primary_location_latitude, primary_location_longitude, en: enT || { title: '', subtitle: '', description: '' }, zh: zhT || { title: '', subtitle: '', description: '' }, tags: setTags, pictures: pictureOut }
    return NextResponse.json({ item })
  } catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 500 }) }
}

export async function PUT(request: Request, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const idNum = Number(ctx.params.id)
    if (!Number.isFinite(idNum) || idNum <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const payload = await request.json()
    const asyncEnrich = !!payload.async_enrich
    const autoFillLocalesAll = !!payload.auto_fill_locales_all
    const pictures: any[] = Array.isArray(payload.pictures) ? payload.pictures : []
    const [{ data: previousSet }, { data: previousPictures }] = await Promise.all([
      supabaseAdmin
        .from('picture_sets')
        .select('cover_image_url, cover_image_variants')
        .eq('id', idNum)
        .maybeSingle(),
      supabaseAdmin
        .from('pictures')
        .select('id, image_url, raw_image_url, image_variants')
        .eq('picture_set_id', idNum),
    ])
    const previousAssetKeys = collectImageAssetKeys([previousSet as any, ...((previousPictures || []) as any[])])
    const retainedAssetKeys = collectImageAssetKeys([
      {
        cover_image_url: payload.cover_image_url,
        cover_image_variants: payload.cover_image_variants,
      },
      ...pictures,
    ])

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

    // update set
    const setRow = { title: payload.title || '', subtitle: payload.subtitle || '', description: payload.description || '', cover_image_url: payload.cover_image_url || null, cover_image_variants: payload.cover_image_variants || {}, position: payload.position || 'up', is_published: payload.is_published ?? true, primary_category_id: payload.primary_category_id ?? null, season_id: payload.season_id ?? null }
    const { error: upErr } = await supabaseAdmin.from('picture_sets').update(setRow).eq('id', idNum)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    // reset relations
    await Promise.all([
      supabaseAdmin.from('picture_set_categories').delete().eq('picture_set_id', idNum),
      supabaseAdmin.from('picture_set_taggings').delete().eq('picture_set_id', idNum),
      supabaseAdmin.from('picture_set_locations').delete().eq('picture_set_id', idNum),
      supabaseAdmin.from('picture_set_section_assignments').delete().eq('picture_set_id', idNum),
    ])

    // categories
    const selectedCategoryIds: number[] = Array.isArray(payload.category_ids) ? Array.from(new Set(payload.category_ids as number[])) : []
    if (selectedCategoryIds.length) {
      const rows = selectedCategoryIds.map((cid: number) => ({ picture_set_id: idNum, category_id: cid, is_primary: cid === (payload.primary_category_id ?? null) }))
      await supabaseAdmin.from('picture_set_categories').insert(rows)
    }

    // translations: only auto-fill when explicitly enabled
    try {
      if (autoFillLocalesAll && !asyncEnrich) {
        const filled = await fillSetTranslationsBi(payload)
        await Promise.all([
          supabaseAdmin.from('picture_set_translations').upsert(
            { picture_set_id: idNum, locale: 'en', title: filled.en.title || '', subtitle: filled.en.subtitle || null, description: filled.en.description || null },
            { onConflict: 'picture_set_id,locale' },
          ),
          supabaseAdmin.from('picture_set_translations').upsert(
            { picture_set_id: idNum, locale: 'zh', title: filled.zh.title || '', subtitle: filled.zh.subtitle || null, description: filled.zh.description || null },
            { onConflict: 'picture_set_id,locale' },
          ),
        ])
      } else {
        await upsertSetTranslationsRaw(idNum, payload)
      }
    } catch {}

    // primary location
    const nm = (payload.primary_location_name || '').trim()
    const lat = typeof payload.primary_location_latitude === 'number' ? payload.primary_location_latitude : null
    const lng = typeof payload.primary_location_longitude === 'number' ? payload.primary_location_longitude : null
    if (nm && typeof lat === 'number' && typeof lng === 'number') {
      let locationId: number | undefined
      const { data: found } = await supabaseAdmin.from('locations').select('id').eq('name', nm).eq('latitude', lat).eq('longitude', lng).maybeSingle()
      if (found?.id) locationId = found.id
      else { const { data: created } = await supabaseAdmin.from('locations').insert({ name: nm, latitude: lat, longitude: lng }).select('id').single(); locationId = created?.id }
      if (locationId) await supabaseAdmin.from('picture_set_locations').insert({ picture_set_id: idNum, location_id: locationId, is_primary: true })
    }

    // set typed tags
    const topicNames: string[] = Array.isArray(payload.tags) ? payload.tags : []
    const categoryIds: number[] = Array.isArray(payload.category_ids) ? payload.category_ids : []
    const seasonIds: number[] = Array.isArray(payload.season_ids) ? payload.season_ids : []
    let categoryTagIds: number[] = []
    let seasonTagIds: number[] = []
    if (categoryIds.length) { const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', categoryIds); categoryTagIds = await ensureTagIds((catRows || []).map((r: any) => r.name), 'category') }
    if (seasonIds.length) { const { data: seaRows } = await supabaseAdmin.from('seasons').select('id,name').in('id', seasonIds); seasonTagIds = await ensureTagIds((seaRows || []).map((r: any) => r.name), 'season') }
    const topicTagIds = await ensureTagIds(topicNames || [], 'topic')
    const setCombined = Array.from(new Set([...(topicTagIds || []), ...(categoryTagIds || []), ...(seasonTagIds || [])]))
    if (setCombined.length) await supabaseAdmin.from('picture_set_taggings').insert(setCombined.map((tid: number) => ({ picture_set_id: idNum, tag_id: tid })))

    // sections
    const desiredSectionIds: number[] = Array.isArray(payload.section_ids) ? Array.from(new Set(payload.section_ids)) : []
    if (desiredSectionIds.length) await supabaseAdmin.from('picture_set_section_assignments').insert(desiredSectionIds.map((sid: number) => ({ picture_set_id: idNum, section_id: sid, page_context: 'default', display_order: 0 })))

    // pictures: delete and recreate
    const existingPics = previousPictures || []
    const existingIds = (existingPics || []).map((p: any) => p.id)
    await deletePictureRows(existingIds)

    // Apply set props flags similar to POST
    let singleSeasonId: number | null = null
    if (seasonIds.length === 1) singleSeasonId = seasonIds[0]
    const allowApplySetProps = !!(payload.fill_missing_from_set ?? payload.apply_set_props_to_pictures)
    const allowOverride = !!payload.override_existing_picture_props
    const propagateCategories = !!payload.propagate_categories_to_pictures
    const styleTagIdCache: Record<string, number | null> = {}
    // Set primary location presence
    const setLocName: string = (payload.primary_location_name || '').trim()
    const setLocLat = typeof payload.primary_location_latitude === 'number' ? payload.primary_location_latitude : null
    const setLocLng = typeof payload.primary_location_longitude === 'number' ? payload.primary_location_longitude : null
    const hasSetLoc = !!setLocName || (typeof setLocLat === 'number' && typeof setLocLng === 'number')
    let insertedPictureIds: number[] = []
    if (pictures.length) {
      const toInsert = pictures.filter((p: any) => typeof p.image_url === 'string' && p.image_url.length > 0)
      if (toInsert.length) {
        const rows = toInsert.map((p: any, idx: number) => ({
          picture_set_id: idNum,
          order_index: idx,
          title: p.title || '',
          subtitle: p.subtitle || '',
          description: p.description || '',
          image_url: p.image_url || null,
          raw_image_url: p.raw_image_url || null,
          image_variants: p.image_variants || {},
          season_id: (allowApplySetProps
            ? (allowOverride ? (singleSeasonId ?? p.season_id ?? null)
              : (p.season_id ?? (singleSeasonId ?? null)))
            : (p.season_id ?? null)),
        }))
        const { data: insertedPics, error: insErr } = await supabaseAdmin.from('pictures').insert(rows).select('id,order_index')
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
        const byIndex: Record<number, number> = {}; for (const r of insertedPics || []) byIndex[(r as any).order_index] = (r as any).id
        insertedPictureIds = (insertedPics || []).map((picture: any) => picture.id)
        const concurrency = Math.max(1, Math.min(6, Number(process.env.PICTURE_JOB_CONCURRENCY || 4)))
        const locCache = new Map<string, number>()

        await asyncPool(concurrency, toInsert, async (p, i) => {
          const picture_id = byIndex[i]; if (!picture_id) return
          // Auto-fill picture title/subtitle translations; use image AI only when both locales are empty.
          try {
            if (payload?.autogen_titles_subtitles && !asyncEnrich) {
              await fillPictureTitleSubtitleLocales(p)
            }
          } catch {}

          const tasks: Promise<any>[] = []

          tasks.push((async () => {
            try {
              if (autoFillLocalesAll && !asyncEnrich) {
                const filled = await fillPictureTranslationsBi(p)
                await Promise.all([
                  supabaseAdmin.from('picture_translations').upsert(
                    { picture_id, locale: 'en', title: filled.en.title || '', subtitle: filled.en.subtitle || null, description: filled.en.description || null },
                    { onConflict: 'picture_id,locale' },
                  ),
                  supabaseAdmin.from('picture_translations').upsert(
                    { picture_id, locale: 'zh', title: filled.zh.title || '', subtitle: filled.zh.subtitle || null, description: filled.zh.description || null },
                    { onConflict: 'picture_id,locale' },
                  ),
                ])
              } else {
                await upsertPictureTranslationsRaw(picture_id, p)
              }
            } catch {}
          })())

          tasks.push((async () => {
            const pTopicIds = await ensureTagIds((Array.isArray(p.tags) ? p.tags : []), 'topic')
            let pCatTagIds: number[] = []
            const picCatIds: number[] = Array.isArray(p.picture_category_ids) ? p.picture_category_ids : []
            if (picCatIds.length) {
              const { data: catRows } = await supabaseAdmin.from('categories').select('id,name').in('id', picCatIds)
              pCatTagIds = await ensureTagIds((catRows || []).map((r: any) => r.name), 'category')
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
            if (combined.length) await supabaseAdmin.from('picture_taggings').insert(combined.map((tid: number) => ({ picture_id, tag_id: tid })))
            const selectedCatIds: number[] = Array.isArray(payload.category_ids)
              ? (Array.from(new Set(payload.category_ids as number[])) as number[])
              : []
            let unionCats = Array.from(new Set([...(picCatIds || []), ...(propagateCategories ? selectedCatIds : [])]))
            if (unionCats.length) {
              await supabaseAdmin.from('picture_categories').insert(unionCats.map((cid: number) => ({ picture_id, category_id: cid, is_primary: false })))
            }
          })())

          tasks.push((async () => {
            let lnm = (p.location_name || '').trim()
            let llat = typeof p.location_latitude === 'number' ? p.location_latitude : null
            let llng = typeof p.location_longitude === 'number' ? p.location_longitude : null
            const hasPicLoc = !!lnm || (typeof llat === 'number' && typeof llng === 'number')
            if (allowApplySetProps && hasSetLoc && (allowOverride || !hasPicLoc)) {
              lnm = setLocName || lnm
              llat = (typeof setLocLat === 'number' ? setLocLat : llat)
              llng = (typeof setLocLng === 'number' ? setLocLng : llng)
            }
            if (lnm && typeof llat === 'number' && typeof llng === 'number') {
              const cacheKey = `${lnm}|${llat}|${llng}`
              let locId = locCache.get(cacheKey)
              if (!locId) {
                const { data: found } = await supabaseAdmin.from('locations').select('id').eq('name', lnm).eq('latitude', llat).eq('longitude', llng).maybeSingle()
                if (found?.id) locId = found.id
                else {
                  const { data: created } = await supabaseAdmin.from('locations').insert({ name: lnm, latitude: llat, longitude: llng }).select('id').single()
                  locId = created?.id
                }
                if (locId) locCache.set(cacheKey, locId)
              }
              if (locId) await supabaseAdmin.from('picture_locations').insert({ picture_id, location_id: locId, is_primary: true })
            }
          })())

          await Promise.all(tasks)
        })
      }
    }
    triggerPictureEmbeddingBackfill(insertedPictureIds)

    if (asyncEnrich) {
      triggerAsyncEnrich(idNum, payload, request.headers.get("authorization"))
    }
    const obsoleteAssetKeys = Array.from(previousAssetKeys).filter((key) => !retainedAssetKeys.has(key))
    const storageDelete = await deleteObjectKeysFromR2(obsoleteAssetKeys)
    if (storageDelete.errors.length) {
      console.warn('Failed to delete some obsolete image assets after picture set update:', storageDelete.errors)
    }
    return NextResponse.json({
      id: idNum,
      storageDeleted: storageDelete.deleted.length,
      storageDeleteErrors: storageDelete.errors,
    })
  } catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 500 }) }
}

export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const idNum = Number(ctx.params.id)
    if (!Number.isFinite(idNum) || idNum <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const [{ data: setRow }, { data: pics }] = await Promise.all([
      supabaseAdmin
        .from('picture_sets')
        .select('cover_image_url, cover_image_variants')
        .eq('id', idNum)
        .maybeSingle(),
      supabaseAdmin
        .from('pictures')
        .select('id, image_url, raw_image_url, image_variants')
        .eq('picture_set_id', idNum),
    ])
    const assetKeys = collectImageAssetKeys([setRow as any, ...((pics || []) as any[])])
    const pids = (pics || []).map((p: any) => p.id)
    await deletePictureRows(pids)
    await runMutation('delete picture set likes', supabaseAdmin.from('picture_set_likes').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set comments', supabaseAdmin.from('picture_set_comments').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set participants', supabaseAdmin.from('picture_set_participants').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set taggings', supabaseAdmin.from('picture_set_taggings').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set categories', supabaseAdmin.from('picture_set_categories').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set locations', supabaseAdmin.from('picture_set_locations').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set section assignments', supabaseAdmin.from('picture_set_section_assignments').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set translations', supabaseAdmin.from('picture_set_translations').delete().eq('picture_set_id', idNum))
    await runMutation('delete picture set', supabaseAdmin.from('picture_sets').delete().eq('id', idNum))
    const storageDelete = await deleteObjectKeysFromR2(assetKeys)
    if (storageDelete.errors.length) {
      console.warn('Failed to delete some image assets after picture set delete:', storageDelete.errors)
    }
    return NextResponse.json({
      ok: true,
      storageDeleted: storageDelete.deleted.length,
      storageDeleteErrors: storageDelete.errors,
    })
  } catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 500 }) }
}
