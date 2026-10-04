"use client"

import dynamic from "next/dynamic"
import type { PortfolioLocationMapProps } from "./portfolio-location-map-canvas"

type CanvasModule = typeof import("./portfolio-location-map-canvas")

const DynamicMap = dynamic<PortfolioLocationMapProps>(
  () => import("./portfolio-location-map-canvas").then((mod: CanvasModule) => mod.PortfolioLocationMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="mt-10 h-[420px] w-full animate-pulse rounded-3xl border border-slate-200/60 bg-slate-100/60" />
    ),
  },
)

export type { MapLocationCluster, MapLocationSet, PortfolioLocationMapProps } from "./portfolio-location-map-canvas"

export function PortfolioLocationMap(props: PortfolioLocationMapProps) {
  return <DynamicMap {...props} />
}
