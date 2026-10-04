"use client"

import * as React from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface LocalizedContent {
  title?: string
  subtitle?: string
  description?: string
}

interface ImageItem {
  url: string
  rawUrl?: string | null
  setId?: number | string | null
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

interface CarouselProps {
  images: ImageItem[]
  currentIndex: number
  onChangeImage: (index: number) => void
  showThumbnails?: boolean
  overlayControls?: React.ReactNode
  onViewSet?: (setId: number | string) => void
}

function preferOriginalVariant(src: string) {
  if (!src.includes("/picture/responsive/")) return src
  const separator = src.includes("?") ? "&" : "?"
  return `${src}${separator}variant=original`
}

export function Carousel({ images, currentIndex, onChangeImage, showThumbnails = true, overlayControls, onViewSet }: CarouselProps) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const primaryLocale = locale === 'zh' ? 'zh' : 'en'
  const secondaryLocale = primaryLocale === 'zh' ? 'en' : 'zh'
  const bucketUrl = React.useMemo(() => process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top', [])
  
  // 触摸和鼠标滑动状态
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)
  const [isSwiping, setIsSwiping] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [mouseStart, setMouseStart] = React.useState<number | null>(null)
  
  // 图片切换动画状态
  const [displayIndex, setDisplayIndex] = React.useState(currentIndex)
  const [fadeIn, setFadeIn] = React.useState(true)
  
  // 最小滑动距离（像素）
  const minSwipeDistance = 50
  
  // 监听 currentIndex 变化，触发过渡动画
  React.useEffect(() => {
    if (currentIndex !== displayIndex) {
      // 淡出
      setFadeIn(false)
      
      // 100ms 后切换图片并淡入
      const timer = setTimeout(() => {
        setDisplayIndex(currentIndex)
        setFadeIn(true)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [currentIndex, displayIndex])
  
  const goToPrevious = () => {
    const isFirstImage = currentIndex === 0
    const newIndex = isFirstImage ? images.length - 1 : currentIndex - 1
    onChangeImage(newIndex)
  }

  const goToNext = () => {
    const isLastImage = currentIndex === images.length - 1
    const newIndex = isLastImage ? 0 : currentIndex + 1
    onChangeImage(newIndex)
  }

  const handleViewSet = () => {
    const setId = images[currentIndex]?.setId
    if (setId == null) return
    if (onViewSet) {
      onViewSet(setId)
      return
    }
    router.push(`/work/${setId}`)
  }
  
  // 触摸开始
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    setIsSwiping(false)
  }
  
  // 触摸移动
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
    if (touchStart !== null) {
      const distance = Math.abs(e.targetTouches[0].clientX - touchStart)
      if (distance > 10) {
        setIsSwiping(true)
        // 阻止浏览器的默认滑动行为（返回/前进）
        e.preventDefault()
      }
    }
  }
  
  // 触摸结束
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe) {
      goToNext()
    } else if (isRightSwipe) {
      goToPrevious()
    }
    
    setIsSwiping(false)
    setTouchStart(null)
    setTouchEnd(null)
  }
  
  // 鼠标拖拽开始（桌面端）
  const onMouseDown = (e: React.MouseEvent) => {
    // 只在主按钮（左键）按下时触发
    if (e.button !== 0) return
    setIsDragging(true)
    setMouseStart(e.clientX)
    e.preventDefault() // 防止文本选择
  }
  
  // 鼠标拖拽移动
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mouseStart === null) return
    
    const distance = mouseStart - e.clientX
    const isLeftDrag = distance > minSwipeDistance
    const isRightDrag = distance < -minSwipeDistance
    
    if (isLeftDrag || isRightDrag) {
      // 完成拖拽后立即重置状态
      setIsDragging(false)
      setMouseStart(null)
      
      if (isLeftDrag) {
        goToNext()
      } else if (isRightDrag) {
        goToPrevious()
      }
    }
  }
  
  // 鼠标拖拽结束
  const onMouseUp = () => {
    setIsDragging(false)
    setMouseStart(null)
  }
  
  // 鼠标离开区域时也要重置状态
  const onMouseLeave = () => {
    setIsDragging(false)
    setMouseStart(null)
  }

  if (!images || images.length === 0) {
    return <div>{t('noPictures') || 'No images'}</div>
  }

  const activeImage = images[displayIndex]
  const activeText = activeImage.translations[primaryLocale]
  const fallbackText = activeImage.translations[secondaryLocale]
  const computedAlt = activeText.title || fallbackText.title || "Portfolio image"

  return (
    <div className="flex flex-col w-full h-full">
      {/* Main image container */}
      <div
        className="flex-1 flex items-center justify-center w-full relative group touch-pan-y select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Image wrapper */}
        <div className="w-full h-full flex items-center justify-center relative select-none">
          <Image
            key={displayIndex}
            src={activeImage.url ? preferOriginalVariant(bucketUrl + activeImage.url) : "/placeholder.svg"}
            alt={computedAlt}
            fill
            className="object-contain corner-lg pointer-events-none transition-opacity duration-200 ease-in-out"
            style={{ opacity: fadeIn ? 1 : 0 }}
            priority
            draggable={false}
          />

          <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-2">
            {overlayControls && (
              <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 transform translate-y-2 md:translate-y-2 md:group-hover:translate-y-0">
                {overlayControls}
              </div>
            )}

            {/* View set button - appears on hover */}
            {activeImage.setId && (
              <Button
                variant="secondary"
                onClick={handleViewSet}
                className="min-w-[140px] justify-center bg-white/80 hover:bg-white shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100 smooth-transition transform translate-y-0 md:translate-y-2 md:group-hover:translate-y-0"
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                {t('viewSet') || 'View Set'}
              </Button>
            )}
          </div>

          {/* Navigation buttons - hidden on mobile, shown on desktop hover */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:block absolute left-12 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white/90 rounded-full p-2 opacity-60 group-hover:opacity-100 transition-all duration-300 transform -translate-x-1 group-hover:translate-x-0 shadow-md"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:block absolute right-12 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white/90 rounded-full p-2 opacity-60 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 group-hover:translate-x-0 shadow-md"
            onClick={goToNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Horizontal thumbnail carousel - only shown if showThumbnails is true */}
      {showThumbnails && (
        <div className="mt-2 overflow-x-auto scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400">
          <div className="flex gap-2 py-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => onChangeImage(index)}
                className={`flex-none w-24 aspect-[16/9] overflow-hidden rounded-md border-2 smooth-transition hover:scale-105 gpu-accelerated snap-center ${
                  index === currentIndex ? "border-black ring-2 ring-black ring-opacity-20 scale-105" : "border-transparent hover:border-gray-300"
                }`}
              >
                <Image
                  src={image.url ? (bucketUrl + image.url) : "/placeholder.svg"}
                  alt={`Thumbnail ${index + 1}`}
                  width={96}
                  height={54}
                  className="object-cover w-full h-full smooth-transition hover:scale-110"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
