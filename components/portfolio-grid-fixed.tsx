// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { supabase } from "@/utils/supabase"
import { useI18n } from "@/lib/i18n"
import { ArrowUp } from "lucide-react"
import type { PictureSet } from "@/lib/pictureSet.types"

export function PortfolioGrid() {
  const { t } = useI18n()
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [loading, setLoading] = useState(true)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [shuffledDownSets, setShuffledDownSets] = useState<PictureSet[]>([])
  const topRowRef = useRef<HTMLDivElement>(null)
  const bottomRowRef = useRef<HTMLDivElement>(null)

  // Stable shuffle with a fixed seed for reproducible order
  const stableShuffleArray = (array: PictureSet[], seed: string): PictureSet[] => {
    const shuffled = [...array]
    // Use string as seed to produce deterministic pseudo-random numbers
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // cast to 32-bit int
    }
    
    // Fisher-Yates shuffle with deterministic RNG
    for (let i = shuffled.length - 1; i > 0; i--) {
      hash = (hash * 9301 + 49297) % 233280 // LCG
      const j = hash % (i + 1)
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    return shuffled
  }

  const fetchPictureSets = async () => {
    setLoading(true)
    try {
      console.log("Fetching picture sets for portfolio grid")
      const { data, error } = await supabase.from("picture_sets").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching picture sets:", error)
        setPictureSets([])
        setShuffledDownSets([])
      } else {
        console.log(`Found ${data?.length || 0} picture sets`)
        setPictureSets(data || [])
        
        // Build shuffled bottom row
        const downSets = (data || []).filter((s) => s.position?.trim().toLowerCase() === "down")
        const seed = downSets.map(s => s.id).join('-') // 使用ID组合作为种子
        const shuffled = stableShuffleArray(downSets, seed)
        setShuffledDownSets(shuffled)
      }
    } catch (error) {
      console.error("Error in fetchPictureSets:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPictureSets()
  }, [])

  // Monitor scroll position to show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const upPictureSets = pictureSets.filter((s) => s.position?.trim().toLowerCase() === "up")
  // Use precomputed shuffled result for bottom row
  const downPictureSets = shuffledDownSets

  const mid = Math.ceil(upPictureSets.length / 2)
  const firstRow = upPictureSets.slice(0, mid)
  const secondRow = upPictureSets.slice(mid)

  useEffect(() => {
    const top = topRowRef.current!
    const bottom = bottomRowRef.current!
    if (!upPictureSets.length) return

    const tick = () => {
      if (!top.matches(":hover")) {
        top.scrollLeft >= top.scrollWidth - top.clientWidth - 5
          ? top.scrollTo({ left: 0, behavior: "auto" })
          : top.scrollBy({ left: 1, behavior: "auto" })
      }
      if (!bottom.matches(":hover")) {
        bottom.scrollLeft <= 5
          ? bottom.scrollTo({ left: bottom.scrollWidth - bottom.clientWidth, behavior: "auto" })
          : bottom.scrollBy({ left: -1, behavior: "auto" })
      }
    }

    const id = setInterval(tick, 30)
    return () => clearInterval(id)
  }, [upPictureSets])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="w-full mx-auto px-2 sm:px-4 py-8 sm:py-16 flex flex-col min-h-screen">
      <h1 className="text-2xl sm:text-4xl font-light text-center mb-8 sm:mb-16">{t('galleriesTitle')}</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse">{t('loadingSets')}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-12 flex-1">
          {/* Top two rows auto-scroll (mobile-friendly) */}
          {firstRow.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <div ref={topRowRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full">
                {[...firstRow, ...firstRow].map((item, i) => {
                  const widthClass =
                    i % 5 === 0 || i % 5 === 4 ? "w-[15%]" : i % 5 === 1 || i % 5 === 3 ? "w-[25%]" : "w-[20%]"

                  return (
                    <Link
                      key={`${item.id}-${i}`}
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                    >
                      <Image
                        src={process.env.NEXT_PUBLIC_BUCKET_URL+item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                      />

                      <div
                        className="
                          absolute inset-0
                          bg-black/60
                          opacity-100
                          transition-opacity duration-300 ease-out
                          group-hover:opacity-0
                          flex flex-col items-center justify-center text-white p-4 text-center
                        "
                      >
                        <h2 
                          className="text-xl sm:text-2xl font-light mb-2 hidden sm:block transition-transform duration-300 ease-out group-hover:-translate-y-1"
                        >
                          {item.title}
                        </h2>
                        <p 
                          className="text-sm opacity-80 hidden sm:block transition-transform duration-300 ease-out group-hover:translate-y-1"
                        >
                          {item.subtitle}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Second row */}
              {secondRow.length > 0 && (
                <div ref={bottomRowRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full">
                  {[...secondRow, ...secondRow].map((item, i) => {
                    const widthClass =
                      i % 5 === 0 || i % 5 === 4 ? "w-[15%]" : i % 5 === 1 || i % 5 === 3 ? "w-[25%]" : "w-[20%]"

                    return (
                      <Link
                        key={`${item.id}-${i}`}
                        href={`/work/${item.id}?t=${Date.now()}`}
                        className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 gpu-accelerated rounded-md transition-transform duration-300 ease-out hover:scale-[1.02]`}
                      >
                        <Image
                          src={process.env.NEXT_PUBLIC_BUCKET_URL+item.cover_image_url || "/placeholder.svg"}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                        />

                        <div
                          className="
                            absolute inset-0
                            bg-black/60
                            opacity-100
                            transition-opacity duration-300 ease-out
                            group-hover:opacity-0
                            flex flex-col items-center justify-center text-white p-4 text-center
                          "
                        >
                          <h2 
                            className="text-xl sm:text-2xl font-light mb-2 hidden sm:block transition-transform duration-300 ease-out group-hover:-translate-y-1"
                          >
                            {item.title}
                          </h2>
                          <p 
                            className="text-sm opacity-80 hidden sm:block transition-transform duration-300 ease-out group-hover:translate-y-1"
                          >
                            {item.subtitle}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bottom Masonry layout */}
          {downPictureSets.length > 0 && (
            <div className="flex justify-center">
              <div className="w-full max-w-7xl columns-2 sm:columns-3 gap-2 sm:gap-4 transform scale-[0.9] sm:scale-[0.833] origin-center">
                {downPictureSets.map((item, index) => (
                  <div
                    key={item.id}
                    className="break-inside-avoid mb-2 sm:mb-4 transition-opacity duration-500 ease-out"
                    style={{ 
                      opacity: 1,
                      animationDelay: `${index * 100}ms`
                    }}
                  >
                    <Link
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className="group block relative overflow-hidden gpu-accelerated rounded-lg transition-transform duration-300 ease-out hover:scale-[1.02]"
                    >
                      <Image
                        src={process.env.NEXT_PUBLIC_BUCKET_URL+item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        width={600}
                        height={800}
                        className="w-full h-auto object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      />
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 ease-out flex items-center justify-center">
                        <div className="text-white text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out p-4">
                          <h3 className="text-lg font-medium mb-1">{item.title}</h3>
                          <p className="text-sm opacity-80">{item.subtitle}</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scroll to top button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-black text-white p-3 rounded-full transition-all duration-300 ease-out hover:bg-gray-800 hover:scale-110 shadow-lg"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
