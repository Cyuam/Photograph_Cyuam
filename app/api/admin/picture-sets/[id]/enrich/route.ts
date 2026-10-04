import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"
import { requireAdminRequest } from "@/utils/admin-auth.server"

export const runtime = 'nodejs'

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const port = process.env.PORT || 3000
  return `http://localhost:${port}`
}

const looksZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))

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

async function fillSetTranslationsBi(payload: any): Promise<{ en: any; zh: any }> {
  const base = { title: payload.title || '', subtitle: payload.subtitle || '', description: payload.description || '' }
  const enOut: any = { title: payload.en?.title || '', subtitle: payload.en?.subtitle || '', description: payload.en?.description || '' }
  const zhOut: any = { title: payload.zh?.title || '', subtitle: payload.zh?.subtitle || '', description: payload.zh?.description || '' }
  for (const key of ['title', 'subtitle', 'description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (looksZh(b)) { zhVal = b; enVal = await translateText(b, 'en') }
      else { enVal = b; zhVal = await translateText(b, 'zh') }
    } else if (!enVal && zhVal) { enVal = await translateText(zhVal, 'en') }
    else if (!zhVal && enVal) { zhVal = await translateText(enVal, 'zh') }
    enOut[key] = enVal; zhOut[key] = zhVal
  }
  return { en: enOut, zh: zhOut }
}

