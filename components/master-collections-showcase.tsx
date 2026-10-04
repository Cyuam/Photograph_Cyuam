"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { PHOTOGRAPHY_STYLE_BY_ID } from "@/lib/photography-styles"
import type { PhotographyStyleId } from "@/lib/photography-styles"
import { useI18n } from "@/lib/i18n"

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

type StyleApiResponse = {
  id: string
  tagName: string
  pictures: StylePicture[]
}

type MasterShot = {
  id: number
  pictureSetId: number | null
  imageUrl: string
  styleLabel: string
  styleLabelZh?: string
}

const masterCopy = {
  empty: {
    en: "No master-tagged images available right now. Please check back soon.",
    zh: "暂时没有带有“大师”标签的作品，欢迎稍后再来。",
  },
  error: {
    en: "Unable to load master shots at the moment.",
    zh: "大师作品暂时无法加载。",
  },
  labelFallback: { en: "Master Series", zh: "大师影廊" },
}

const shuffle = <T,>(items: T[]) => {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const isMasterTagged = (pool: string[]) =>
  pool.some((value) => {
    const lower = value.toLowerCase()
    return lower.includes("master") || lower.includes("大师")
  })

const toAbsoluteUrl = (rawUrl?: string | null, bucketUrl?: string) => {
  if (!rawUrl) return "/placeholder.svg?height=800&width=600"
  if (rawUrl.startsWith("http")) return rawUrl
  const prefix = bucketUrl || process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top"
  return `${prefix}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`
}

export function MasterShotsShowcase() {
  const { locale } = useI18n()
  const [shots, setShots] = useState<MasterShot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimensionsMap, setDimensionsMap] = useState<Record<number, { width: number; height: number }>>({})
  const [mobileActiveIndex, setMobileActiveIndex] = useState<number | null>(null)
  const [prefersTapExpand, setPrefersTapExpand] = useState(false)
  const bucketUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top", [])

  const [numColumns, setNumColumns] = useState(3)

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1280) {
        setNumColumns(4)
      } else {
        setNumColumns(3)
      }
    }

    updateColumns()
    window.addEventListener("resize", updateColumns)
    return () => window.removeEventListener("resize", updateColumns)
  }, [])

  const columns = useMemo(() => {
    const cols: MasterShot[][] = Array.from({ length: numColumns }, () => [])
    const colHeights = new Array(numColumns).fill(0)

    // Ensure we only show a multiple of numColumns to keep the grid even
    const validCount = shots.length - (shots.length % numColumns)
    const displayShots = shots.slice(0, validCount)

    displayShots.forEach((shot) => {
      const dims = dimensionsMap[shot.id]
      const aspectRatio = dims ? dims.width / Math.max(dims.height, 1) : 0.75
      // We use inverse aspect ratio as a proxy for height (assuming equal widths)
      const height = 1 / aspectRatio

      // Find the column with the minimum accumulated height
      let minColIndex = 0
      let minHeight = colHeights[0]

      for (let i = 1; i < numColumns; i++) {
        if (colHeights[i] < minHeight) {
          minHeight = colHeights[i]
          minColIndex = i
        }
      }

      cols[minColIndex].push(shot)
      colHeights[minColIndex] += height
    })
    return cols
  }, [shots, numColumns, dimensionsMap])

  const registerImageDimensions = useCallback((id: number, width?: number, height?: number) => {
    if (!Number.isFinite(id) || !width || !height) return
    setDimensionsMap((prev) => {
      if (prev[id]) return prev
      return { ...prev, [id]: { width, height } }
    })
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchFromPictureStyles = async (): Promise<MasterShot[]> => {
      const res = await fetch("/api/picture-styles", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Fallback fetch failed (${res.status})`)
      }
      const json = await res.json()
      const payload = (json?.styles || {}) as Record<string, StyleApiResponse>
      const shotList: MasterShot[] = []
      const seenPictureIds = new Set<number>()

      Object.values(payload).forEach((style) => {
        const meta = PHOTOGRAPHY_STYLE_BY_ID[style.id as PhotographyStyleId]
        const styleLabel = meta?.labels?.en || meta?.labels?.zh || style.tagName || "Master"
        const styleLabelZh = meta?.labels?.zh || meta?.labels?.en || style.tagName || "大师"
        for (const picture of style.pictures || []) {
          const pool = [...(picture.tags || []), ...(picture.categories || [])]
          if (!isMasterTagged(pool)) continue
          if (!picture.id || seenPictureIds.has(picture.id)) continue
          seenPictureIds.add(picture.id)
          shotList.push({
            id: picture.id,
            pictureSetId: picture.set?.id || picture.pictureSetId || null,
            imageUrl: toAbsoluteUrl(picture.imageUrl, bucketUrl),
            styleLabel,
            styleLabelZh,
          })
        }
      })

      return shuffle(shotList)
    }

    const fetchMasterShots = async () => {
      try {
        const res = await fetch("/api/master-shots?limit=24", { cache: "no-store" })
        if (!res.ok) {
          throw new Error(`Failed to load master shots (${res.status})`)
        }
        const json = await res.json()
        if (isMounted) {
          const normalized = (json?.shots || []).map((shot: MasterShot) => ({
            ...shot,
            imageUrl: toAbsoluteUrl(shot?.imageUrl, bucketUrl),
          }))
          setShots(shuffle(normalized))
          setError(null)
        }
      } catch (err: any) {
        console.error("Primary master shots fetch failed, trying fallback:", err)
        try {
          const fallbackShots = await fetchFromPictureStyles()
          if (isMounted) {
            setShots(fallbackShots.slice(0, 24))
            setError(null)
          }
        } catch (fallbackErr: any) {
          console.error("Fallback master shots fetch failed:", fallbackErr)
          if (isMounted) {
            setError(fallbackErr?.message || "Unable to load master shots")
          }
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchMasterShots()
    return () => {
      isMounted = false
    }
  }, [bucketUrl])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(hover: none)")
    const update = () => setPrefersTapExpand(mq.matches)
    update()
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, idx) => (
          <div key={idx} className="rounded-2xl bg-white/5 p-6">
            <div className="h-48 w-full animate-pulse rounded-xl bg-white/10" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/20 p-6 text-sm text-red-200">
        {masterCopy.error[locale]}
      </div>
    )
  }

  if (!shots.length) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/5 p-6 text-sm text-white/70">
        {masterCopy.empty[locale]}
      </div>
    )
  }

  const overlapAmount = 70
  const baseCardHeight = 220

  const renderMobileStack = () => (
    <div className="mx-auto w-full max-w-4xl lg:hidden">
      <div
        className="relative flex flex-col items-center"
        onMouseLeave={() => setMobileActiveIndex(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setMobileActiveIndex(null)
          }
        }}
      >
        {shots.map((shot, index) => {
          const dims = dimensionsMap[shot.id]
          const aspectRatio = dims ? dims.width / Math.max(dims.height, 1) : undefined
          const imageHeight = baseCardHeight
          const isActive = mobileActiveIndex === index
          const offset =
            mobileActiveIndex === null
              ? 0
              : index < (mobileActiveIndex ?? 0)
                ? -45
                : index > (mobileActiveIndex ?? 0)
                  ? 45
                  : 0
          const scale = isActive ? 1.03 : 1
          const zIndex =
            mobileActiveIndex === null
              ? shots.length - index
              : isActive
                ? shots.length + 10
                : shots.length - index - 1


          return (
            <div
              key={shot.id}
              className="w-full max-w-3xl"
              style={{ marginTop: index === 0 ? 0 : -overlapAmount }}
            >
              <Link
                href={shot.pictureSetId ? `/work/${shot.pictureSetId}` : "#"}
                className="group relative block overflow-hidden rounded-[28px] border border-white/20 bg-white/5 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.65)] transition-all duration-500"
                style={{
                  height: imageHeight,
                  transform: `translateY(${offset}px) scale(${scale})`,
                  zIndex,
                }}
                onMouseEnter={() => setMobileActiveIndex(index)}
                onFocus={() => setMobileActiveIndex(index)}
                onBlur={() => setMobileActiveIndex(null)}
                onClick={(event) => {
                  if (!prefersTapExpand) return
                  if (mobileActiveIndex !== index) {
                    event.preventDefault()
                    setMobileActiveIndex(index)
                  }
                }}
              >
                <div className="absolute inset-0">
                  <Image
                    src={shot.imageUrl}
                    alt={shot.styleLabel}
                    fill
                    sizes="(max-width: 640px) 90vw, (max-width: 1024px) 70vw, 720px"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    onLoadingComplete={({ naturalWidth, naturalHeight }) =>
                      registerImageDimensions(shot.id, naturalWidth, naturalHeight)
                    }
                    style={{
                      objectPosition: aspectRatio && aspectRatio < 1 ? "center top" : "center",
                    }}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-70 transition group-hover:opacity-30" />

              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )



  const renderDesktopGrid = () => (
    <div className="hidden w-full lg:block">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex gap-4 items-start">
          {columns.map((colShots, colIndex) => (
            <div key={colIndex} className="flex-1 flex flex-col gap-4">
              {colShots.map((shot, index) => {
                const dims = dimensionsMap[shot.id]
                const aspectRatio = dims ? dims.width / Math.max(dims.height, 1) : undefined
                const fallbackRatio = aspectRatio && Number.isFinite(aspectRatio) ? aspectRatio : 0.75


                return (
                  <div
                    key={shot.id}
                    className="w-full transition-opacity duration-500 ease-out"
                    style={{
                      opacity: 1,
                      animationDelay: `${(index * numColumns + colIndex) * 80}ms`,
                    }}
                  >
                    <Link
                      href={shot.pictureSetId ? `/work/${shot.pictureSetId}` : "#"}
                      className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/30"
                    >
                      <div className="relative w-full" style={{ aspectRatio: fallbackRatio }}>
                        <Image
                          src={shot.imageUrl}
                          alt={shot.styleLabel}
                          fill
                          sizes="(max-width: 1024px) 45vw, (max-width: 1536px) 30vw, 400px"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          onLoadingComplete={({ naturalWidth, naturalHeight }) =>
                            registerImageDimensions(shot.id, naturalWidth, naturalHeight)
                          }
                        />
                      </div>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                    </Link>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {renderMobileStack()}
      {renderDesktopGrid()}
    </>
  )
}
