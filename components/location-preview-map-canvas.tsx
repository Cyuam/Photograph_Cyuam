// @ts-nocheck
"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface LocationPreviewMapCanvasProps {
  latitude: number
  longitude: number
  locationName?: string
}

export function LocationPreviewMapCanvas({ latitude, longitude, locationName }: LocationPreviewMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(container, {
      center: [latitude, longitude],
      zoom: 10,
      minZoom: 2,
      maxZoom: 18,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      tileSize: 256,
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map)

    const marker = L.circleMarker([latitude, longitude], {
      radius: 12,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.7,
      color: "#22d3ee",
      fillColor: "#f472b6",
    }).addTo(map)

    if (locationName) {
      marker.bindPopup(
        `<div class="text-sm font-medium">${locationName}</div><div class="text-xs text-gray-500">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</div>`,
      )
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, locationName])

  return (
    <div className="mt-2 h-[200px] w-full rounded-lg overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
