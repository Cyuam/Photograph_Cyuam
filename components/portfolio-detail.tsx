"use client"

import { ChevronDown, Grid, Home, Info } from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useCallback, useRef } from "react"
import { Carousel } from "@/components/carousel"
import { useI18n } from "@/lib/i18n"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"

interface LocalizedContent {
  title?: string
  subtitle?: string
  description?: string
}

interface ImageItem {
  id?: number | string | null
  url: string
  rawUrl?: string | null
  setId?: number | string | null
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

interface PortfolioDetailProps {
  id: string
  images: ImageItem[]
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
  locations?: unknown[]
  returnContext?: {
    type: "portfolio" | "style"
    returnSetId?: number | string | null
    styleKey?: string | null
    styleIndex?: number | null
    focusSection?: string | null
    restore?: boolean
  }
  viewSetContext?: {
    type: "style"
    styleKey: string
  } | null
}

export default function PortfolioDetail({ images, translations, locations = [], returnContext, viewSetContext = null }: PortfolioDetailProps) {
  const searchParams = useSearchParams()
  const requestedPictureId = searchParams.get('pictureId')
  const pictureIndex = requestedPictureId
    ? images.findIndex((image) => String(image.id) === requestedPictureId)
    : -1
  const initialIndex = pictureIndex >= 0 ? pictureIndex : parseInt(searchParams.get('index') || '0', 10)
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const mobileThumbnailsRef = useRef<HTMLDivElement | null>(null)
  const { locale } = useI18n()
  const router = useRouter()
  const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top'
  const currentImage = images[currentIndex]

  const activeSetContent = locale === 'zh' ? translations.zh : translations.en
  const fallbackSetContent = locale === 'zh' ? translations.en : translations.zh
  const displayTitle = activeSetContent.title || fallbackSetContent.title || ''
  const displaySubtitle = activeSetContent.subtitle || fallbackSetContent.subtitle || ''
  const displayDescription = activeSetContent.description || fallbackSetContent.description || ''

  const activeImageContent = locale === 'zh' ? currentImage?.translations.zh : currentImage?.translations.en
  const fallbackImageContent = locale === 'zh' ? currentImage?.translations.en : currentImage?.translations.zh
  const displayImageTitle = activeImageContent?.title || fallbackImageContent?.title || ''
  const displayImageDescription = activeImageContent?.description || fallbackImageContent?.description || ''
  const locationBadges = (locations || []).map((loc: any, index: number) => {
    const preferred =
      locale === 'zh'
        ? loc?.name_zh || loc?.name || loc?.name_en
        : loc?.name_en || loc?.name || loc?.name_zh
    const label = (preferred && preferred.toString().trim().length > 0)
      ? preferred.toString().trim()
      : locale === 'zh'
        ? '未标记地点'
        : 'Untitled Location'
    return {
      key: loc?.id ?? `loc-${index}`,
      label,
      isPrimary: Boolean(loc?.isPrimary),
    }
  })

  const handleImageChange = (index: number) => {
    setCurrentIndex(index)
  }

  const resolveHomeHref = useCallback(() => {
    if (returnContext?.type === "style" && returnContext.styleKey) {
      const params = new URLSearchParams()
      const styleIndex = typeof returnContext.styleIndex === "number" ? returnContext.styleIndex : 0
      params.set("index", String(styleIndex))
      return `/work/style/${returnContext.styleKey}?${params.toString()}`
    }

    if (returnContext?.type === "portfolio") {
      const params = new URLSearchParams()
      if (returnContext.restore !== false) {
        params.set("restore", "1")
      }
      if (returnContext.returnSetId != null) {
        params.set("focusSet", String(returnContext.returnSetId))
      }
      if (returnContext.focusSection) {
        params.set("focusSection", returnContext.focusSection)
      }
      const query = params.toString()
      return query ? `/portfolio?${query}` : "/portfolio"
    }

    return "/portfolio"
  }, [returnContext])

  const handleBack = useCallback(() => {
    if (isLeaving) return
    setIsLeaving(true)
    const targetHref = resolveHomeHref()
    window.setTimeout(() => {
      router.push(targetHref)
    }, 180)
  }, [isLeaving, resolveHomeHref, router])

  const handleViewSet = useCallback((setId: number | string) => {
    if (isLeaving) return
    setIsLeaving(true)
    if (viewSetContext?.type === "style") {
      const params = new URLSearchParams()
      params.set("style", viewSetContext.styleKey)
      params.set("origin", "style")
      params.set("originStyle", viewSetContext.styleKey)
      params.set("originIndex", String(currentIndex))
      window.setTimeout(() => {
        router.push(`/work/${setId}?${params.toString()}`)
      }, 180)
      return
    }

    window.setTimeout(() => {
      router.push(`/work/${setId}`)
    }, 180)
  }, [currentIndex, isLeaving, router, viewSetContext])


  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1
        setCurrentIndex(newIndex)
      } else if (e.key === "ArrowRight") {
        const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1
        setCurrentIndex(newIndex)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, images.length])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsEntering(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!showThumbnails || typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 1023px)").matches) return

    const timer = window.setTimeout(() => {
      mobileThumbnailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 120)

    return () => window.clearTimeout(timer)
  }, [showThumbnails])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-white via-[#f8f6f1] to-[#eaf0ff] text-gray-900">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_45%)]" />
      <div
        className={`pointer-events-none fixed inset-0 z-[10000] bg-white transition-opacity duration-500 ease-out ${isEntering || isLeaving ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      />
      <div className="relative flex min-h-screen flex-col">
        <div className="w-full flex flex-col">
        {/* Main content area */}
        <main className={`flex flex-1 flex-col transition-[padding] duration-300 ${showThumbnails ? "lg:pr-[19rem]" : "lg:pr-0"}`}>
          {/* Image gallery section */}
          <div className="flex flex-1 flex-col">
            {/* Main image and overlay */}
            <div className="flex flex-col w-full">
              <div className="relative">
                <div className="relative w-full min-h-[100svh] h-[100svh] max-h-[100svh] supports-[height:100dvh]:min-h-[100dvh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh] sm:min-h-[520px] flex items-center justify-center rounded-none overflow-hidden border border-white/30 bg-white/10 shadow-2xl backdrop-blur">
                  <Carousel
                    images={images}
                    currentIndex={currentIndex}
                    onChangeImage={handleImageChange}
                    showThumbnails={false}
                    onViewSet={handleViewSet}
                    overlayControls={
                      <div className="flex items-center overflow-hidden rounded-full border border-gray-200/80 bg-white/88 shadow-sm backdrop-blur-md">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="inline-flex h-9 w-10 items-center justify-center text-gray-700 transition-colors duration-200 hover:bg-white hover:text-black"
                          aria-label={locale === 'zh' ? '返回首页' : 'Home'}
                        >
                          <Home className="h-4 w-4" />
                        </button>
                        <span className="h-5 w-px bg-gray-200/90" />
                        <button
                          type="button"
                          onClick={() => setShowThumbnails((prev) => !prev)}
                          className="inline-flex h-9 w-10 items-center justify-center text-gray-700 transition-colors duration-200 hover:bg-white hover:text-black lg:hidden"
                          aria-label={showThumbnails ? 'Hide gallery' : 'Show gallery'}
                        >
                          <Grid className="h-4 w-4" />
                        </button>
                        <span className="h-5 w-px bg-gray-200/90 lg:hidden" />
                        <span className="px-3 py-2 text-[11px] font-semibold tracking-[0.28em] text-gray-600">
                          {currentIndex + 1}/{images.length}
                        </span>
                        <span className="h-5 w-px bg-gray-200/90" />
                        <Drawer>
                          <DrawerTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-9 w-10 items-center justify-center text-gray-700 transition-colors duration-200 hover:bg-white hover:text-black"
                              aria-label={locale === 'zh' ? '查看详情' : 'View details'}
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </DrawerTrigger>
                          <DrawerContent className="border-gray-200 bg-white/95 text-gray-900">
                            <DrawerHeader className="text-left">
                              <DrawerTitle className="text-base font-medium tracking-[0.3em] uppercase text-gray-500">
                                {locale === 'zh' ? '信息' : 'Details'}
                              </DrawerTitle>
                            </DrawerHeader>
                            <div className="px-5 pb-6 space-y-6">
                              <div className="space-y-2">
                                {(displayTitle || displaySubtitle || displayDescription) && (
                                  <>
                                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                                      {locale === 'zh' ? '作品集' : 'Set'}
                                    </p>
                                    {displayTitle && (
                                      <p className="text-lg font-light text-gray-900">{displayTitle}</p>
                                    )}
                                    {displaySubtitle && (
                                      <p className="text-sm text-gray-600">{displaySubtitle}</p>
                                    )}
                                    {displayDescription && (
                                      <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                                        {displayDescription}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              <div className="space-y-2">
                                {(displayImageTitle || displayImageDescription) && (
                                  <>
                                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                                      {locale === 'zh' ? '当前图片' : 'Current Image'}
                                    </p>
                                    {displayImageTitle && (
                                      <p className="text-base font-light text-gray-900">{displayImageTitle}</p>
                                    )}
                                    {displayImageDescription && (
                                      <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                                        {displayImageDescription}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              {locationBadges.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                                    {locale === 'zh' ? '地点' : 'Locations'}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {locationBadges.map((badge) => (
                                      <span
                                        key={badge.key}
                                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm"
                                      >
                                        <span className={`h-2 w-2 rounded-full ${badge.isPrimary ? "bg-emerald-500" : "bg-emerald-300"}`} />
                                        {badge.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </DrawerContent>
                        </Drawer>
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile thumbnails section */}
          <div ref={mobileThumbnailsRef} className="lg:hidden mt-4">
            <div className={`overflow-hidden smooth-transition-slow ${showThumbnails ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pb-4">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageChange(index)}
                    className={`aspect-square overflow-hidden rounded-md border-2 smooth-transition hover:scale-105 gpu-accelerated ${
                      index === currentIndex ? "border-black ring-2 ring-black ring-opacity-20 scale-105" : "border-transparent hover:border-gray-300"
                    }`}
                    style={{ 
                      transitionDelay: showThumbnails ? `${index * 30}ms` : '0ms',
                      animationDelay: showThumbnails ? `${index * 30}ms` : '0ms'
                    }}
                  >
                    <Image
                      src={image.url ? (bucketUrl + image.url) : "/placeholder.svg"}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 25vw, (max-width: 1200px) 16vw, 16vw"
                      className="object-cover w-full h-full smooth-transition hover:scale-110"
                      priority={index < 8} // 预加载前8张图片
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
      <button
        type="button"
        className={`hidden lg:flex fixed inset-y-0 right-0 z-30 w-5 items-center justify-center border-l border-gray-200/60 bg-white/48 backdrop-blur-sm transition-opacity duration-300 ${
          showThumbnails ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        onMouseEnter={() => setShowThumbnails(true)}
        onFocus={() => setShowThumbnails(true)}
        aria-label={locale === 'zh' ? '打开图片缩略图' : 'Open thumbnails'}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/70 bg-white/82 text-gray-500 shadow-sm">
          <Grid className="h-3.5 w-3.5" />
        </div>
      </button>
      <aside
        className={`hidden lg:flex fixed inset-y-4 right-3 z-40 w-[16.5rem] flex-col overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl transition-all duration-300 ${
          showThumbnails ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0"
        }`}
        onMouseEnter={() => setShowThumbnails(true)}
        onMouseLeave={() => setShowThumbnails(false)}
      >
        <ScrollArea className="h-full min-h-0">
          <div className="grid grid-cols-3 gap-1.5 p-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => {
                  handleImageChange(index)
                }}
                className={`group rounded-[0.55rem] border p-1 text-left transition-all duration-200 ${
                  index === currentIndex
                    ? "z-10 scale-[1.08] border-[3px] border-black bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_18px_rgba(0,0,0,0.28),0_14px_30px_rgba(15,23,42,0.16)]"
                    : "border-transparent bg-white/72 text-gray-900 hover:border-gray-200/90 hover:bg-white"
                }`}
              >
                <div className="relative aspect-square overflow-hidden rounded-[0.4rem] bg-gray-100">
                  <Image
                    src={image.url ? bucketUrl + image.url : "/placeholder.svg"}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    sizes="96px"
                    className={`object-cover transition-transform duration-300 ${index === currentIndex ? "scale-[1.03]" : "group-hover:scale-[1.03]"}`}
                    loading="lazy"
                  />
                  <div className={`absolute inset-0 transition-opacity duration-300 ${
                    index === currentIndex ? "opacity-100 bg-black/0" : "opacity-0 group-hover:opacity-100 bg-black/0"
                  }`} />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>
    </div>
  </div>
  )
}
