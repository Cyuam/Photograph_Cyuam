import { notFound } from "next/navigation"
import { Suspense } from "react"
import PortfolioDetail from "@/components/portfolio-detail"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

const looksZh = (text?: string | null) => /[\u4e00-\u9fff]/.test(String(text || ""))

export const revalidate = 0

const parsePictureIds = (value?: string | string[] | null) => {
  const raw = Array.isArray(value) ? value.join(",") : value
  if (!raw) return []
  const seen = new Set<number>()
  return raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((id) => {
      if (!Number.isFinite(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
}

export default async function SearchWorkPage({
  searchParams,
}: {
  searchParams?: Promise<{
    pictureIds?: string
    pictureId?: string
    q?: string
    origin?: string
    returnSet?: string
  }>
}) {
  const resolvedSearchParams = await searchParams
  const pictureIds = parsePictureIds(resolvedSearchParams?.pictureIds)
  if (pictureIds.length === 0) notFound()

  const { data: pictures, error: pictureError } = await supabaseAdmin
    .from("pictures")
    .select("id, picture_set_id, image_url, raw_image_url, title, subtitle, description")
    .in("id", pictureIds)

  if (pictureError) {
    console.error("Error fetching search result pictures:", pictureError)
    notFound()
  }

  const pictureRank = new Map(pictureIds.map((id, index) => [id, index]))
  const orderedPictures = (pictures || [])
    .filter((picture) => pictureRank.has((picture as any).id))
    .sort((left, right) => (pictureRank.get((left as any).id) ?? 9999) - (pictureRank.get((right as any).id) ?? 9999))

  if (orderedPictures.length === 0) notFound()

  const resolvedPictureIds = orderedPictures.map((picture: any) => picture.id as number)
  const { data: pictureTranslations } = await supabaseAdmin
    .from("picture_translations")
    .select("picture_id, locale, title, subtitle, description")
    .in("picture_id", resolvedPictureIds)

  const pictureTranslationsMap = new Map<number, { en: { title?: string | null; subtitle?: string | null; description?: string | null }; zh: { title?: string | null; subtitle?: string | null; description?: string | null } }>()

  for (const picture of orderedPictures) {
    pictureTranslationsMap.set((picture as any).id, {
      en: {
        title: (picture as any).title ?? "",
        subtitle: (picture as any).subtitle ?? "",
        description: (picture as any).description ?? "",
      },
      zh: {
        title: "",
        subtitle: "",
        description: "",
      },
    })
  }

  for (const row of pictureTranslations || []) {
    const entry = pictureTranslationsMap.get((row as any).picture_id)
    if (!entry) continue
    const target = (row as any).locale === "zh" ? entry.zh : entry.en
    if ((row as any).title) target.title = (row as any).title
    if ((row as any).subtitle) target.subtitle = (row as any).subtitle
    if ((row as any).description) target.description = (row as any).description
  }

  for (const picture of orderedPictures) {
    const entry = pictureTranslationsMap.get((picture as any).id)
    if (!entry) continue
    const baseTitle = (picture as any).title ?? ""
    const baseSubtitle = (picture as any).subtitle ?? ""
    const baseDescription = (picture as any).description ?? ""

    if (!entry.en.title && !looksZh(baseTitle)) entry.en.title = baseTitle
    if (!entry.en.subtitle && !looksZh(baseSubtitle)) entry.en.subtitle = baseSubtitle
    if (!entry.en.description && !looksZh(baseDescription)) entry.en.description = baseDescription

    if (!entry.zh.title && looksZh(baseTitle)) entry.zh.title = baseTitle
    if (!entry.zh.subtitle && looksZh(baseSubtitle)) entry.zh.subtitle = baseSubtitle
    if (!entry.zh.description && looksZh(baseDescription)) entry.zh.description = baseDescription
  }

  const images = orderedPictures.map((picture: any) => {
    const translationEntry = pictureTranslationsMap.get(picture.id) || { en: {}, zh: {} }
    return {
      id: picture.id,
      setId: picture.picture_set_id,
      url: picture.image_url || "/placeholder.svg",
      rawUrl: picture.raw_image_url || picture.image_url,
      translations: {
        en: {
          title: translationEntry.en.title || "",
          subtitle: translationEntry.en.subtitle || "",
          description: translationEntry.en.description || "",
        },
        zh: {
          title: translationEntry.zh.title || "",
          subtitle: translationEntry.zh.subtitle || "",
          description: translationEntry.zh.description || "",
        },
      },
    }
  })

  const query = String(resolvedSearchParams?.q || "").trim()
  const firstSetId = images.find((image) => image.setId != null)?.setId
  const returnSetId = resolvedSearchParams?.returnSet || firstSetId || null
  const subtitle = query ? `"${query}"` : `${images.length} images`
  const zhSubtitle = query ? `“${query}”` : `${images.length} 张图片`

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PortfolioDetail
        id="search"
        images={images}
        translations={{
          en: {
            title: "Search Results",
            subtitle,
            description: "",
          },
          zh: {
            title: "搜索结果",
            subtitle: zhSubtitle,
            description: "",
          },
        }}
        returnContext={{
          type: "portfolio",
          returnSetId,
        }}
      />
    </Suspense>
  )
}
