"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, PointerEvent } from "react"
import { CalendarDays, Camera } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type Locale = "en" | "zh"
type LocalizedString = Record<Locale, string>

const gateCopy = {
  badge: { en: "Start Here", zh: "从这里开始" },
  title: { en: "What are you here for?", zh: "你想先看哪一部分？" },
  subtitle: {
    en: "Choose a path and jump directly to the content you need.",
    zh: "选择入口，直接进入你需要的内容。",
  },
  vintage: {
    en: "A VINTAGE PROLOGUE TO A NEW CRAFT.",
    zh: "复古序章，通往新的技艺。",
  },
  hint: {
    en: "TWO PORTALS. TWO FUTURES.",
    zh: "两条路径，两种未来。",
  },
  bookingTitle: { en: "Book a Helsinki shoot", zh: "预约赫尔辛基拍摄" },
  bookingBody: {
    en: "Portraits, travel walks, and city light.",
    zh: "人像、旅拍、城市漫步。",
  },
  hrTitle: { en: "Got a job?", zh: "有坑位吗" },
  hrBody: {
    en: "Quick resume.",
    zh: "CV来喽",
  },
  portfolioTitle: { en: "Wanna see pics?", zh: "想看作品吗" },
  portfolioBody: {
    en: "The good stuff is here.",
    zh: "好看的都在这",
  },
  matrixRedBody: {
    en: "CV",
    zh: "简历",
  },
  matrixBlueBody: {
    en: "Works",
    zh: "作品集",
  },
}

