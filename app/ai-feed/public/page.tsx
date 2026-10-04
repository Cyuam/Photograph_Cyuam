import type { Metadata } from "next"
import { AiIntelFeed } from "@/components/ai-intel-feed"

export const metadata: Metadata = {
  title: "公开信息流 | Lijie",
  description: "A public preview of Lijie's curated AI and technology information feed.",
}

export const revalidate = 0

export default function PublicAiFeedPage() {
  return <AiIntelFeed publicMode />
}
