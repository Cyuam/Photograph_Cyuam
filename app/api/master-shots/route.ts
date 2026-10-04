import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = "nodejs"

const FALLBACK_BUCKET = "https://s3.cunyli.top"
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 350

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const toPublicUrl = (path?: string | null) => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const base = (process.env.NEXT_PUBLIC_BUCKET_URL || FALLBACK_BUCKET).replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalizedPath}`
}

const fetchTagsByPattern = async (pattern: string) => {
  const { data, error } = await supabaseAdmin
    .from("tags")
    .select("id,name")
    .ilike("name", `%${pattern}%`)

  if (error) throw new Error(error.message)
  return data || []
}

const loadMasterShots = async (limit: number) => {
  const [englishTags, chineseTags] = await Promise.all([
    fetchTagsByPattern("master"),
    fetchTagsByPattern("大师"),
  ])

  const tagRows = [...englishTags, ...chineseTags]

  const tagIds = tagRows.map((row) => row.id).filter((id): id is number => Number.isFinite(id))
  if (!tagIds.length) {
    return []
  }

  const { data: taggings, error: taggingsError } = await supabaseAdmin
    .from("picture_taggings")
    .select("picture_id")
    .in("tag_id", tagIds)

  if (taggingsError) {
    throw new Error(taggingsError.message)
  }

  const pictureIds = Array.from(
    new Set(
      (taggings || [])
        .map((row) => row.picture_id as number)
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )

  if (!pictureIds.length) {
    return []
  }

  const { data: pictureRows, error: picturesError } = await supabaseAdmin
    .from("pictures")
    .select("id, picture_set_id, image_url, created_at, is_published")
    .in("id", pictureIds)

  if (picturesError) {
    throw new Error(picturesError.message)
  }

  return (pictureRows || [])
    .map((row) => ({
      ...row,
      publicUrl: toPublicUrl(row.image_url),
    }))
    .filter((row) => row.publicUrl && row.is_published !== false)
    .sort((a, b) => {
      const aTime = Date.parse(a.created_at || "") || 0
      const bTime = Date.parse(b.created_at || "") || 0
      return bTime - aTime
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      pictureSetId: row.picture_set_id,
      imageUrl: row.publicUrl as string,
      styleLabel: "Master",
      styleLabelZh: "大师甄选",
    }))
}

const isRetryableError = (error: any) => {
  const message = (error?.message || error || "").toString()
  return /fetch failed|timed out|ECONNRESET|ENOTFOUND/i.test(message)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit")) || 11, 48)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const shots = await loadMasterShots(limit)
      return NextResponse.json({ shots })
    } catch (error: any) {
      console.error(`[api/master-shots] attempt ${attempt} failed`, error)
      if (attempt === MAX_ATTEMPTS || !isRetryableError(error)) {
        return NextResponse.json({ error: error?.message || "Failed to load master shots" }, { status: 500 })
      }
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }

  return NextResponse.json({ shots: [] })
}
