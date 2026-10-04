import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = "nodejs"

const FALLBACK_BUCKET = "https://s3.cunyli.top"
const REQUIRED_TOPIC_TAGS = ["portrait-library", "display:sample"]
const LOCATION_PREFIX = "location:"
const MODEL_PREFIX = "model:"
const SOURCE_NAME_PATTERN = /DSC\d+/i
const PICTURE_SELECT = "id,picture_set_id,order_index,image_url,raw_image_url,image_variants,title,subtitle,description,created_at,is_published"
const STYLE_TAG_LABELS: Record<string, string> = {
  "style:cinematic": "电影感",
  "style:quiet": "安静",
  "style:editorial": "杂志感",
  "technique:wide-environment": "环境人像",
  "technique:telephoto-compression": "长焦压缩",
}
const LOCATION_LABELS: Record<string, string> = {
  aalto: "Aalto",
  appenzell: "Appenzell",
  helsinki: "Helsinki",
  italy: "Italy",
  lijiang: "Lijiang",
  oeschinen: "Oeschinen",
  spiz: "Spiez",
  stockholm: "Stockholm",
  switzerland: "Switzerland",
  zermatt: "Zermatt",
}
const BROAD_LOCATION_VALUES = new Set(["europe", "finland", "italy", "switzerland", "other-city"])
const PHOTO_SESSION_GROUPS = [
  {
    id: "ziyang-stockholm",
    title: "Ziyang",
    place: "Stockholm",
    note: "城市里走出来的一组自然人像。",
    sources: ["DSC04113", "DSC04070", "DSC04140", "DSC04154"],
  },
  {
    id: "xiya-stockholm",
    title: "Xiya",
    place: "Stockholm",
    note: "把校园、街道和轻松状态放在同一组里。",
    sources: ["DSC04064", "DSC03917", "DSC03927", "DSC04308", "DSC04281", "DSC04089", "DSC04186"],
  },
  {
    id: "hongjia-helsinki",
    title: "Hongjia",
    place: "Helsinki",
    note: "黄昏和夜景里的人像节奏。",
    sources: ["DSC05589", "DSC05614", "DSC05771"],
  },
  {
    id: "rico-zermatt",
    title: "Rico",
    place: "Zermatt",
    note: "山路和旅行当天留下来的片段。",
    sources: ["DSC06253", "DSC06283", "DSC06371"],
  },
  {
    id: "david-appenzell",
    title: "David",
    place: "Appenzell",
    note: "开阔环境里保留人的状态。",
    sources: ["DSC06852", "DSC06878", "DSC07032"],
  },
  {
    id: "hongjia-oeschinen",
    title: "Hongjia",
    place: "Oeschinen",
    note: "同一段旅行路线里的几种距离。",
    sources: ["DSC07120", "DSC07178", "DSC07128"],
  },
  {
    id: "jianji-xinyi",
    title: "Jianji & Xinyi",
    place: "Croatia",
    note: "双人旅拍里的互动和地点感。",
    sources: ["DSC00373", "DSC00471", "DSC09211"],
  },
  {
    id: "lijie",
    title: "Lijie",
    place: "Switzerland",
    note: "About 区域使用的本人照片。",
    sources: ["DSC00143", "DSC03210", "DSC07046"],
  },
]
const WHY_ME_SOURCES = ["DSC00309", "DSC00773", "DSC04453", "DSC05043", "DSC07091", "DSC09401"]

