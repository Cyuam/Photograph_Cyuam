import { createHash } from "node:crypto"

export type FeedKind = "deep-read" | "signal" | "theme" | "concept" | "paper" | "action"

export type FeedLink = {
  label: string
  url: string
}

export type FeedDetailSection = {
  title: string
  body?: string
  items?: string[]
}

export type FeedBlock = {
  id?: string
  fingerprints?: string[]
  kind: FeedKind
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

export type FeedPayload = {
  date?: string
  generatedAt?: string
  overview?: string
  sourceStatusLine?: string
  blocks?: FeedBlock[]
  [key: string]: unknown
}

export type PrivateImportPayload = {
  version: 1
  updatedAt?: string
  blocks: FeedBlock[]
}

export type MergeResult = {
  blocks: FeedBlock[]
  block: FeedBlock
  inserted: boolean
  replaced: boolean
}

const linkedinHosts = new Set(["linkedin.com", "www.linkedin.com", "se.linkedin.com"])
const safeJobSearchParams = new Set(["keywords", "location", "geoid", "distance", "f_tpr", "f_wt", "sortby"])
const trackingNames = new Set(["eid", "lipi", "midsig", "midtoken", "otptoken", "refid", "trackingid", "trk", "trkemail"])
const trackingPrefixes = ["utm_", "hs_", "mc_", "fbclid", "gclid"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compactText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function stableDigest(...parts: string[]) {
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12)
}

function shouldDropQueryParam(name: string) {
  const normalized = name.toLowerCase()
  return trackingNames.has(normalized) || trackingPrefixes.some((prefix) => normalized.startsWith(prefix))
}

function cleanSearchParams(params: URLSearchParams, keepNames?: Set<string>) {
  const next = new URLSearchParams()
  for (const [key, value] of params.entries()) {
    const normalized = key.toLowerCase()
    if (shouldDropQueryParam(normalized)) continue
    if (keepNames && !keepNames.has(normalized)) continue
    next.append(key, value)
  }
  return next.toString()
}

function withDefaultScheme(rawUrl: string) {
  if (rawUrl.startsWith("//")) return `https:${rawUrl}`
  if (!rawUrl.includes("://") && /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/|$)/.test(rawUrl)) return `https://${rawUrl}`
  return rawUrl
}

function parseHttpUrl(rawUrl: unknown, label: string) {
  const value = withDefaultScheme(compactText(rawUrl))
  if (!value) throw new Error(`${label} is required.`)

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be an http(s) URL with a host.`)
  }

  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error(`${label} must be an http(s) URL with a host.`)
  }
  return url
}

function cleanPublicUrl(rawUrl: unknown) {
  const value = compactText(rawUrl)
  if (!value) return ""

  let url: URL
  try {
    url = parseHttpUrl(value, "Extra link URL")
  } catch {
    return ""
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname.replace(/\/+$/, "") || "/"
  const query = cleanSearchParams(url.searchParams)
  return `${url.protocol}//${host}${path}${query ? `?${query}` : ""}`
}