async function fillPictureTranslationsBi(p: any): Promise<{ en: any; zh: any }> {
  const base = { title: p.title || '', subtitle: p.subtitle || '', description: p.description || '' }
  const enOut: any = { title: p.en?.title || '', subtitle: p.en?.subtitle || '', description: p.en?.description || '' }
  const zhOut: any = { title: p.zh?.title || '', subtitle: p.zh?.subtitle || '', description: p.zh?.description || '' }
  for (const key of ['title', 'subtitle', 'description'] as const) {
    const b = base[key]
    let enVal = enOut[key] || ''
    let zhVal = zhOut[key] || ''
    if (!enVal && !zhVal && b) {
      if (looksZh(b)) { zhVal = b; enVal = await translateText(b, 'en') }
      else { enVal = b; zhVal = await translateText(b, 'zh') }
    } else if (!enVal && zhVal) { enVal = await translateText(zhVal, 'en') }
    else if (!zhVal && enVal) { zhVal = await translateText(enVal, 'zh') }
    enOut[key] = enVal; zhOut[key] = zhVal
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

async function upsertSetTitleSubtitleTranslations(picture_set_id: number, payload: any) {
  const ops: any[] = []
  if (payload?.en) {
    ops.push(
      supabaseAdmin.from('picture_set_translations').upsert(
        { picture_set_id, locale: 'en', title: payload.en.title || '', subtitle: payload.en.subtitle || null },
        { onConflict: 'picture_set_id,locale' },
      ),
    )
  }
  if (payload?.zh) {
    ops.push(
      supabaseAdmin.from('picture_set_translations').upsert(
        { picture_set_id, locale: 'zh', title: payload.zh.title || '', subtitle: payload.zh.subtitle || null },
        { onConflict: 'picture_set_id,locale' },
      ),
    )
  }
  if (ops.length) await Promise.all(ops)
}

async function upsertPictureTitleSubtitleTranslations(picture_id: number, p: any) {
  const ops: any[] = []
  if (p?.en) {
    ops.push(
      supabaseAdmin.from('picture_translations').upsert(
        { picture_id, locale: 'en', title: p.en.title || '', subtitle: p.en.subtitle || null },
        { onConflict: 'picture_id,locale' },
      ),
    )
  }
  if (p?.zh) {
    ops.push(
      supabaseAdmin.from('picture_translations').upsert(
        { picture_id, locale: 'zh', title: p.zh.title || '', subtitle: p.zh.subtitle || null },
        { onConflict: 'picture_id,locale' },
      ),
    )
  }
  if (ops.length) await Promise.all(ops)
}

async function ensureTagIds(names: string[] = [], type: string = 'topic'): Promise<number[]> {
  const uniq = Array.from(new Set(names.map(n => String(n || '').trim()).filter(Boolean)))
  if (uniq.length === 0) return []
  const toInsert = uniq.map(name => ({ name, type, slug: `${type}:${name.toLowerCase().replace(/\s+/g, '-')}` }))
  await supabaseAdmin.from('tags').upsert(toInsert, { onConflict: 'slug' })
  const { data } = await supabaseAdmin.from('tags').select('id,name').in('name', uniq).eq('type', type)
  return (data || []).map(d => d.id)
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

const parseTags = (input: string): string[] => {
  return Array.from(new Set(String(input || '')
    .replace(/\n/g, ',')
    .split(/[,，;；]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)))
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const idNum = Number(ctx.params.id)
    if (!Number.isFinite(idNum) || idNum <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const payload = await request.json()
    const pictures: any[] = Array.isArray(payload.pictures) ? payload.pictures : []

    const autoGen = !!payload.autogen_titles_subtitles
    const autoFillLocalesAll = !!payload.auto_fill_locales_all
    const autoGenTagsForUntagged = !!payload.auto_generate_tags_untagged
    const bucketBaseUrl = process.env.NEXT_PUBLIC_BUCKET_URL || ''
    const makePublicUrl = (path?: string | null): string => {
      if (!path || !path.trim()) return ''
      if (/^https?:/i.test(path)) return path
      if (!bucketBaseUrl) return ''
      return `${bucketBaseUrl}${path}`
    }
    const serverAnalyze = async (imgUrl: string, type: 'title' | 'subtitle' | 'tags'): Promise<string> => {
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

    if (autoGen) {
      await fillSetTitleSubtitleLocales(payload)
      if (!autoFillLocalesAll) await upsertSetTitleSubtitleTranslations(idNum, payload)
    }

    if (autoFillLocalesAll) {
      try {
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
      } catch {}
    }

    if (pictures.length) {
      const { data: dbPics } = await supabaseAdmin
        .from('pictures')
        .select('id, order_index')
        .eq('picture_set_id', idNum)
        .order('order_index', { ascending: true })
      const byIndex: Record<number, number> = {}
      for (const r of dbPics || []) byIndex[(r as any).order_index] = (r as any).id

      const styleTagIdCache: Record<string, number | null> = {}
      const concurrency = Math.max(1, Math.min(6, Number(process.env.PICTURE_JOB_CONCURRENCY || 4)))

      await asyncPool(concurrency, pictures, async (p, i) => {
        const picture_id = byIndex[i]
        if (!picture_id) return

        if (autoGen) {
          try {
            await fillPictureTitleSubtitleLocales(p)
            if (!autoFillLocalesAll) await upsertPictureTitleSubtitleTranslations(picture_id, p)
          } catch {}
        }

        if (autoFillLocalesAll) {
          try {
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
          } catch {}
        }

        if (autoGenTagsForUntagged) {
          const existingTags = Array.isArray(p.tags) ? p.tags : []
          if (!existingTags.length) {
            try {
              const imgUrl = makePublicUrl(p.image_url || p.raw_image_url)
              const result = imgUrl ? await serverAnalyze(imgUrl, 'tags') : ''
              const tagNames = parseTags(result)
              if (tagNames.length) {
                const tagIds = await ensureTagIds(tagNames, 'topic')
                if (tagIds.length) {
                  const { data: existingRows } = await supabaseAdmin
                    .from('picture_taggings')
                    .select('tag_id')
                    .eq('picture_id', picture_id)
                  const existing = new Set((existingRows || []).map((r: any) => r.tag_id))
                  const toInsert = tagIds.filter((tid) => !existing.has(tid))
                  if (toInsert.length) {
                    await supabaseAdmin.from('picture_taggings').insert(toInsert.map((tid) => ({ picture_id, tag_id: tid })))
                  }
                }
              }
            } catch {}
          }
        }

        if (p.style && PHOTOGRAPHY_STYLE_BY_ID[p.style as keyof typeof PHOTOGRAPHY_STYLE_BY_ID]) {
          try {
            const tagName = PHOTOGRAPHY_STYLE_BY_ID[p.style as keyof typeof PHOTOGRAPHY_STYLE_BY_ID].tagName
            const cached = styleTagIdCache[p.style]
            let styleTagIds: number[] = []
            if (typeof cached === 'number') {
              styleTagIds = [cached]
            } else {
              const ensured = await ensureTagIds([tagName], 'style')
              const firstId = ensured[0] ?? null
              styleTagIdCache[p.style] = firstId
              if (typeof firstId === 'number') styleTagIds = [firstId]
            }
            if (styleTagIds.length) {
              const { data: existingRows } = await supabaseAdmin
                .from('picture_taggings')
                .select('tag_id')
                .eq('picture_id', picture_id)
              const existing = new Set((existingRows || []).map((r: any) => r.tag_id))
              const toInsert = styleTagIds.filter((tid) => !existing.has(tid))
              if (toInsert.length) {
                await supabaseAdmin.from('picture_taggings').insert(toInsert.map((tid) => ({ picture_id, tag_id: tid })))
              }
            }
          } catch {}
        }
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