export function EntryGate() {
  const { locale, setLocale } = useI18n()
  const gateLocale: Locale = locale === "zh" ? "zh" : "en"
  const router = useRouter()
  const [isEntering, setIsEntering] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileIntroVisible, setIsMobileIntroVisible] = useState(true)
  const sceneRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef({
    tiltX: 0,
    tiltY: 0,
    parallaxX: 0,
    parallaxY: 0,
    focusScale: 1,
    focusOpacity: 0.35,
    focusBlur: 18,
    focusDepth: 12,
  })
  const currentRef = useRef({ ...targetRef.current })

  const animateScene = () => {
    const node = sceneRef.current
    if (!node) {
      rafRef.current = null
      return
    }
    const current = currentRef.current
    const target = targetRef.current
    const ease = 0.08
    const lerp = (from: number, to: number) => from + (to - from) * ease

    current.tiltX = lerp(current.tiltX, target.tiltX)
    current.tiltY = lerp(current.tiltY, target.tiltY)
    current.parallaxX = lerp(current.parallaxX, target.parallaxX)
    current.parallaxY = lerp(current.parallaxY, target.parallaxY)
    current.focusScale = lerp(current.focusScale, target.focusScale)
    current.focusOpacity = lerp(current.focusOpacity, target.focusOpacity)
    current.focusBlur = lerp(current.focusBlur, target.focusBlur)
    current.focusDepth = lerp(current.focusDepth, target.focusDepth)

    node.style.setProperty("--tilt-x", `${current.tiltX.toFixed(2)}deg`)
    node.style.setProperty("--tilt-y", `${current.tiltY.toFixed(2)}deg`)
    node.style.setProperty("--parallax-x", `${current.parallaxX.toFixed(2)}px`)
    node.style.setProperty("--parallax-y", `${current.parallaxY.toFixed(2)}px`)
    node.style.setProperty("--focus-scale", `${current.focusScale.toFixed(3)}`)
    node.style.setProperty("--focus-opacity", `${current.focusOpacity.toFixed(3)}`)
    node.style.setProperty("--focus-blur", `${current.focusBlur.toFixed(2)}px`)
    node.style.setProperty("--focus-depth", `${current.focusDepth.toFixed(2)}px`)

    const shouldContinue =
      Math.abs(current.tiltX - target.tiltX) > 0.01 ||
      Math.abs(current.tiltY - target.tiltY) > 0.01 ||
      Math.abs(current.parallaxX - target.parallaxX) > 0.1 ||
      Math.abs(current.parallaxY - target.parallaxY) > 0.1 ||
      Math.abs(current.focusScale - target.focusScale) > 0.001

    rafRef.current = shouldContinue ? requestAnimationFrame(animateScene) : null
  }

  const scheduleAnimation = () => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(animateScene)
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = sceneRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    targetRef.current.tiltX = (0.5 - y) * 10
    targetRef.current.tiltY = (x - 0.5) * 12
    targetRef.current.parallaxX = (x - 0.5) * 28
    targetRef.current.parallaxY = (y - 0.5) * 28

    const focusX = 0.64
    const focusY = 0.36
    const dx = x - focusX
    const dy = y - focusY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const intensity = Math.max(0, 1 - distance * 2.2)
    targetRef.current.focusScale = 1 + intensity * 0.18
    targetRef.current.focusOpacity = 0.35 + intensity * 0.35
    targetRef.current.focusBlur = 18 - intensity * 6
    targetRef.current.focusDepth = 12 + intensity * 10

    scheduleAnimation()
  }

  const handlePointerLeave = () => {
    targetRef.current.tiltX = 0
    targetRef.current.tiltY = 0
    targetRef.current.parallaxX = 0
    targetRef.current.parallaxY = 0
    targetRef.current.focusScale = 1
    targetRef.current.focusOpacity = 0.35
    targetRef.current.focusBlur = 18
    targetRef.current.focusDepth = 12
    scheduleAnimation()
  }

  const handleToggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh")
  }

  const handleMobileNavigate = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (isExiting) return
    setIsExiting(true)
    window.setTimeout(() => {
      window.location.href = href
    }, 520)
  }

  const handleNavigate = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (isExiting) return
    setIsExiting(true)
    window.setTimeout(() => {
      router.push(href)
    }, 420)
  }

  useEffect(() => {
    const resetExitState = () => {
      setIsExiting(false)
      setIsEntering(true)
      setIsMobileIntroVisible(false)
      window.setTimeout(() => setIsEntering(false), 80)
    }

    resetExitState()
    window.addEventListener("pageshow", resetExitState)
    window.addEventListener("popstate", resetExitState)

    return () => {
      window.removeEventListener("pageshow", resetExitState)
      window.removeEventListener("popstate", resetExitState)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const handleChange = () => setIsMobile(mediaQuery.matches)
    handleChange()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    const originalOverflow = document.body.style.overflow
    const originalOverscroll = document.documentElement.style.overscrollBehavior
    document.body.style.overflow = "hidden"
    document.documentElement.style.overscrollBehavior = "none"
    return () => {
      document.body.style.overflow = originalOverflow
      document.documentElement.style.overscrollBehavior = originalOverscroll
    }
  }, [isMobile])

  useEffect(() => {
    const id = window.setTimeout(() => setIsMobileIntroVisible(false), 120)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <main
      ref={sceneRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative min-h-[100svh] overflow-hidden bg-[#030403] text-zinc-900 font-['Manrope'] transition-all duration-500 ${isExiting && !isMobile ? "scale-[0.98] opacity-0" : "opacity-100"} ${isMobile ? "entry-animate" : ""}`}
      style={
        {
          perspective: "1200px",
          "--focus-scale": "1",
          "--focus-opacity": "0.35",
          "--focus-blur": "18px",
          "--focus-depth": "12px",
          "--parallax-x": "0px",
          "--parallax-y": "0px",
        } as CSSProperties
      }
    >
      <div
        className={`pointer-events-none fixed inset-0 z-[10000] bg-white transition-opacity duration-500 ease-out ${
          isEntering || isExiting ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat will-change-transform"
          style={{
            backgroundImage: "url('/hand_with_hand.png')",
            backgroundPosition: "37% center",
            backgroundSize: "cover",
            transform: "translate3d(calc(var(--parallax-x, 0px) * 0.2), calc(var(--parallax-y, 0px) * 0.2), 0)",
            transformOrigin: "center",
          }}
        />
      </div>

      <section className="entry-mobile relative isolate flex min-h-[100svh] overflow-hidden bg-white text-white md:hidden">
        <div className="mobile-pill-preload pointer-events-none absolute inset-0" />
        <img
          src="/matrix-pill-bg.png"
          alt=""
          aria-hidden="true"
          className="mobile-pill-photo pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="mobile-pill-vignette pointer-events-none absolute inset-0" />
        <div className={`mobile-pill-intro pointer-events-none absolute inset-0 z-10 bg-white ${isMobileIntroVisible ? "opacity-100" : "opacity-0"}`} />
        <div className={`mobile-pill-exit pointer-events-none fixed inset-0 z-30 bg-white transition-opacity duration-500 ${isExiting ? "opacity-100" : "opacity-0"}`} />
        <a
          href="/helsinki-photo-session"
          onClick={handleMobileNavigate("/helsinki-photo-session")}
          className="absolute left-4 top-4 z-20 inline-flex h-10 items-center gap-2 rounded-md border border-white/30 bg-black/32 px-3 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.98]"
          aria-label={gateCopy.bookingTitle[gateLocale]}
        >
          <Camera className="h-4 w-4" />
          {gateLocale === "zh" ? "约拍" : "Book"}
        </a>

        <nav className="mobile-pill-nav" aria-label={gateLocale === "zh" ? "药丸入口" : "Pill entries"}>
          <a
            href="/portfolio"
            className="mobile-pill-hotspot mobile-pill-hotspot-left"
            onClick={handleMobileNavigate("/portfolio")}
            aria-label={gateCopy.matrixBlueBody[gateLocale]}
            title={gateCopy.matrixBlueBody[gateLocale]}
          >
            <span className="sr-only">{gateCopy.matrixBlueBody[gateLocale]}</span>
          </a>

          <a
            href="/resume"
            className="mobile-pill-hotspot mobile-pill-hotspot-right"
            onClick={handleMobileNavigate("/resume")}
            aria-label={gateCopy.matrixRedBody[gateLocale]}
            title={gateCopy.matrixRedBody[gateLocale]}
          >
            <span className="sr-only">{gateCopy.matrixRedBody[gateLocale]}</span>
          </a>
        </nav>
      </section>

      <section className="entry-section relative mx-auto hidden min-h-[100svh] max-w-6xl items-center justify-center px-6 py-16 sm:px-10 sm:py-24 md:flex">
        <div className="relative w-full">
          <button
            type="button"
            onClick={handleToggleLocale}
            className="entry-chip absolute right-[8%] top-[18%] z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/80 text-zinc-700 shadow-[0_14px_32px_-24px_rgba(58,44,35,0.6)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-26px_rgba(58,44,35,0.7)]"
            style={{
              transform:
                "translate3d(var(--parallax-x, 0px), var(--parallax-y, 0px), 50px)",
            }}
            aria-label={gateLocale === "zh" ? "切换语言" : "Change language"}
            title={gateLocale === "zh" ? "切换语言" : "Change language"}
          >
            <span aria-hidden="true" className="text-[15px] leading-none">
              🌍
            </span>
          </button>
          <div className="pointer-events-none absolute left-[62%] top-[34%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 opacity-[var(--focus-opacity,0.35)] motion-safe:animate-orb-pulse"
            style={{
              transform:
                "translate3d(-50%, -50%, var(--focus-depth, 12px)) scale(var(--focus-scale, 1))",
              filter: "blur(var(--focus-blur, 18px))",
            }}
          >
            <div className="h-full w-full rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9),_rgba(255,255,255,0.25)_55%,_transparent_70%)]" />
          </div>

          <Link
            href="/helsinki-photo-session"
            className="entry-booking-link absolute bottom-[9%] left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-3 rounded-md border border-white/70 bg-white/84 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_18px_50px_-34px_rgba(58,44,35,0.75)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            style={{
              transform:
                "translate3d(calc(-50% + var(--parallax-x, 0px) * 0.35), calc(var(--parallax-y, 0px) * 0.35), 64px)",
            }}
            onClick={handleNavigate("/helsinki-photo-session")}
          >
            <CalendarDays className="h-4 w-4" />
            <span>
              <span className="block">{gateCopy.bookingTitle[gateLocale]}</span>
              <span className="mt-0.5 block text-xs font-medium text-zinc-600">{gateCopy.bookingBody[gateLocale]}</span>
            </span>
          </Link>

          <div
            className="grid gap-10 text-left md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
            style={{
              transform:
                "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              transformStyle: "preserve-3d",
              transition: "transform 300ms ease",
            }}
          >
            <div
              className="grid gap-6"
              style={{
                transform:
                  "translate3d(calc(var(--parallax-x, 0px) * 0.4), calc(var(--parallax-y, 0px) * 0.4), 42px)",
              }}
            >
              <Link
                href="/portfolio"
                className="entry-card entry-card-left group relative -translate-y-28 overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/75 p-7 text-left shadow-[0_28px_70px_-50px_rgba(58,44,35,0.55)] backdrop-blur transition duration-500 hover:-translate-y-24 hover:shadow-[0_40px_90px_-60px_rgba(58,44,35,0.65)]"
                onClick={handleNavigate("/portfolio")}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_transparent_70%)] opacity-0 transition duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex h-full flex-col gap-4 text-center">
                  <div className="flex items-center justify-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-600">
                      {gateCopy.portfolioTitle[gateLocale]}
                    </p>
                  </div>
                  <p className="mt-2 text-lg font-medium text-zinc-900 sm:text-xl">
                    {gateCopy.portfolioBody[gateLocale]}
                  </p>
                </div>
              </Link>
            </div>

            <div
              className="grid gap-6 md:mt-8"
              style={{
                transform:
                  "translate3d(calc(var(--parallax-x, 0px) * 0.7), calc(var(--parallax-y, 0px) * 0.7), 70px)",
              }}
            >
              <Link
                href="/resume"
                className="entry-card entry-card-right group relative translate-y-28 overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/75 p-7 text-left shadow-[0_28px_70px_-50px_rgba(58,44,35,0.55)] backdrop-blur transition duration-500 hover:translate-y-24 hover:shadow-[0_40px_90px_-60px_rgba(58,44,35,0.65)]"
                onClick={handleNavigate("/resume")}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_transparent_70%)] opacity-0 transition duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex h-full flex-col gap-4 text-center">
                  <div className="flex items-center justify-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-600">
                      {gateCopy.hrTitle[gateLocale]}
                    </p>
                  </div>
                  <p className="text-lg font-medium text-zinc-900 sm:text-xl">
                    {gateCopy.hrBody[gateLocale]}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <style jsx>{`
        .mobile-pill-preload {
          background:
            radial-gradient(circle at 50% 68%, rgba(76, 80, 58, 0.26), transparent 30%),
            linear-gradient(180deg, #030403 0%, #070806 58%, #000 100%);
        }

        .mobile-pill-photo {
          filter: contrast(1.02) saturate(0.94);
        }

        .mobile-pill-vignette {
          background:
            radial-gradient(circle at center, transparent 52%, rgba(0, 0, 0, 0.26)),
            linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.22));
        }

        .mobile-pill-intro {
          transition: opacity 1100ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .mobile-pill-nav {
          position: fixed;
          inset: 0;
          z-index: 20;
        }

        .mobile-pill-hotspot {
          position: absolute;
          display: block;
          bottom: 10%;
          height: 38%;
          width: 50%;
          background: transparent;
          border: 0;
          cursor: pointer;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .mobile-pill-hotspot-left {
          left: 0;
        }

        .mobile-pill-hotspot-right {
          right: 0;
        }

        .mobile-pill-hotspot:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.78);
          outline-offset: 5px;
        }

        .mobile-pill-hotspot:active {
          background: transparent;
        }

        .entry-animate .entry-section {
          animation: entry-fade 520ms ease-out both;
        }

        .entry-animate .entry-chip {
          animation: entry-rise 520ms ease-out 120ms both;
        }

        .entry-animate .entry-card {
          animation: entry-rise 620ms ease-out both;
        }

        .entry-animate .entry-booking-link {
          animation: entry-rise 620ms ease-out 320ms both;
        }

        .entry-animate .entry-card-left {
          animation-delay: 160ms;
        }

        .entry-animate .entry-card-right {
          animation-delay: 260ms;
        }

        @keyframes entry-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes entry-rise {
          from {
            opacity: 0;
            filter: blur(6px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .entry-animate .entry-section,
          .entry-animate .entry-chip,
          .entry-animate .entry-booking-link,
          .entry-animate .entry-card {
            animation: none;
          }
        }
      `}</style>
    </main>
  )
}
