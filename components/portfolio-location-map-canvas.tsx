"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import "leaflet/dist/leaflet.css"
import { useI18n } from "@/lib/i18n"

export interface MapLocationSet {
  id: number
  title: string
  subtitle?: string
  coverUrl: string
}

export interface MapLocationCluster {
  key: string
  name: string
  latitude: number
  longitude: number
  sets: MapLocationSet[]
}

export interface PortfolioLocationMapProps {
  locations: MapLocationCluster[]
  heading: string
  subheading: string
  emptyLabel: string
  viewAllLabel: string
}

export function PortfolioLocationMapCanvas({ locations, heading, subheading, emptyLabel, viewAllLabel }: PortfolioLocationMapProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const leafletMapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const latestActiveKeyRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const { locale } = useI18n()

  const savePortfolioReturnState = useCallback(() => {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem("portfolio:return-scroll", String(window.scrollY ?? 0))

    const horizontalRows = Array.from(document.querySelectorAll<HTMLDivElement>("div.hide-scrollbar.overflow-x-auto"))
    const topRowScroll = horizontalRows[0]?.scrollLeft ?? 0
    const bottomRowScroll = horizontalRows[1]?.scrollLeft ?? 0

    window.sessionStorage.setItem("portfolio:return-top-row-scroll", String(topRowScroll))
    window.sessionStorage.setItem("portfolio:return-bottom-row-scroll", String(bottomRowScroll))
  }, [])

  const buildWorkHref = useCallback((setId: number | string) => {
    const params = new URLSearchParams()
    params.set("origin", "portfolio")
    params.set("returnSet", String(setId))
    return `/work/${setId}?${params.toString()}`
  }, [])

  useEffect(() => {
    if (!locations.length) {
      setActiveKey(null)
      return
    }
    if (!activeKey || !locations.find((loc) => loc.key === activeKey)) {
      setActiveKey(locations[0]?.key ?? null)
    }
  }, [locations, activeKey])
  useEffect(() => {
    latestActiveKeyRef.current = activeKey
  }, [activeKey])

  const activeLocation = useMemo(() => {
    if (!activeKey) return null
    return locations.find((loc) => loc.key === activeKey) ?? null
  }, [activeKey, locations])

  const tileConfig = useMemo(() => {
    if (locale === 'zh') {
      return {
        key: 'zh-tile',
        url: 'https://webrd0{s}.is.autonavi.com/appmaptile?style=7&lang=zh_cn&size=1&scale=1&x={x}&y={y}&z={z}',
        subdomains: ['1', '2', '3', '4'] as string[] | undefined,
        attribution: 'Map data © AutoNavi',
      }
    }
    return {
      key: 'en-tile',
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      subdomains: undefined,
      attribution: 'Map data © Esri & contributors',
    }
  }, [locale])

  const mapKey = useMemo(
    () => `${tileConfig.key}:${locations.map((loc) => loc.key).join("|")}`,
    [locations, tileConfig.key],
  )

  useEffect(() => {
    let cancelled = false
    setMapReady(false)

    const mountMap = async () => {
      const root = mapRootRef.current
      if (!root) return

      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markersLayerRef.current = null
      }

      root.innerHTML = ""

      const leaflet = await import("leaflet")
      if (cancelled || !mapRootRef.current) return

      const map = leaflet.map(root, {
        center: [locations[0].latitude, locations[0].longitude],
        zoom: 4,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        keyboard: false,
      })

      leaflet
        .tileLayer(tileConfig.url, {
          tileSize: 256,
          maxZoom: 18,
          attribution: tileConfig.attribution,
          ...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {}),
        })
        .addTo(map)

      const markersLayer = leaflet.layerGroup().addTo(map)
      leafletMapRef.current = map
      markersLayerRef.current = markersLayer

      const bounds = leaflet.latLngBounds(locations.map((loc) => [loc.latitude, loc.longitude]))
      map.fitBounds(bounds.pad(0.2), { animate: true, duration: 0.8 })
      setMapReady(true)
    }

    void mountMap()

    return () => {
      cancelled = true
      setMapReady(false)
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markersLayerRef.current = null
      }
    }
  }, [mapKey])

  useEffect(() => {
    let cancelled = false
    let markerSyncFrame = 0

    const syncMarkers = async () => {
      if (!mapReady || !leafletMapRef.current || !markersLayerRef.current) return
      const leaflet = await import("leaflet")
      if (cancelled || !leafletMapRef.current || !markersLayerRef.current) return

      const map = leafletMapRef.current
      const bounds = map.getBounds()
      const west = bounds.getWest()
      const east = bounds.getEast()
      const centerLng = map.getCenter().lng
      const span = Math.max(360, Math.abs(east - west))
      const paddedWest = west - span
      const paddedEast = east + span

      markersLayerRef.current.clearLayers()

      for (const loc of locations) {
        const isActive = (latestActiveKeyRef.current ?? activeKey) === loc.key
        const minCopy = Math.floor((paddedWest - loc.longitude) / 360)
        const maxCopy = Math.ceil((paddedEast - loc.longitude) / 360)
        const centerCopy = Math.round((centerLng - loc.longitude) / 360)
        const safeMinCopy = Math.max(minCopy, centerCopy - 4)
        const safeMaxCopy = Math.min(maxCopy, centerCopy + 4)

        for (let copy = safeMinCopy; copy <= safeMaxCopy; copy += 1) {
          leaflet
            .circleMarker([loc.latitude, loc.longitude + copy * 360], {
            radius: isActive ? 14 : 9,
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.65,
            color: isActive ? "#22d3ee" : "#38bdf8",
            fillColor: isActive ? "#f472b6" : "#0ea5e9",
          })
            .on("click", () => setActiveKey(loc.key))
            .on("mouseover", () => setActiveKey(loc.key))
            .addTo(markersLayerRef.current)
        }
      }
    }

    const scheduleMarkerSync = () => {
      if (typeof window === "undefined") return
      if (markerSyncFrame) return
      markerSyncFrame = window.requestAnimationFrame(() => {
        markerSyncFrame = 0
        void syncMarkers()
      })
    }

    void syncMarkers()
    const map = leafletMapRef.current
    map?.on("move", scheduleMarkerSync)
    map?.on("zoomend", scheduleMarkerSync)
    map?.on("resize", scheduleMarkerSync)

    return () => {
      cancelled = true
      if (markerSyncFrame && typeof window !== "undefined") {
        window.cancelAnimationFrame(markerSyncFrame)
      }
      map?.off("move", scheduleMarkerSync)
      map?.off("zoomend", scheduleMarkerSync)
      map?.off("resize", scheduleMarkerSync)
    }
  }, [activeKey, locations, mapReady])

  if (!locations.length) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300/60 bg-white/60 p-6 text-center text-sm text-slate-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-stretch">
        <div className="relative h-[280px] w-full overflow-hidden rounded-[1.25rem] border border-zinc-200/70 shadow-[0_28px_70px_-48px_rgba(24,24,27,0.7)] sm:h-[420px] sm:rounded-[2rem]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,0.18),transparent_55%),radial-gradient(circle_at_80%_15%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(129,140,248,0.16),transparent_65%)]" />
          <div className="absolute inset-0 mix-blend-screen opacity-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(148,163,184,0.1), rgba(148,163,184,0.1) 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, rgba(148,163,184,0.08), rgba(148,163,184,0.08) 1px, transparent 1px, transparent 64px)" }} />
          <div ref={mapRootRef} className="h-full w-full [&_.leaflet-control-container]:hidden" />
          {!mapReady && <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/40" />}
      </div>

        <div className="min-h-0 sm:min-h-[22rem] lg:min-h-0">
          {activeLocation ? (
            <div className="flex h-full flex-col">
              <div className="px-1 pb-3 sm:px-0">
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-zinc-400">
                  {locale === "zh" ? "当前位置" : "Current Point"}
                </p>
                <h3 className="mt-1 text-base font-medium text-zinc-900 line-clamp-1">
                  {activeLocation.name}
                </h3>
              </div>
              <div
                className={`grid max-h-[16rem] flex-1 gap-2.5 overflow-y-auto pr-1 sm:max-h-[24rem] sm:gap-3 ${activeLocation.sets.length === 1 ? "" : "sm:grid-cols-2 lg:grid-cols-1"}`}
              >
                {activeLocation.sets.map((set) => (
                  <Link
                    key={set.id}
                    href={buildWorkHref(set.id)}
                    onClick={savePortfolioReturnState}
                    className="group grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-3 rounded-[1.1rem] bg-white/65 p-1.5 shadow-[0_16px_42px_-34px_rgba(24,24,27,0.8)] transition-transform duration-300 hover:-translate-y-0.5 sm:block sm:bg-transparent sm:p-0 sm:shadow-none"
                  >
                    <div className={`relative aspect-square overflow-hidden rounded-[0.9rem] bg-zinc-100 sm:rounded-[1.1rem] sm:shadow-[0_20px_60px_-42px_rgba(24,24,27,0.85)] ${activeLocation.sets.length === 1 ? "sm:aspect-[16/10]" : "sm:aspect-[4/3]"}`}>
                      <Image
                        src={set.coverUrl}
                        alt={set.title}
                        fill
                        sizes="(max-width: 640px) 96px, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        priority={false}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </div>
                    <div className="min-w-0 pr-1 sm:px-1 sm:pt-2.5">
                      <h4 className="text-sm font-medium text-zinc-900 line-clamp-2 sm:text-base sm:line-clamp-1">
                        {set.title}
                      </h4>
                      {set.subtitle && (
                        <p className="mt-1 text-xs leading-snug text-zinc-500 line-clamp-2 sm:mt-0.5 sm:text-sm">
                          {set.subtitle}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.1rem] border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
              {emptyLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
