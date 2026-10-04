"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import clsx from "clsx"
import { PHOTOGRAPHY_STYLES } from "@/lib/photography-styles"
import { useI18n } from "@/lib/i18n"
import { ArrowUpRight } from "lucide-react"
import { useRouter } from "next/navigation"
import portfolioImageLoader from "@/lib/portfolio-image-loader"

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

type StyleApiResponse = {
  id: string
  tagName: string
  pictures: StylePicture[]
}

const FALLBACK_DELAY_MS = 15_000
const DELAY_VARIANCE_MS = 6_000
const HOVER_INTENT_DELAY_MS = 90
const PREVIEW_QUALITY = 55
const PREVIEW_PREFETCH_WIDTH = 800
const PREVIEW_SIZES = "(min-width: 1280px) 25vw, (min-width: 768px) 45vw, 90vw"
const STYLE_NAVIGATION_DELAY_MS = 420

let stylesPayloadPromise: Promise<Record<string, StyleApiResponse>> | null = null

const normalizeStylesPayload = (payload: Record<string, StyleApiResponse>) => {
  const normalized: Record<string, StyleApiResponse> = {}
  for (const [key, value] of Object.entries(payload)) {
    normalized[key] = {
      ...value,
      pictures: (value?.pictures || []).map((picture) => ({
        ...picture,
        tags: Array.isArray(picture.tags) ? picture.tags : [],
        categories: Array.isArray(picture.categories) ? picture.categories : [],
      })),
    }
  }
  return normalized
}

const loadStylesPayload = async () => {
  const res = await fetch("/api/picture-styles")
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return normalizeStylesPayload((data?.styles || {}) as Record<string, StyleApiResponse>)
}

export const preloadPhotographyStyles = () => {
  if (typeof window === "undefined") return null
  if (!stylesPayloadPromise) {
    stylesPayloadPromise = loadStylesPayload().catch((error) => {
      stylesPayloadPromise = null
      throw error
    })
  }
  return stylesPayloadPromise
}

const savePortfolioReturnState = () => {
  if (typeof window === "undefined") return

  const scrollRoot = document.querySelector<HTMLDivElement>("[data-portfolio-scroll-root]")
  const topRow = document.querySelector<HTMLDivElement>('[data-portfolio-row="top"]')
  const bottomRow = document.querySelector<HTMLDivElement>('[data-portfolio-row="bottom"]')

  window.sessionStorage.setItem("portfolio:return-scroll", String(scrollRoot?.scrollTop ?? window.scrollY ?? 0))
  window.sessionStorage.setItem("portfolio:return-top-row-scroll", String(topRow?.scrollLeft ?? 0))
  window.sessionStorage.setItem("portfolio:return-bottom-row-scroll", String(bottomRow?.scrollLeft ?? 0))
}

