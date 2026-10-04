// @ts-nocheck
"use client"

import { useEffect, useMemo, useState } from "react"

interface LocationPreviewMapProps {
  latitude: number | string
  longitude: number | string
  locationName?: string
}

export function LocationPreviewMap({ latitude, longitude, locationName }: LocationPreviewMapProps) {
  const [mounted, setMounted] = useState(false)
  const [MapCanvas, setMapCanvas] = useState<any>(null)
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let active = true
    import("./location-preview-map-canvas")
      .then((mod) => {
        if (active) setMapCanvas(() => mod.LocationPreviewMapCanvas)
      })
      .catch((error) => {
        console.error("Failed to load location preview map canvas:", error)
      })
    return () => {
      active = false
    }
  }, [mounted])

  // Validate coordinates
  const isValid = useMemo(() => {
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }, [lat, lng])

  if (!isValid) {
    return (
      <div className="mt-2 h-[200px] w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
        输入有效的经纬度以预览位置
      </div>
    )
  }

  if (!mounted || !MapCanvas) {
    return <div className="mt-2 h-[200px] w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
  }

  return <MapCanvas latitude={lat} longitude={lng} locationName={locationName} />
}
