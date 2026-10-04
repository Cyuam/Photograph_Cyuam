import { notFound } from "next/navigation"
import { Suspense } from "react"
import { headers } from "next/headers"
import PortfolioDetail from "@/components/portfolio-detail"
import { PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"

export const revalidate = 0

type PictureTranslation = {
  title?: string | null
  subtitle?: string | null
  description?: string | null
}

type StylePicture = {
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

const hashSeed = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash >>> 0
}

const shuffleWithSeed = <T,>(items: T[], seed: number) => {
  const next = [...items]
  let state = seed || 1
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}

const getBaseUrl = async () => {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL
  if (envBase) return envBase
  const host = (await headers()).get("host")
  if (!host) return "http://localhost:3000"
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"
  return `${protocol}://${host}`
}

export default async function StyleCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ style: string }>
  searchParams?: Promise<{
    origin?: string
    restore?: string
    returnSection?: string
  }>
}) {
  const { style: styleKey } = await params
  const resolvedSearchParams = await searchParams
  const styleConfig = PHOTOGRAPHY_STYLE_BY_ID[styleKey as keyof typeof PHOTOGRAPHY_STYLE_BY_ID]
  if (!styleConfig) {
    notFound()
  }

  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/picture-styles?style=${styleKey}`, { cache: "no-store" })
  if (!res.ok) {
    notFound()
  }

  const data = await res.json()
  const stylePayload = data?.styles?.[styleKey]
  const pictures = (stylePayload?.pictures || []) as StylePicture[]

  if (!pictures.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#f8f6f1] to-[#eaf0ff] text-gray-900">
        <div className="max-w-md text-center px-6 py-12">
          <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
            {styleConfig.labels?.en || styleConfig.tagName}
          </p>
          <h1 className="mt-3 text-2xl font-light text-gray-900">
            {styleConfig.labels?.zh || styleConfig.tagName}
          </h1>
          <p className="mt-4 text-sm text-gray-600">
            {styleKey === "travel" ? "No recent uploads yet." : "This style collection is still building."}
          </p>
        </div>
      </div>
    )
  }

  const dayKey = new Date().toISOString().slice(0, 10)
  const shuffledPictures = shuffleWithSeed(pictures, hashSeed(`${styleKey}-${dayKey}`))

  const images = shuffledPictures.map((pic) => ({
    url: pic.imageUrl || "/placeholder.svg",
    rawUrl: pic.rawImageUrl || pic.imageUrl,
    setId: pic.pictureSetId,
    translations: {
      en: {
        title: pic.translations?.en?.title || "",
        subtitle: pic.translations?.en?.subtitle || "",
        description: pic.translations?.en?.description || "",
      },
      zh: {
        title: pic.translations?.zh?.title || "",
        subtitle: pic.translations?.zh?.subtitle || "",
        description: pic.translations?.zh?.description || "",
      },
    },
  }))

  const titleEn = styleConfig.labels?.en || styleConfig.tagName
  const titleZh = styleConfig.labels?.zh || styleConfig.tagName
  const translations = {
    en: { title: titleEn, subtitle: "", description: "" },
    zh: { title: titleZh, subtitle: "", description: "" },
  }

  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-gradient-to-br from-white via-[#f8f6f1] to-[#eaf0ff]">
          <div className="h-screen animate-pulse">
            <div className="h-full w-full bg-gradient-to-br from-slate-200/70 via-slate-100 to-white" />
          </div>
        </div>
      )}
    >
      <PortfolioDetail
        id={`style-${styleKey}`}
        images={images}
        translations={translations}
        locations={[]}
        returnContext={{
          type: "portfolio",
          focusSection: resolvedSearchParams?.returnSection === "styles" ? "styles" : undefined,
          restore: resolvedSearchParams?.restore === "1" || resolvedSearchParams?.origin === "portfolio",
        }}
        viewSetContext={{ type: "style", styleKey }}
      />
    </Suspense>
  )
}
