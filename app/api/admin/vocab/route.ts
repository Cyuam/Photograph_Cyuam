import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"
import { requireAdminRequest } from "@/utils/admin-auth.server"

export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const url = new URL(request.url)
    const locale = (url.searchParams.get('locale') || 'en').toLowerCase()
    async function selectWithNameCn(table: string, orderBy: string, orderAsc: boolean) {
      const variants = [
        'id,name,"nameCN"', // quoted CamelCase
        'id,name,name_cn',   // snake_case
        'id,name,namecn',    // all lowercase
        'id,name'            // fallback
      ]
      for (const sel of variants) {
        const { data, error } = await supabaseAdmin.from(table as any).select(sel).order(orderBy as any, { ascending: orderAsc })
        if (!error) return { data, usedSelect: sel }
        // if last try, return error
        if (sel === 'id,name') return { data: [], usedSelect: sel }
        // otherwise continue trying
      }
      return { data: [], usedSelect: 'id,name' }
    }

    const [catRes, seaRes, secRes] = await Promise.all([
      selectWithNameCn('categories', 'name', true),
      selectWithNameCn('seasons', 'id', true),
      supabaseAdmin.from('sections').select('id,name,display_order').order('display_order', { ascending: true }),
    ])
    const cats = (catRes as any).data
    const seas = (seaRes as any).data
    const secs = (secRes as any).data
    const sxe = (secRes as any).error
    if (sxe) return NextResponse.json({ error: sxe.message }, { status: 400 })

    const outCats = [...(cats || [])]
    const outSeas = [...(seas || [])]
    const outSecs = [...(secs || [])]
    try {
      if (locale === 'zh' || locale === 'en') {
        // categories translations
        try {
          const { data: ct } = await supabaseAdmin
            .from('category_translations')
            .select('category_id, name, locale')
            .eq('locale', locale)
          const cmap: Record<number, string> = {}
          for (const r of ct || []) cmap[(r as any).category_id] = (r as any).name
          for (const c of outCats) {
            const id = (c as any).id
            const tr = cmap[id]
            if (tr) (c as any).name = tr
            else if (locale === 'zh') {
              const ncn = (c as any).nameCN || (c as any).name_cn || (c as any).namecn
              if (ncn) (c as any).name = ncn
            }
          }
        } catch {}
        // seasons translations
        try {
          const { data: st } = await supabaseAdmin
            .from('season_translations')
            .select('season_id, name, locale')
            .eq('locale', locale)
          const smap: Record<number, string> = {}
          for (const r of st || []) smap[(r as any).season_id] = (r as any).name
          for (const s of outSeas) {
            const id = (s as any).id
            const tr = smap[id]
            if (tr) (s as any).name = tr
            else if (locale === 'zh') {
              const ncn = (s as any).nameCN || (s as any).name_cn || (s as any).namecn
              if (ncn) (s as any).name = ncn
            }
          }
        } catch {}
        // sections translations
        try {
          const { data: sct } = await supabaseAdmin
            .from('section_translations')
            .select('section_id, name, locale')
            .eq('locale', locale)
          const sxmap: Record<number, string> = {}
          for (const r of sct || []) sxmap[(r as any).section_id] = (r as any).name
          for (const s of outSecs) {
            const id = (s as any).id
            const tr = sxmap[id]
            if (tr) (s as any).name = tr
            else if (locale === 'zh') {
              const ncn = (s as any).nameCN || (s as any).name_cn
              if (ncn) (s as any).name = ncn
            }
          }
        } catch {}
      }
    } catch {}

    return NextResponse.json({ categories: outCats, seasons: outSeas, sections: outSecs })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