export function PhotographyStyleShowcase() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const bucketUrl = useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || "https://s3.cunyli.top", [])

  const [stylesData, setStylesData] = useState<Record<string, StyleApiResponse>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStyle, setActiveStyle] = useState<string | null>(null)
  const [styleNavigating, setStyleNavigating] = useState(false)
  const [visibleIndex, setVisibleIndex] = useState<Record<string, number>>({})
  const rotationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [landscapeMap, setLandscapeMap] = useState<Record<string, Record<number, boolean>>>({})
  const [, startHighlightTransition] = useTransition()
  const hoverTimerRef = useRef<number | null>(null)
  const prefetchedImagesRef = useRef<Set<string>>(new Set())
  const [hoveredMobileIndex, setHoveredMobileIndex] = useState<number | null>(null)
  const [activeMobileStyleId, setActiveMobileStyleId] = useState<string | null>(null) // 追踪手机端当前激活的风格
  const scrollThrottleTimer = useRef<number | null>(null) // 滚动节流定时器
  const lastVibrateStyleId = useRef<string | null>(null) // 记录上次触发震动的风格ID

  const updateOrientation = useCallback((styleId: string | null, pictureId: number, width?: number, height?: number) => {
    if (!styleId) return
    if (!Number.isFinite(pictureId)) return
    if (!width || !height) return
    const isLandscape = width >= height
    setLandscapeMap((prev) => {
      const styleEntry = prev[styleId] || {}
      if (styleEntry[pictureId] === isLandscape) return prev
      return {
        ...prev,
        [styleId]: {
          ...styleEntry,
          [pictureId]: isLandscape,
        },
      }
    })
  }, [])

  const hasMasterTag = useCallback((picture: StylePicture) => {
    const pool = [...(picture.tags || []), ...(picture.categories || [])]
    return pool.some((value) => {
      const lower = value.toLowerCase()
      return lower.includes('大师') || lower.includes('master')
    })
  }, [])

  const eligibleCache = useMemo(() => {
    const cache: Record<string, number[]> = {}
    for (const style of PHOTOGRAPHY_STYLES) {
      const pictures = stylesData[style.id]?.pictures || []
      if (!pictures.length) {
        cache[style.id] = []
        continue
      }
      const orientationMap = landscapeMap[style.id] || {}
      const tierPreferred: number[] = []
      const tierFallback: number[] = []
      pictures.forEach((picture, idx) => {
        if (!hasMasterTag(picture)) return
        const orientationValue = orientationMap[picture.id]
        if (orientationValue === true) {
          tierPreferred.push(idx)
        } else if (orientationValue === undefined) {
          tierFallback.push(idx)
        }
      })
      if (tierPreferred.length > 0) {
        cache[style.id] = tierPreferred
      } else if (tierFallback.length > 0) {
        cache[style.id] = tierFallback
      } else {
        cache[style.id] = []
      }
    }
    return cache
  }, [hasMasterTag, landscapeMap, stylesData])

  const getEligibleIndices = useCallback((styleId: string) => eligibleCache[styleId] || [], [eligibleCache])

  const pickNextEligibleIndex = useCallback(
    (styleId: string, eligible: number[], current: number, usedPictureIds: Set<number>) => {
      if (eligible.length === 0) return -1
      const pictures = stylesData[styleId]?.pictures || []
      const pickWithCheck = (indices: number[], fallback?: number) => {
        for (const idx of indices) {
          const picture = pictures[idx]
          if (!picture) continue
          if (!usedPictureIds.has(picture.id)) return idx
        }
        return fallback ?? -1
      }

      const shuffled = [...eligible]
      if (!eligible.includes(current)) {
        const preferred = pickWithCheck(shuffled)
        return preferred !== -1 ? preferred : eligible[0]
      }

      const withoutCurrent = shuffled.filter((idx) => idx !== current)
      const preferred = pickWithCheck(withoutCurrent)
      if (preferred !== -1) return preferred

      const allowCurrent = pickWithCheck([current], current)
      if (allowCurrent !== -1) return allowCurrent

      return pickWithCheck(shuffled, eligible[0])
    },
    [stylesData],
  )

  const fetchStyles = useCallback(async () => {
    try {
      setLoading(true)
      const normalized = await (preloadPhotographyStyles() ?? loadStylesPayload())
      setStylesData(normalized)
      const nextVisible: Record<string, number> = {}
      for (const style of PHOTOGRAPHY_STYLES) {
        const pictures = normalized[style.id]?.pictures || []
        nextVisible[style.id] = pictures.length ? 0 : -1
      }
      setVisibleIndex(nextVisible)
      setError(null)
    } catch (err: any) {
      console.error("Failed to load photography styles", err)
      setError(err?.message || "Failed to load styles")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStyles().catch(() => {})
  }, [fetchStyles])

  useEffect(() => {
    // Clear existing timers before scheduling new ones
    Object.values(rotationTimers.current).forEach((timer) => clearTimeout(timer))
    rotationTimers.current = {}

    for (const style of PHOTOGRAPHY_STYLES) {
      const schedule = () => {
        const eligibleIndices = getEligibleIndices(style.id)
        if (eligibleIndices.length <= 1) return
        const delay = FALLBACK_DELAY_MS + Math.random() * DELAY_VARIANCE_MS
        rotationTimers.current[style.id] = setTimeout(() => {
          setVisibleIndex((prev) => {
            const currentEligible = getEligibleIndices(style.id)
            if (currentEligible.length === 0) return prev
            const current = prev[style.id] ?? currentEligible[0]
            const usedPictureIds = new Set<number>()
            for (const otherStyle of PHOTOGRAPHY_STYLES) {
              if (otherStyle.id === style.id) continue
              const idx = prev[otherStyle.id]
              if (idx == null || idx < 0) continue
              const picture = stylesData[otherStyle.id]?.pictures?.[idx]
              if (picture) usedPictureIds.add(picture.id)
            }
            const next = pickNextEligibleIndex(style.id, currentEligible, current, usedPictureIds)
            if (next === -1 || next === current) return prev
            return { ...prev, [style.id]: next }
          })
          schedule()
        }, delay)
      }
      schedule()
    }

    return () => {
      Object.values(rotationTimers.current).forEach((timer) => clearTimeout(timer))
      rotationTimers.current = {}
    }
  }, [getEligibleIndices, pickNextEligibleIndex, stylesData])

  const handleOpenStyle = useCallback((styleId: string) => {
    if (styleNavigating) return
    savePortfolioReturnState()
    const params = new URLSearchParams()
    params.set("origin", "portfolio")
    params.set("returnSection", "styles")
    params.set("restore", "1")
    setStyleNavigating(true)
    window.setTimeout(() => {
      router.push(`/work/style/${styleId}?${params.toString()}`)
    }, STYLE_NAVIGATION_DELAY_MS)
  }, [router, styleNavigating])

  const prefetchPreview = useCallback((styleId: string | null) => {
    if (typeof window === 'undefined') return
    if (!styleId) return
    const pictures = stylesData[styleId]?.pictures || []
    if (!pictures.length) return
    const eligible = getEligibleIndices(styleId)
    const candidateIdx = eligible.length ? eligible[0] : 0
    const candidate = pictures[candidateIdx]
    if (!candidate) return
    const src = candidate.imageUrl?.startsWith("http")
      ? candidate.imageUrl
      : `${bucketUrl}${candidate.imageUrl}`
    if (!src) return
    const optimizedSrc = portfolioImageLoader({ src, width: PREVIEW_PREFETCH_WIDTH })
    if (prefetchedImagesRef.current.has(optimizedSrc)) return
    const img = new window.Image()
    img.decoding = "async"
    img.src = optimizedSrc
    prefetchedImagesRef.current.add(optimizedSrc)
  }, [bucketUrl, getEligibleIndices, stylesData])

  const handleHighlightChange = useCallback((next: string | null) => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (next === null) {
      startHighlightTransition(() => {
        setActiveStyle((prev) => (prev === null ? prev : null))
      })
      return
    }

    if (typeof window !== 'undefined') {
      prefetchPreview(next)
    }

    hoverTimerRef.current = window.setTimeout(() => {
      startHighlightTransition(() => {
        setActiveStyle((prev) => (prev === next ? prev : next))
      })
    }, HOVER_INTENT_DELAY_MS)
  }, [prefetchPreview, startHighlightTransition])

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current != null) {
        window.clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      // 清理滚动节流定时器
      if (scrollThrottleTimer.current != null) {
        window.cancelAnimationFrame(scrollThrottleTimer.current)
        scrollThrottleTimer.current = null
      }
    }
  }, [])

  useEffect(() => {
    setVisibleIndex((prev) => {
      let changed = false
      const next = { ...prev }
      const usedPictureIds = new Set<number>()
      for (const style of PHOTOGRAPHY_STYLES) {
        const idx = prev[style.id]
        if (idx == null || idx < 0) continue
        const picture = stylesData[style.id]?.pictures?.[idx]
        if (picture) usedPictureIds.add(picture.id)
      }

      for (const style of PHOTOGRAPHY_STYLES) {
        const pictures = stylesData[style.id]?.pictures || []
        const eligible = getEligibleIndices(style.id)
        if (!eligible.length) {
          if ((prev[style.id] ?? 0) !== -1) {
            next[style.id] = -1
            changed = true
          }
          continue
        }
        const current = prev[style.id]
        let candidate = eligible.find((idx) => {
          const picture = pictures[idx]
          if (!picture) return false
          return !usedPictureIds.has(picture.id)
        })
        if (candidate == null) {
          candidate = eligible[0]
        }
        const picture = pictures[candidate]
        if (picture) usedPictureIds.add(picture.id)
        if (current !== candidate) {
          next[style.id] = candidate
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [getEligibleIndices, stylesData])

  const highlightStyleId = activeStyle ?? null

  useEffect(() => {
    if (typeof window === 'undefined') return
    prefetchPreview(highlightStyleId)
  }, [highlightStyleId, prefetchPreview])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const primaryStyle = PHOTOGRAPHY_STYLES[0]?.id
    if (primaryStyle) prefetchPreview(primaryStyle)
  }, [prefetchPreview, stylesData])

  const loadingState = loading && Object.keys(stylesData).length === 0
  const styleCards = PHOTOGRAPHY_STYLES.map((style, idx) => {
    const pictures = stylesData[style.id]?.pictures || []
    const eligible = getEligibleIndices(style.id)
    const activeIndex = visibleIndex[style.id] ?? (eligible[0] ?? -1)
    const preview = activeIndex >= 0 ? pictures[activeIndex] : undefined
    const orientationMap = landscapeMap[style.id] || {}
    const previewOrientation = preview ? orientationMap[preview.id] : undefined
    const isActive = highlightStyleId === style.id
    const translateY = isActive ? "-8px" : "0px"
    const scale = activeStyle ? (isActive ? 1.035 : 0.98) : 1
    const hasContent = eligible.length > 0
    const isFirst = idx === 0
    const isLast = idx === PHOTOGRAPHY_STYLES.length - 1

    return {
      style,
      idx,
      pictures,
      eligible,
      activeIndex,
      preview,
      isActive,
      translateY,
      scale,
      hasContent,
      isFirst,
      isLast,
      previewOrientation,
    }
  })

  return (
    <section className="mt-16 sm:mt-24">
      <div
        className={`pointer-events-none fixed inset-0 z-[10000] bg-white transition-opacity duration-500 ease-out ${styleNavigating ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="text-center max-w-3xl mx-auto mb-2 sm:mb-4">
          <h2 className="text-lg sm:text-2xl font-medium text-slate-900 tracking-[0.08em] uppercase">
            {t("styleShowcaseTitle")}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500/80">
            {t("styleShowcaseSubtitle")}
          </p>
        </div>

        {loadingState && (
          <div className="grid gap-2.5 md:grid-cols-4">
            {PHOTOGRAPHY_STYLES.map((style) => (
              <div
                key={style.id}
                className="h-64 rounded-[2.5rem] bg-gradient-to-br from-gray-200 via-gray-100 to-white animate-pulse"
              />
            ))}
          </div>
        )}

        {!loadingState && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loadingState && !error && (
          <>
            <div className="md:hidden -mx-4 relative">
              {/* 边缘渐隐遮罩 */}
              <div className="absolute inset-0 pointer-events-none z-10" style={{
                maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
              }} />
              
              <div
                data-style-scroll-container
                className="flex gap-0 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ WebkitOverflowScrolling: "touch", paddingLeft: "0.875rem", paddingRight: "0.875rem" }}
                onScroll={(e) => {
                  // 滚动节流优化 - 使用 requestAnimationFrame
                  if (scrollThrottleTimer.current !== null) {
                    return
                  }
                  
                  // 保存 container 引用，避免在异步回调中丢失
                  const container = e.currentTarget
                  
                  scrollThrottleTimer.current = window.requestAnimationFrame(() => {
                    scrollThrottleTimer.current = null
                    
                    // 检查 container 是否仍然存在
                    if (!container || !container.scrollLeft === undefined) {
                      return
                    }
                    
                    // 检测当前中心位置的卡片
                    const scrollLeft = container.scrollLeft
                    const containerWidth = container.clientWidth
                    const centerPos = scrollLeft + containerWidth / 2
                    
                    let closestStyleId: string | null = null
                    let minDistance = Infinity
                    
                    Array.from(container.children).forEach((child, idx) => {
                      const element = child as HTMLElement
                      const rect = element.getBoundingClientRect()
                      const containerRect = container.getBoundingClientRect()
                      const childCenter = rect.left - containerRect.left + scrollLeft + rect.width / 2
                      const distance = Math.abs(childCenter - centerPos)
                      
                      if (distance < minDistance) {
                        minDistance = distance
                        closestStyleId = PHOTOGRAPHY_STYLES[idx]?.id || null
                      }
                    })
                    
                    if (closestStyleId !== activeMobileStyleId) {
                      setActiveMobileStyleId(closestStyleId)
                      
                      // 触觉反馈 - 当切换到新卡片时振动
                      if (closestStyleId && closestStyleId !== lastVibrateStyleId.current) {
                        lastVibrateStyleId.current = closestStyleId
                        // 检查设备是否支持振动API
                        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                          try {
                            navigator.vibrate(50) // 轻微振动50毫秒
                          } catch (error) {
                            // 忽略振动错误
                          }
                        }
                      }
                    }
                  })
                }}
              >
                {styleCards.map(({ style, preview, hasContent, pictures, previewOrientation, isActive, isFirst, isLast }, cardIdx) => {
                  const isMobileActive = activeMobileStyleId === style.id
                  const shouldContain = previewOrientation === false && (isActive || isMobileActive)
                  const clipPath = isFirst
                    ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                    : isLast
                      ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                      : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
                  
                  return (
                  <button
                    key={`${style.id}-mobile`}
                    type="button"
                    onClick={() => handleOpenStyle(style.id)}
                    onTouchStart={() => setActiveMobileStyleId(style.id)}
                    className="snap-center relative inline-flex h-[320px] min-h-[320px] flex-shrink-0 overflow-hidden bg-slate-900 text-left shadow-[0_24px_70px_-42px_rgba(15,23,42,0.85)] transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-[0.96]"
                    style={{
                      clipPath,
                      width: 'calc(100vw - 4rem)',
                      maxWidth: '300px',
                      marginRight: isLast ? '0' : '-10%',
                      marginLeft: isFirst ? '0' : '-10%',
                      transform: isMobileActive ? 'scale(1.015) translateY(-5px)' : 'scale(1) translateY(0)',
                      zIndex: isMobileActive ? 20 : 10 - cardIdx,
                      filter: isMobileActive ? 'brightness(1.1)' : 'brightness(0.95)',
                    }}
                  >
                    <div className="absolute inset-0">
                      {preview ? (
                        <Image
                          key={`${style.id}-mobile-${preview.id}`}
                          src={preview.imageUrl ? `${bucketUrl}${preview.imageUrl}` : "/placeholder.svg"}
                          alt={preview.translations[locale as "zh" | "en"]?.title || preview.translations.en?.title || t(style.i18nKey)}
                          fill
                          quality={PREVIEW_QUALITY}
                          sizes={PREVIEW_SIZES}
                          // 图片优先级优化：第一张优先加载，第二张预加载，其余懒加载
                          priority={cardIdx < 4}
                          loading={cardIdx < 4 ? "eager" : "lazy"}
                          className={clsx(
                            "transition-all ease-out object-center",
                            shouldContain ? "object-contain" : "object-cover",
                            isMobileActive 
                              ? shouldContain ? "scale-100 duration-700" : "scale-[1.08] duration-700"
                              : shouldContain ? "scale-100 duration-1000" : "scale-[1.02] duration-1000"
                          )}
                          onLoad={(e) => {
                            const img = e.target as HTMLImageElement
                            updateOrientation(style.id, preview.id, img.naturalWidth, img.naturalHeight)
                          }}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                      )}
                      <div 
                        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/85 transition-opacity duration-500"
                        style={{ opacity: isMobileActive ? 0.6 : 0.8 }}
                      />
                      <div 
                        className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(148,163,184,0.3),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.28),transparent_60%)] opacity-70 mix-blend-screen transition-opacity duration-500"
                        style={{ opacity: isMobileActive ? 0.9 : 0.6 }}
                      />
                    </div>

                    <div className="relative z-10 flex h-full flex-col justify-between p-5 transition-all duration-500">
                      <div 
                        className="flex w-full items-center gap-3 text-white/70 transition-all duration-500"
                        style={{ 
                          opacity: isMobileActive ? 1 : 0.8,
                          transform: isMobileActive ? 'translateY(0)' : 'translateY(4px)'
                        }}
                      >
                        {hasContent && (
                          <span className="ml-auto text-[10px] uppercase tracking-[0.4em] text-white/55">
                            {pictures.length} {locale === "zh" ? "张" : "photos"}
                          </span>
                        )}
                      </div>
                      <div 
                        className="space-y-2 transition-all duration-500"
                        style={{ 
                          transform: isMobileActive ? 'translateY(0)' : 'translateY(8px)',
                          opacity: isMobileActive ? 1 : 0.9
                        }}
                      >
                        <h3 className="text-[1.55rem] font-extralight text-white drop-shadow-xl">
                          {t(style.i18nKey)}
                        </h3>
                      </div>
                      <div 
                        className="flex w-full items-center gap-2 transition-all duration-500"
                        style={{ 
                          opacity: isMobileActive ? 1 : 0.8,
                          transform: isMobileActive ? 'translateX(0)' : 'translateX(-4px)'
                        }}
                      >
                        {!hasContent && (
                          <span className="text-[11px] uppercase tracking-[0.45em] text-white/80">
                            {t("styleEmpty")}
                          </span>
                        )}
                        <ArrowUpRight 
                          className="ml-auto h-4 w-4 text-white/85 transition-all duration-500" 
                          style={{
                            transform: isMobileActive ? 'translate(4px, -4px)' : 'translate(0, 0)'
                          }}
                        />
                      </div>
                    </div>
                  </button>
                )})}
              </div>
              
              {/* 滚动指示器 */}
              <div className="flex justify-center items-center gap-2 mt-3">
                {PHOTOGRAPHY_STYLES.map((style, idx) => {
                  const isActive = activeMobileStyleId === style.id
                  return (
                    <button
                      key={`indicator-${style.id}`}
                      type="button"
                      onClick={() => {
                        // 点击指示器滚动到对应卡片
                        const container = document.querySelector('[data-style-scroll-container]') as HTMLElement
                        if (container) {
                          const cardWidth = container.clientWidth - 32 // 减去padding
                          const scrollTo = idx * (cardWidth * 0.88) // 考虑12%重叠
                          container.scrollTo({ left: scrollTo, behavior: 'smooth' })
                        }
                      }}
                      className="transition-all duration-300 rounded-full"
                      style={{
                        width: isActive ? '32px' : '8px',
                        height: '8px',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.8)' : 'rgba(148, 163, 184, 0.3)',
                      }}
                      aria-label={`${t(style.i18nKey)} ${idx + 1}/${PHOTOGRAPHY_STYLES.length}`}
                    />
                  )
                })}
              </div>
            </div>

            <div className="hidden md:flex md:flex-row [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)] overflow-hidden">
              {styleCards.map(({ style, preview, hasContent, pictures, isFirst, isLast, isActive, translateY, scale, previewOrientation }, cardIdx) => {
                const clipPath = isFirst
                  ? "polygon(0% 0, 100% 0, 94% 100%, 0% 100%)"
                  : isLast
                    ? "polygon(6% 0, 100% 0, 100% 100%, 0% 100%)"
                    : "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)"
                const shouldContain = previewOrientation === false && isActive

                return (
                  <button
                    key={style.id}
                    type="button"
                    onMouseEnter={() => handleHighlightChange(style.id)}
                    onMouseLeave={() => handleHighlightChange(null)}
                    onFocus={() => handleHighlightChange(style.id)}
                    onBlur={() => handleHighlightChange(null)}
                    onClick={() => handleOpenStyle(style.id)}
                    className="group relative min-h-[320px] flex-1 bg-black/70 text-left transition-transform duration-500 transform-gpu"
                    style={{
                      clipPath,
                      marginRight: isLast ? undefined : "-5%",
                      marginLeft: isFirst ? undefined : "-5%",
                      zIndex: isActive ? 25 : 10,
                      transform: `translateY(${translateY}) scale(${scale})`,
                      transition: "transform 360ms cubic-bezier(0.24,1,0.32,1), box-shadow 360ms cubic-bezier(0.24,1,0.32,1)",
                      willChange: "transform",
                      contain: "paint",
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 origin-center overflow-hidden">
                        {preview ? (
                          <Image
                            key={`${style.id}-${preview.id}`}
                            src={preview.imageUrl ? `${bucketUrl}${preview.imageUrl}` : "/placeholder.svg"}
                            alt={preview.translations[locale as "zh" | "en"]?.title || preview.translations.en?.title || t(style.i18nKey)}
                            fill
                            quality={PREVIEW_QUALITY}
                            sizes={PREVIEW_SIZES}
                            className={clsx(
                              "image-fade-soft transform-gpu transition-transform ease-out object-center",
                              shouldContain ? "object-contain" : "object-cover",
                              shouldContain ? "scale-100 group-hover:scale-100" : "scale-[1.02] group-hover:scale-[1.08]"
                            )}
                            style={{ willChange: "transform, opacity", transitionDuration: '1200ms' }}
                            priority={cardIdx < 4}
                            loading={cardIdx < 4 ? "eager" : "lazy"}
                            onLoad={(e) => {
                              const img = e.target as HTMLImageElement
                              updateOrientation(style.id, preview.id, img.naturalWidth, img.naturalHeight)
                            }}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-300 via-slate-200 to-white" />
                        )}
                        <div
                          className={`absolute inset-0 bg-gradient-to-br from-black/80 via-black/30 to-black/75 transition-opacity duration-500 ${isActive ? "opacity-25" : "opacity-55"}`}
                          style={{ willChange: "opacity" }}
                        />
                      </div>
                    </div>

                    <div className="relative z-10 flex h-full flex-col justify-between px-6 py-8 md:px-8 md:py-10 space-y-6 transition-opacity duration-300 ease-out">
                      <div className="flex w-full items-center gap-3 text-white/70">
                        {hasContent && (
                          <span className="ml-auto text-[10px] uppercase tracking-[0.4em] text-white/50">
                            {pictures.length} {locale === "zh" ? "张" : "photos"}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[1.9rem] md:text-[2.2rem] font-extralight text-white drop-shadow-lg transition-transform duration-500 ease-out group-hover:-translate-y-[3px]">
                          {t(style.i18nKey)}
                        </h3>
                      </div>
                      <div className="flex w-full items-center gap-2">
                        {!hasContent && (
                          <span className="text-[11px] uppercase tracking-[0.45em] text-white/75 transition-transform duration-500 ease-out group-hover:translate-x-1">
                            {t("styleEmpty")}
                          </span>
                        )}
                        <ArrowUpRight className="ml-auto h-4 w-4 text-white/80 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:-translate-y-1.5" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default PhotographyStyleShowcase
