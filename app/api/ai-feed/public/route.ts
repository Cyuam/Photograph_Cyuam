import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"

type FeedLink = {
  label: string
  url: string
}

type FeedDetailSection = {
  title: string
  body?: string
  items?: string[]
}

type FeedBlock = {
  id?: string
  kind: string
  title: string
  source: string
  sourceStatus?: string
  sourceWarning?: string
  summary: string
  why: string
  thought: string
  priority?: number
  links?: FeedLink[]
  details?: FeedDetailSection[]
}

type FeedPayload = {
  date: string
  generatedAt?: string
  overview?: string
  blocks?: FeedBlock[]
}

const feedPath = join(process.cwd(), "data", "ai-intel-feed", "feed-input.json")
const privateHosts = new Set(["mail.google.com"])
const blockedHostParts = ["linkedin.com", "info.deeplearning.ai"]
const publicKinds = new Set(["deep-read", "signal", "theme", "concept", "paper"])

function sanitizeUrl(rawUrl: string) {
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) return ""
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (privateHosts.has(host)) return ""
    if (blockedHostParts.some((part) => host === part || host.endsWith(`.${part}`))) return ""
    if (host === "substack.com" && url.pathname.startsWith("/app-link/")) return ""

    if (host === "news.ycombinator.com" && url.pathname === "/item") {
      const id = url.searchParams.get("id")
      return id ? `https://news.ycombinator.com/item?id=${encodeURIComponent(id)}` : ""
    }

    return `${url.protocol}//${host}${url.pathname.replace(/\/+$/, "") || "/"}`
  } catch {
    return ""
  }
}

function sanitizeLinks(links: FeedLink[] | undefined) {
  const seen = new Set<string>()
  const output: FeedLink[] = []
  for (const link of links || []) {
    const url = sanitizeUrl(link.url)
    if (!url || seen.has(url)) continue
    seen.add(url)
    output.push({ label: String(link.label || "Source").slice(0, 80), url })
  }
  return output
}

function sanitizeBlock(block: FeedBlock): FeedBlock | null {
  if (!publicKinds.has(block.kind)) return null
  const links = sanitizeLinks(block.links)
  if (links.length === 0) return null
  const details = (block.details || [])
    .map((section) => ({
      title: String(section.title || "").slice(0, 80),
      body: section.body ? String(section.body).slice(0, 1200) : undefined,
      items: (section.items || []).map((item) => String(item).slice(0, 500)).slice(0, 8),
    }))
    .filter((section) => section.title && (section.body || section.items?.length))
  return {
    id: block.id,
    kind: block.kind,
    title: block.title,
    source: block.source,
    sourceStatus: block.sourceStatus,
    sourceWarning: block.sourceWarning,
    summary: block.summary,
    why: block.why,
    thought: block.thought,
    priority: block.priority,
    links,
    details,
  }
}

export async function GET() {
  const feed = JSON.parse(await readFile(feedPath, "utf8")) as FeedPayload
  const blocks = (feed.blocks || [])
    .map((block) => sanitizeBlock(block))
    .filter((block): block is FeedBlock => Boolean(block))
    .slice(0, 8)

  return NextResponse.json({
    feed: {
      date: feed.date,
      generatedAt: feed.generatedAt,
      overview: feed.overview,
      sourceStatusLine: "",
      blocks,
    },
  })
}