const safeTime = (value: string | null | undefined) => {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

const toPublicUrl = (path?: string | null) => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const base = (process.env.NEXT_PUBLIC_BUCKET_URL || FALLBACK_BUCKET).replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalizedPath}`
}

const cleanTagValue = (tag: string, prefix: string) => tag.slice(prefix.length).trim()

const extractSourceName = (path?: string | null) => {
  const match = String(path || "").match(SOURCE_NAME_PATTERN)
  return match ? match[0].toUpperCase() : ""
}

const collectPictureSourceNames = (picture: any) => {
  const imageVariants = (picture.image_variants || {}) as Record<string, string | null | undefined>
  const paths = [picture.image_url, picture.raw_image_url, ...Object.values(imageVariants)]
  return Array.from(new Set(paths.map(extractSourceName).filter(Boolean)))
}

const humanizeTagValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const key = trimmed.toLowerCase()
  if (LOCATION_LABELS[key]) return LOCATION_LABELS[key]
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

const pickLocationTag = (tags: string[]) => {
  const locations = tags
    .filter((tag) => tag.toLowerCase().startsWith(LOCATION_PREFIX))
    .map((tag) => cleanTagValue(tag, LOCATION_PREFIX))
    .filter(Boolean)

  return (
    locations.find((location) => !BROAD_LOCATION_VALUES.has(location.toLowerCase())) ||
    locations[0] ||
    ""
  )
}

const pickModelName = (tags: string[]) => {
  const modelTag = tags.find((tag) => tag.toLowerCase().startsWith(MODEL_PREFIX))
  return modelTag ? humanizeTagValue(cleanTagValue(modelTag, MODEL_PREFIX)) : ""
}

const buildDisplayTags = (tags: string[], locationLabel: string) => {
  const displayTags = new Set<string>()
  if (locationLabel) displayTags.add(locationLabel)
  if (tags.includes("type:travel-session")) displayTags.add("旅拍")
  displayTags.add("人像")

  for (const [tag, label] of Object.entries(STYLE_TAG_LABELS)) {
    if (tags.includes(tag)) displayTags.add(label)
    if (displayTags.size >= 4) break
  }

  return Array.from(displayTags).slice(0, 4)
}

const buildMomentPhoto = (picture: any, tags: string[], fallbackTitle: string, fallbackPlace: string) => {
  const locationValue = pickLocationTag(tags)
  const locationLabel = humanizeTagValue(locationValue)
  const modelName = pickModelName(tags)
  const imageVariants = (picture.image_variants || {}) as Record<string, string>
  const imageUrl = toPublicUrl(imageVariants["1280"] || picture.image_url)
  const sourceName = collectPictureSourceNames(picture)[0] || `picture-${picture.id}`

  return {
    id: `portrait-${picture.id}`,
    sourceName,
    src: imageUrl,
    alt: `${fallbackTitle} ${fallbackPlace} portrait session photo`,
    title: fallbackTitle || modelName || locationLabel || "Portrait moment",
    place: fallbackPlace || (modelName ? `${locationLabel || "Portrait"} / ${modelName}` : locationLabel || "Portrait session"),
    note: tags.includes("type:travel-session")
      ? "旅途中留下来的自然人像。"
      : "适合约拍参考的自然人像。",
    featured: tags.includes("display:cover"),
    tags: buildDisplayTags(tags, locationLabel || fallbackPlace),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 6, 1), 12)
    const configuredSourceNames = Array.from(new Set([
      ...PHOTO_SESSION_GROUPS.flatMap((group) => group.sources),
      ...WHY_ME_SOURCES,
    ].map((sourceName) => sourceName.toUpperCase())))

    const { data: requiredTags, error: requiredTagsError } = await supabaseAdmin
      .from("tags")
      .select("id,name")
      .eq("type", "topic")
      .in("name", REQUIRED_TOPIC_TAGS)

    if (requiredTagsError) {
      return NextResponse.json({ error: requiredTagsError.message }, { status: 500 })
    }

    const requiredTagIds = (requiredTags || [])
      .map((tag) => tag.id as number)
      .filter((id) => Number.isFinite(id))

    let candidatePictureIds: number[] = []
    if (requiredTagIds.length === REQUIRED_TOPIC_TAGS.length) {
      const { data: requiredTaggings, error: requiredTaggingsError } = await supabaseAdmin
        .from("picture_taggings")
        .select("picture_id,tag_id")
        .in("tag_id", requiredTagIds)

      if (requiredTaggingsError) {
        return NextResponse.json({ error: requiredTaggingsError.message }, { status: 500 })
      }

      const requiredCountByPicture = new Map<number, number>()
      for (const row of requiredTaggings || []) {
        const pictureId = (row as any).picture_id as number
        if (!Number.isFinite(pictureId)) continue
        requiredCountByPicture.set(pictureId, (requiredCountByPicture.get(pictureId) || 0) + 1)
      }

      candidatePictureIds = Array.from(requiredCountByPicture.entries())
        .filter(([, count]) => count >= REQUIRED_TOPIC_TAGS.length)
        .map(([pictureId]) => pictureId)
    }

    const picturesById = new Map<number, any>()
    if (candidatePictureIds.length > 0) {
      const { data: taggedPictures, error: taggedPicturesError } = await supabaseAdmin
        .from("pictures")
        .select(PICTURE_SELECT)
        .in("id", candidatePictureIds)
        .eq("is_published", true)

      if (taggedPicturesError) {
        return NextResponse.json({ error: taggedPicturesError.message }, { status: 500 })
      }

      for (const picture of taggedPictures || []) {
        picturesById.set((picture as any).id as number, picture)
      }
    }

    if (configuredSourceNames.length > 0) {
      const sourceFilters = configuredSourceNames.flatMap((sourceName) => [
        `image_url.ilike.%${sourceName}%`,
        `raw_image_url.ilike.%${sourceName}%`,
      ])
      const { data: sourcePictures, error: sourcePicturesError } = await supabaseAdmin
        .from("pictures")
        .select(PICTURE_SELECT)
        .eq("is_published", true)
        .or(sourceFilters.join(","))

      if (sourcePicturesError) {
        return NextResponse.json({ error: sourcePicturesError.message }, { status: 500 })
      }

      for (const picture of sourcePictures || []) {
        picturesById.set((picture as any).id as number, picture)
      }
    }

    const pictures = Array.from(picturesById.values())
    const pictureIds = pictures.map((picture: any) => picture.id as number)
    if (!pictureIds.length) {
      return NextResponse.json({ groups: [], aboutPhoto: null, moments: [], whyMePhotos: [] })
    }

    const { data: allTaggings, error: allTaggingsError } = await supabaseAdmin
      .from("picture_taggings")
      .select("picture_id, tag:tags(name,type)")
      .in("picture_id", pictureIds)

    if (allTaggingsError) {
      return NextResponse.json({ error: allTaggingsError.message }, { status: 500 })
    }

    const tagsByPicture = new Map<number, string[]>()
    for (const row of allTaggings || []) {
      const tag = (row as any).tag
      if (!tag || tag.type !== "topic") continue
      const pictureId = (row as any).picture_id as number
      const name = String(tag.name || "").trim()
      if (!Number.isFinite(pictureId) || !name) continue
      tagsByPicture.set(pictureId, [...(tagsByPicture.get(pictureId) || []), name])
    }

    const sortedPictures = [...pictures].sort((left: any, right: any) => {
      const setDiff = Number(right.picture_set_id || 0) - Number(left.picture_set_id || 0)
      if (setDiff !== 0) return setDiff

      const dateDiff = safeTime(right.created_at) - safeTime(left.created_at)
      if (dateDiff !== 0) return dateDiff

      const leftFeatured = tagsByPicture.get(left.id as number)?.includes("display:cover") ? 1 : 0
      const rightFeatured = tagsByPicture.get(right.id as number)?.includes("display:cover") ? 1 : 0
      const featuredDiff = rightFeatured - leftFeatured
      if (featuredDiff !== 0) return featuredDiff

      return Number(left.order_index ?? 0) - Number(right.order_index ?? 0)
    })

    const picturesBySourceName = new Map<string, any>()
    for (const picture of sortedPictures) {
      for (const sourceName of collectPictureSourceNames(picture)) {
        picturesBySourceName.set(sourceName, picture)
      }
    }

    const groups = PHOTO_SESSION_GROUPS.map((group) => {
      const groupPictures = group.sources
        .map((sourceName) => picturesBySourceName.get(sourceName.toUpperCase()))
        .filter(Boolean)
      const photos = groupPictures
        .map((picture) => buildMomentPhoto(picture, tagsByPicture.get(picture.id as number) || [], group.title, group.place))
        .filter((photo) => photo.src)

      return {
        id: group.id,
        title: group.title,
        place: group.place,
        note: group.note,
        featured: photos.some((photo) => photo.featured),
        photoCount: photos.length,
        tags: Array.from(new Set(photos.flatMap((photo) => photo.tags))).slice(0, 4),
        photos,
      }
    }).filter((group) => group.photos.length > 0)

    const aboutPhoto = groups.find((group) => group.id === "lijie")?.photos[0] || null
    const whyMePhotos = WHY_ME_SOURCES
      .map((sourceName) => picturesBySourceName.get(sourceName.toUpperCase()))
      .filter(Boolean)
      .map((picture) => buildMomentPhoto(picture, tagsByPicture.get(picture.id as number) || [], "Why me", "Portrait portfolio"))
      .filter((photo) => photo.src)

    const usedLocations = new Set<string>()
    const selected: any[] = []

    for (const picture of sortedPictures) {
      const tags = tagsByPicture.get(picture.id as number) || []
      const locationValue = pickLocationTag(tags)
      if (!locationValue) continue

      const locationKey = locationValue.toLowerCase()
      if (usedLocations.has(locationKey)) continue

      usedLocations.add(locationKey)
      selected.push(picture)
      if (selected.length >= limit) break
    }

    if (selected.length < limit) {
      for (const picture of sortedPictures) {
        if (selected.some((item) => item.id === picture.id)) continue
        selected.push(picture)
        if (selected.length >= limit) break
      }
    }

    const groupedMoments = groups
      .filter((group) => group.id !== "lijie" && group.photos.length >= 2)
      .flatMap((group) => group.photos)
    const moments = (groupedMoments.length ? groupedMoments : selected.map((picture) => {
      const tags = tagsByPicture.get(picture.id as number) || []
      const locationValue = pickLocationTag(tags)
      const locationLabel = humanizeTagValue(locationValue)
      const modelName = pickModelName(tags)
      return buildMomentPhoto(
        picture,
        tags,
        locationLabel || modelName || "Portrait moment",
        modelName ? `${locationLabel || "Portrait"} / ${modelName}` : locationLabel || "Portrait session",
      )
    })).filter((moment) => moment.src)

    return NextResponse.json({
      groups: groups.slice(0, limit),
      aboutPhoto,
      moments: moments.slice(0, limit * 4),
      whyMePhotos,
    })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
  }
}
