import type { Metadata } from "next"
import { AiIntelFeed } from "@/components/ai-intel-feed"

export const metadata: Metadata = {
  title: "信息流 | Lijie",
  description: "A private reading surface for the daily information feed.",
  robots: {
    index: false,
    follow: false,
  },
}

export const revalidate = 0

export default function AiFeedPage() {
  return <AiIntelFeed />
}