export function canonicalLinkedInUrl(rawUrl: unknown) {
  const url = parseHttpUrl(rawUrl, "LinkedIn URL")
  const host = url.hostname.toLowerCase()
  if (!linkedinHosts.has(host)) throw new Error("Primary URL must be a LinkedIn URL.")

  const path = url.pathname.replace(/\/+$/, "") || "/"
  const jobMatch = path.match(/\/(?:comm\/)?jobs\/view\/(\d+)/)
  if (jobMatch) return `https://www.linkedin.com/jobs/view/${jobMatch[1]}`

  if (/^\/(?:comm\/)?jobs\/search$/.test(path)) {
    const query = cleanSearchParams(url.searchParams, safeJobSearchParams)
    return `https://www.linkedin.com/jobs/search${query ? `?${query}` : ""}`
  }

  const activityMatch = path.match(/\/(?:comm\/)?feed\/update\/activity:([0-9]+)/)
  if (activityMatch) return `https://www.linkedin.com/feed/update/activity:${activityMatch[1]}`

  const postsMatch = path.match(/\/posts\/([^/?#]+)/)
  if (postsMatch) return `https://www.linkedin.com/posts/${postsMatch[1]}`

  const query = cleanSearchParams(url.searchParams)
  return `https://www.linkedin.com${path}${query ? `?${query}` : ""}`
}

function requireText(item: Record<string, unknown>, key: string) {
  const value = compactText(item[key])
  if (!value) throw new Error(`Missing required field: ${key}`)
  return value
}

function optionalText(item: Record<string, unknown>, key: string, fallback = "") {
  return compactText(item[key]) || fallback
}

function normalizedPriority(value: unknown, fallback: number) {
  const priority = Number(value)
  if (!Number.isFinite(priority)) return fallback
  return Math.max(0, Math.min(100, Math.round(priority)))
}

function sourceLabel(item: Record<string, unknown>, fallback: string, dateValue: string) {
  const source = optionalText(item, "source", fallback)
  if (dateValue && !source.includes("·")) return `${source} · ${dateValue}`
  return source
}

function extraLinks(item: Record<string, unknown>) {
  const rawLinks = Array.isArray(item.links) ? item.links : []
  const links: FeedLink[] = []
  for (const rawLink of rawLinks) {
    if (!isRecord(rawLink)) continue
    const url = cleanPublicUrl(rawLink.url)
    if (!url) continue
    links.push({
      label: compactText(rawLink.label) || "Source",
      url,
    })
  }
  return links
}

function buildJobBlock(item: Record<string, unknown>, dateValue: string): FeedBlock {
  const company = requireText(item, "company")
  const role = requireText(item, "role")
  const primaryUrl = canonicalLinkedInUrl(requireText(item, "url"))
  const location = optionalText(item, "location", "location not specified")
  const title = optionalText(item, "title", `职位筛选：${company} / ${role}`)
  const summary = optionalText(item, "summary", `${company} 的 ${role}，地点/形式：${location}。`)
  const why = requireText(item, "why")
  const thought = optionalText(item, "thought", "先看 JD 是否真的涉及模型、音频/语音、LLM infra 或 research engineering；不匹配就直接丢弃。")
  const blockId = optionalText(item, "id", `linkedin-job-${stableDigest(primaryUrl, company, role)}`)

  return {
    id: blockId,
    fingerprints: [`url:${primaryUrl}`],
    kind: "action",
    title,
    source: sourceLabel(item, "LinkedIn Jobs", dateValue),
    sourceStatus: "account_source",
    summary,
    why,
    thought,
    priority: normalizedPriority(item.priority, 64),
    links: [{ label: "LinkedIn job", url: primaryUrl }, ...extraLinks(item)],
  }
}

function buildPostBlock(item: Record<string, unknown>, dateValue: string): FeedBlock {
  const author = requireText(item, "author")
  const topic = requireText(item, "topic")
  const primaryUrl = canonicalLinkedInUrl(requireText(item, "url"))
  const title = optionalText(item, "title", `LinkedIn post：${topic}`)
  const summary = requireText(item, "summary")
  const why = requireText(item, "why")
  const thought = optionalText(item, "thought", "打开原帖和外链，只保留能转成技术判断或行动的问题。")
  const blockId = optionalText(item, "id", `linkedin-post-${stableDigest(primaryUrl, author, topic)}`)

  return {
    id: blockId,
    fingerprints: [`url:${primaryUrl}`],
    kind: "signal",
    title,
    source: sourceLabel(item, `LinkedIn Post / ${author}`, dateValue),
    sourceStatus: "account_source",
    summary,
    why,
    thought,
    priority: normalizedPriority(item.priority, 58),
    links: [{ label: "LinkedIn post", url: primaryUrl }, ...extraLinks(item)],
  }
}

export function buildLinkedInImportBlock(input: unknown, fallbackDate = new Date().toISOString().slice(0, 10)) {
  if (!isRecord(input)) throw new Error("Import item must be an object.")

  const dateValue = optionalText(input, "date", fallbackDate)
  const type = optionalText(input, "type").toLowerCase()
  if (type === "job") return buildJobBlock(input, dateValue)
  if (type === "post") return buildPostBlock(input, dateValue)
  throw new Error("Import item type must be job or post.")
}

function comparableUrl(rawUrl: unknown) {
  const cleaned = cleanPublicUrl(rawUrl)
  if (!cleaned) return ""

  try {
    const url = new URL(cleaned)
    if (linkedinHosts.has(url.hostname.toLowerCase())) return canonicalLinkedInUrl(cleaned)
  } catch {
    return cleaned
  }

  return cleaned
}

function blockComparableUrls(block: FeedBlock) {
  return new Set((block.links || []).map((link) => comparableUrl(link.url)).filter(Boolean))
}

function sameBlock(existing: FeedBlock, incoming: FeedBlock) {
  if (existing.id && incoming.id && existing.id === incoming.id) return true

  const existingUrls = blockComparableUrls(existing)
  for (const url of blockComparableUrls(incoming)) {
    if (existingUrls.has(url)) return true
  }
  return false
}

export function mergeBlockList(blocks: FeedBlock[], block: FeedBlock, replaceExisting = false): MergeResult {
  let matched = false
  let inserted = true
  let replaced = false
  let outputBlock = block
  const nextBlocks = blocks.map((existing) => {
    if (!sameBlock(existing, block)) return existing

    matched = true
    if (replaceExisting) {
      replaced = true
      return block
    }

    inserted = false
    outputBlock = existing
    return existing
  })

  if (!matched) nextBlocks.push(block)
  return { blocks: nextBlocks, block: outputBlock, inserted, replaced }
}

function privateImportStatusLine(sourceStatusLine: unknown, importCount: number) {
  const statusLine = compactText(sourceStatusLine)
  if (importCount <= 0) return statusLine
  if (!statusLine) return "LinkedIn 私有导入已清洗 tracking URL。"
  if (statusLine.includes("LinkedIn 私有导入")) return statusLine
  return `${statusLine}；LinkedIn 私有导入已清洗 tracking URL。`
}

export function normalizePrivateImports(payload: unknown): PrivateImportPayload {
  if (!isRecord(payload)) return { version: 1, blocks: [] }
  const blocks = Array.isArray(payload.blocks) ? payload.blocks.filter(isRecord) as FeedBlock[] : []
  return {
    version: 1,
    updatedAt: compactText(payload.updatedAt) || undefined,
    blocks,
  }
}

export function mergeFeedWithPrivateImports(feed: FeedPayload, imports: PrivateImportPayload): FeedPayload & { blocks: FeedBlock[] } {
  let blocks = Array.isArray(feed.blocks) ? feed.blocks : []
  for (const block of imports.blocks) {
    blocks = mergeBlockList(blocks, block, true).blocks
  }

  return {
    ...feed,
    sourceStatusLine: privateImportStatusLine(feed.sourceStatusLine, imports.blocks.length),
    blocks,
  }
}
