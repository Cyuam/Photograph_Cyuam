// components/PortfolioGrid.tsx
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useI18n } from "@/lib/i18n"
import Image from "next/image"
import Link from "next/link"
import { supabase } from "@/utils/supabase"
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

  // 使用固定种子的洗牌函数，确保结果稳定
  const stableShuffleArray = (array: PictureSet[], seed: string): PictureSet[] => {
    const shuffled = [...array]
    // 使用字符串作为种子生成确定性的随机数
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    // Fisher-Yates洗牌算法，使用确定性随机数
    for (let i = shuffled.length - 1; i > 0; i--) {
      hash = (hash * 9301 + 49297) % 233280 // 线性同余生成器
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
        
        // 生成固定的洗牌结果
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
  // 直接使用状态中的洗牌结果，不再进行额外洗牌
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
      <h1 className="text-2xl sm:text-4xl font-light text-center mb-8 sm:mb-16">Lijie&apos;s Galleries</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-pulse">{t('loadingSets')}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-12 flex-1">
          {/* 上部两行自动滚动 - 移动端优化 */}
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
                      className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 smooth-hover gpu-accelerated`}
                    >
                      <Image
                        src={process.env.NEXT_PUBLIC_BUCKET_URL+item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover smooth-transition group-hover:scale-110"
                      />

                      <motion.div
                        className="
                          absolute inset-0
                          bg-black/60
                          opacity-100
                          smooth-transition
                          group-hover:opacity-0
                          flex flex-col items-center justify-center text-white p-4 text-center
                        "
                        initial={{ opacity: 1 }}
                        whileHover={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        <motion.h2 
                          className="text-xl sm:text-2xl font-light mb-2 hidden sm:block"
                          initial={{ y: 0 }}
                          whileHover={{ y: -5 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          {item.title}
                        </motion.h2>
                        <motion.p 
                          className="text-sm opacity-80 hidden sm:block"
                          initial={{ y: 0 }}
                          whileHover={{ y: 5 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          {item.subtitle}
                        </motion.p>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>

              <div ref={bottomRowRef} className="flex overflow-x-auto hide-scrollbar gap-2 sm:gap-3 w-full">
                {[...secondRow, ...secondRow].map((item, i) => {
                  const widthClass =
                    i % 5 === 0 || i % 5 === 4 ? "w-[20%]" : i % 5 === 1 || i % 5 === 3 ? "w-[15%]" : "w-[25%]"

                  return (
                    <Link
                      key={`${item.id}-${i}`}
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className={`group relative aspect-[16/9] flex-none ${widthClass} min-w-[160px] sm:min-w-[200px] overflow-hidden bg-gray-100 smooth-hover gpu-accelerated`}
                    >
                      <Image
                        src={process.env.NEXT_PUBLIC_BUCKET_URL+item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover smooth-transition group-hover:scale-110"
                      />

                      <motion.div
                        className="
                          absolute inset-0
                          bg-black/60
                          opacity-100
                          smooth-transition
                          group-hover:opacity-0
                          flex flex-col items-center justify-center text-white p-4 text-center
                        "
                        initial={{ opacity: 1 }}
                        whileHover={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        <motion.h2 
                          className="text-xl sm:text-2xl font-light mb-2 hidden sm:block"
                          initial={{ y: 0 }}
                          whileHover={{ y: -5 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          {item.title}
                        </motion.h2>
                        <motion.p 
                          className="text-sm opacity-80 hidden sm:block"
                          initial={{ y: 0 }}
                          whileHover={{ y: 5 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          {item.subtitle}
                        </motion.p>
                      </motion.div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* 下部 Masonry - 移动端优化 */}
          {downPictureSets.length > 0 && (
            <div className="mt-6 sm:mt-12 flex justify-center">
              <div className="w-full max-w-7xl columns-2 sm:columns-3 gap-2 sm:gap-4 transform scale-[0.9] sm:scale-[0.833] origin-center">
                {downPictureSets.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: index * 0.1,
                      ease: "easeOut"
                    }}
                    className="mb-2 sm:mb-4 break-inside-avoid"
                  >
                    <Link
                      href={`/work/${item.id}?t=${Date.now()}`}
                      className="group block relative overflow-hidden smooth-hover gpu-accelerated rounded-lg"
                    >
                      <img
                        src={process.env.NEXT_PUBLIC_BUCKET_URL+item.cover_image_url || "/placeholder.svg"}
                        alt={item.title}
                        className="w-full h-auto object-cover smooth-transition group-hover:scale-105"
                      />

                      <motion.div
                        className="
                          absolute inset-0
                          bg-black/60
                          opacity-100
                          smooth-transition
                          group-hover:opacity-0
                          flex flex-col items-center justify-center text-white p-2 sm:p-4 text-center
                        "
                        initial={{ opacity: 1 }}
                        whileHover={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        <motion.h2 
                          className="text-lg sm:text-2xl font-light mb-1 hidden sm:block"
                          initial={{ y: 0 }}
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          {item.title}
                        </motion.h2>
                        <motion.p 
                          className="text-xs sm:text-sm opacity-80 hidden sm:block"
                          initial={{ y: 0 }}
                          whileHover={{ y: 3 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                          {item.subtitle}
                        </motion.p>
                      </motion.div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="mt-auto pt-8 pb-4 text-center space-y-4">
        <p className="text-gray-500">
          Copyright ©{" "}
          <Link href="https://www.instagram.com/cunyli_lijie/" target="_blank" className="text-black hover:underline">
            Lijie Li
          </Link>
        </p>

        <div className="max-w-2xl mx-auto space-y-2 text-sm text-gray-600">
          <p>本站所有照片均受版权保护，未经作者书面许可，禁止以任何形式转载、复制或传播。</p>
          <p>
            All photos on this site are protected by copyright. They may not be reproduced, copied, or distributed in
            any form without the author's written permission.
          </p>
        </div>
      </footer>

      {/* Scroll to top button */}
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ 
              duration: 0.3, 
              ease: "easeOut",
              type: "spring",
              stiffness: 200,
              damping: 20
            }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 bg-black text-white p-3 rounded-full shadow-lg hover:bg-gray-800 smooth-transition gpu-accelerated"
            aria-label="Scroll to top"
          >
            <motion.div
              whileHover={{ y: -1 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowUp className="h-6 w-6" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
