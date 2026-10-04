"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BriefcaseBusiness, Check, ChevronDown, ChevronUp, Copy, ExternalLink, EyeOff, MessageSquareText, Plus, RefreshCw, RotateCcw, Send, Star, Trash2 } from "lucide-react"
import { adminFetch } from "@/utils/admin-auth-client"

type FeedKind = "deep-read" | "signal" | "theme" | "concept" | "paper" | "action"

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

type FeedOverflow = {
  summary?: string
  counts?: {
    candidates?: number
    overflow?: number
    duplicates?: number
    hidden?: number
  }
  themes?: Array<{
    title: string
    count?: number
    note?: string
  }>
}

type FeedCandidate = {
  title: string
  source?: string
  reason?: string
  priority?: number
  status?: "candidate" | "overflow" | "duplicate" | "watch" | string
  links?: FeedLink[]
}

type FeedPayload = {
  date: string
  generatedAt?: string
  overview?: string
  sourceStatusLine?: string
  overflow?: FeedOverflow
  candidatePool?: FeedCandidate[]
  blocks: FeedBlock[]
}

type StateEntry = {
  status?: "dismissed" | "read" | "new"
  at?: string
  cleared?: boolean
  clearedAt?: string
}

type ExposureEntry = {
  at?: string
  feedStamp?: string
  blockId?: string
}

type PinnedEntry = {
  at?: string
  block: FeedBlock
}

type SharedState = {
  state?: Record<string, StateEntry>
  exposurePool?: Record<string, ExposureEntry>
  pinned?: Record<string, PinnedEntry>
}

type AiTaskType = "ai" | "work" | "job" | "paper" | "project"
type AiTaskStatus = "inbox" | "next" | "waiting" | "done" | "snoozed"
type LinkedInImportType = "job" | "post"

type AiTask = {
  id: string
  title: string
  type: AiTaskType
  status: AiTaskStatus
  dueAt?: string | null
  url?: string | null
  note?: string | null
  sourceBlockId?: string | null
  sourceTitle?: string | null
  createdAt?: string
  updatedAt?: string
}

type LinkedInImportDraft = {
  type: LinkedInImportType
  url: string
  company: string
  role: string
  location: string
  author: string
  topic: string
  summary: string
  why: string
  thought: string
  priority: string
  extraLabel: string
  extraUrl: string
}

type LinkedInImportResponse = {
  block?: FeedBlock
  feed?: FeedPayload
  persisted?: boolean
  inserted?: boolean
  replaced?: boolean
  storage?: "supabase"
  error?: string
}

const feedApiPath = "/api/ai-feed"
const linkedinImportApiPath = "/api/ai-feed/import"
const publicFeedApiPath = "/api/ai-feed/public"
const taskApiPath = "/api/ai-tasks"
const stateKey = "ai-intel-feed-state-v1"
const exposurePoolKey = "ai-intel-feed-exposure-pool-v2"
const pinnedKey = "ai-intel-feed-pinned-v1"
const exposureTtlMs = 12 * 60 * 60 * 1000

const kindLabel: Record<FeedKind, string> = {
  "deep-read": "深读",
  signal: "信号",
  theme: "综合判断",
  concept: "概念",
  paper: "论文",
  action: "待处理",
}

const candidateStatusLabel: Record<string, string> = {
  candidate: "候选",
  overflow: "压下",
  duplicate: "重复",
  watch: "观察",
}

const preferredOrder: Record<FeedKind, number> = {
  "deep-read": 0,
  signal: 1,
  theme: 2,
  concept: 3,
  paper: 4,
  action: 5,
}

const readingFields = [
  {
    label: "它讲什么",
    shortLabel: "内容",
    tone: "text-[#2f6f66]",
    rule: "border-[#9fc9c0]",
    getValue: (block: FeedBlock) => block.summary,
  },
  {
    label: "为什么重要",
    shortLabel: "价值",
    tone: "text-[#8b4b5a]",
    rule: "border-[#d4a8b2]",
    getValue: (block: FeedBlock) => block.why,
  },
  {
    label: "我该怎么想",
    shortLabel: "处理",
    tone: "text-[#7a5b16]",
    rule: "border-[#d7bd73]",
    getValue: (block: FeedBlock) => block.thought,
  },
]

const taskTypeLabels: Record<AiTaskType, string> = {
  ai: "AI",
  work: "工作",
  job: "求职",
  paper: "论文",
  project: "项目",
}

const taskStatusLabels: Record<AiTaskStatus, string> = {
  inbox: "收件",
  next: "下一步",
  waiting: "等待",
  done: "完成",
  snoozed: "稍后",
}

const taskStatusStyles: Record<AiTaskStatus, { active: string; badge: string; card: string }> = {
  inbox: {
    active: "border-[#2f6f66] bg-[#e9f2ef] text-[#2f6f66]",
    badge: "bg-[#e9f2ef] text-[#2f6f66]",
    card: "border-l-[4px] border-l-[#2f6f66]",
  },
  next: {
    active: "border-[#496ca8] bg-[#edf3ff] text-[#31558f]",
    badge: "bg-[#edf3ff] text-[#31558f]",
    card: "border-l-[4px] border-l-[#496ca8]",
  },
  waiting: {
    active: "border-[#b48a21] bg-[#fff5d7] text-[#7a5b16]",
    badge: "bg-[#fff5d7] text-[#7a5b16]",
    card: "border-l-[4px] border-l-[#b48a21]",
  },
  snoozed: {
    active: "border-[#8b6cb4] bg-[#f4effa] text-[#684d8b]",
    badge: "bg-[#f4effa] text-[#684d8b]",
    card: "border-l-[4px] border-l-[#8b6cb4]",
  },
  done: {
    active: "border-[#8a938f] bg-[#eef0ee] text-[#62706e]",
    badge: "bg-[#eef0ee] text-[#62706e]",
    card: "border-l-[4px] border-l-[#8a938f]",
  },
}

const emptyLinkedInImportDraft: LinkedInImportDraft = {
  type: "job",
  url: "",
  company: "",
  role: "",
  location: "",
  author: "",
  topic: "",
  summary: "",
  why: "",
  thought: "",
  priority: "",
  extraLabel: "",
  extraUrl: "",
}

function titleSignature(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
}

function canonicalUrl(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) return ""
  try {
    const parsed = new URL(url)
    if (parsed.hostname.toLowerCase() === "mail.google.com") {
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "") || "/"}${parsed.search}${parsed.hash}`
    }
    const kept = new URLSearchParams()
    parsed.searchParams.forEach((value, key) => {
      if (key === "fbclid" || key === "gclid" || key === "mc_cid" || key === "mc_eid" || key === "ref" || key === "source") return
      if (key.startsWith("utm_")) return
      kept.append(key, value)
    })
    const query = kept.toString()
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "") || "/"}${query ? `?${query}` : ""}`
  } catch {
    return ""
  }
}

function blockFingerprints(block: FeedBlock) {
  const values = new Set<string>(block.fingerprints || [])
  values.add(`title:${titleSignature(block.title)}`)
  for (const link of block.links || []) {
    const canonical = canonicalUrl(link.url)
    if (canonical) values.add(`url:${canonical}`)
  }
  return [...values].filter((value) => !value.endsWith(":"))
}

function blockKey(block: FeedBlock) {
  if (block.id) return block.id
  const firstUrl = block.links?.[0]?.url || ""
  return `${block.kind}:${titleSignature(block.title)}:${canonicalUrl(firstUrl)}`
}

function readJsonMap<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}")
  } catch {
    return {}
  }
}

function writeJsonMap<T>(key: string, value: Record<string, T>) {
  localStorage.setItem(key, JSON.stringify(value))
}

function mergeByTime<T extends { at?: string; clearedAt?: string }>(base: Record<string, T>, incoming?: Record<string, T>) {
  const merged = { ...base }
  for (const [key, value] of Object.entries(incoming || {})) {
    const existing = merged[key]
    const oldAt = existing?.clearedAt || existing?.at || ""
    const newAt = value?.clearedAt || value?.at || ""
    if (!existing || newAt >= oldAt) merged[key] = value
  }
  return merged
}

function pruneExposurePool(pool: Record<string, ExposureEntry>) {
  const now = Date.now()
  return Object.fromEntries(
    Object.entries(pool).filter(([, value]) => {
      const at = Date.parse(value.at || "")
      return Number.isFinite(at) && now - at < exposureTtlMs
    }),
  )
}

function linkIsObsidian(url: string) {
  return url.startsWith("obsidian://")
}

function buildCopyText(block: FeedBlock) {
  const links = block.links?.map((link) => `- ${link.label}: ${link.url}`).join("\n") || "- 无链接"
  const details = block.details?.length
    ? block.details
        .map((section) => {
          const body = section.body ? `\n${section.body}` : ""
          const items = section.items?.length ? `\n${section.items.map((item) => `- ${item}`).join("\n")}` : ""
          return `## ${section.title}${body}${items}`
        })
        .join("\n\n")
    : ""
  return [
    `请和我讨论这个 AI 信息流块：${block.title}`,
    `类型：${kindLabel[block.kind] || block.kind}`,
    `来源：${block.source}`,
    `来源状态：${block.sourceStatus || "未标注"}`,
    `摘要：${block.summary}`,
    `为什么重要：${block.why}`,
    `我该怎么想：${block.thought}`,
    details ? `\n细节：\n${details}` : "",
    "",
    "链接：",
    links,
  ].join("\n")
}

type AiIntelFeedProps = {
  publicMode?: boolean
}

export function AiIntelFeed({ publicMode = false }: AiIntelFeedProps = {}) {
  const [feed, setFeed] = useState<FeedPayload | null>(null)
  const [error, setError] = useState("")
  const [authNeeded, setAuthNeeded] = useState(false)
  const [state, setState] = useState<Record<string, StateEntry>>({})
  const [exposurePool, setExposurePool] = useState<Record<string, ExposureEntry>>({})
  const [pinned, setPinned] = useState<Record<string, PinnedEntry>>({})
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [copiedId, setCopiedId] = useState("")
  const [toast, setToast] = useState("")
  const [tasks, setTasks] = useState<AiTask[]>([])
  const [taskError, setTaskError] = useState("")
  const [taskDraft, setTaskDraft] = useState({ title: "", type: "ai" as AiTaskType, dueAt: "", note: "" })
  const [taskComposerOpen, setTaskComposerOpen] = useState(false)
  const [linkedinImportOpen, setLinkedinImportOpen] = useState(false)
  const [linkedinImportBusy, setLinkedinImportBusy] = useState(false)
  const [linkedinImportError, setLinkedinImportError] = useState("")
  const [linkedinImportResult, setLinkedinImportResult] = useState("")
  const [linkedinImportDraft, setLinkedinImportDraft] = useState<LinkedInImportDraft>(emptyLinkedInImportDraft)
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})

  const feedStamp = feed?.generatedAt || feed?.date || ""

  useEffect(() => {
    async function load() {
      if (publicMode) {
        const response = await fetch(publicFeedApiPath, { cache: "no-store" })
        if (!response.ok) throw new Error(`Feed request failed: ${response.status}`)
        const payload = (await response.json()) as { feed: FeedPayload }
        setFeed(payload.feed)
        return
      }

      const localState = readJsonMap<StateEntry>(stateKey)
      const localExposurePool = pruneExposurePool(readJsonMap<ExposureEntry>(exposurePoolKey))
      const localPinned = readJsonMap<PinnedEntry>(pinnedKey)

      const response = await adminFetch(feedApiPath, { cache: "no-store" })
      if (response.status === 401 || response.status === 403) {
        setAuthNeeded(true)
        return
      }
      if (!response.ok) throw new Error(`Feed request failed: ${response.status}`)
      const payload = (await response.json()) as { feed: FeedPayload; sharedState: SharedState }
      const shared = payload.sharedState || {}

      const nextState = mergeByTime(localState, shared.state)
      const nextExposurePool = pruneExposurePool(mergeByTime(localExposurePool, shared.exposurePool))
      const nextPinned = mergeByTime(localPinned, shared.pinned)
      setState(nextState)
      setExposurePool(nextExposurePool)
      setPinned(nextPinned)
      writeJsonMap(stateKey, nextState)
      writeJsonMap(exposurePoolKey, nextExposurePool)
      writeJsonMap(pinnedKey, nextPinned)

      setFeed(payload.feed)

      const taskResponse = await adminFetch(taskApiPath, { cache: "no-store" })
      if (taskResponse.ok) {
        const taskPayload = (await taskResponse.json()) as { tasks: AiTask[] }
        setTasks(taskPayload.tasks || [])
        setTaskError("")
      } else {
        const taskPayload = (await taskResponse.json().catch(() => ({}))) as { error?: string }
        setTaskError(taskPayload.error || `Task request failed: ${taskResponse.status}`)
      }
    }

    load().catch((err: Error) => {
      if (err.message.includes("Missing admin session")) setAuthNeeded(true)
      else setError(err.message)
    })
  }, [publicMode])

  const blocks = useMemo(() => {
    return [...(feed?.blocks || [])].sort((a, b) => {
      const byOrder = preferredOrder[a.kind] - preferredOrder[b.kind]
      if (byOrder !== 0) return byOrder
      return (b.priority || 0) - (a.priority || 0)
    })
  }, [feed])

  const isDismissed = (block: FeedBlock) => {
    const entry = state[blockKey(block)]
    return entry?.status === "dismissed" || entry?.status === "read"
  }

  const isPoolSuppressed = (block: FeedBlock) => {
    return blockFingerprints(block).some((fingerprint) => {
      const entry = exposurePool[fingerprint]
      return entry && entry.feedStamp !== feedStamp
    })
  }

  const isPinned = (block: FeedBlock) => {
    return Object.values(pinned).some((entry) => {
      const entryFingerprints = new Set(blockFingerprints(entry.block))
      return blockKey(entry.block) === blockKey(block) || blockFingerprints(block).some((fingerprint) => entryFingerprints.has(fingerprint))
    })
  }

  const activeBlocks = publicMode ? blocks : blocks.filter((block) => !isDismissed(block) && !isPinned(block) && !isPoolSuppressed(block))
  const pinnedBlocks = publicMode ? [] : Object.values(pinned)
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .map((entry) => blocks.find((block) => blockKey(block) === blockKey(entry.block)) || entry.block)
    .filter((block) => !isDismissed(block))
  const dismissedBlocks = publicMode ? [] : blocks.filter((block) => isDismissed(block) && !state[blockKey(block)]?.cleared)
  const actionBlocks = publicMode ? [] : activeBlocks.filter((block) => block.kind === "action").slice(0, 3)
  const nonActionBlocks = activeBlocks.filter((block) => block.kind !== "action")
  const topBlock = nonActionBlocks[0]
  const feedBlocks = nonActionBlocks.slice(1)
  const roundTotal = activeBlocks.length + dismissedBlocks.length + pinnedBlocks.length
  const handled = Math.max(0, roundTotal - activeBlocks.length)
  const progress = roundTotal ? Math.min(100, Math.round((handled / roundTotal) * 100)) : 0
  const openTaskCount = tasks.filter((task) => task.status !== "done").length
  const overflow = publicMode ? undefined : feed?.overflow
  const candidatePool = publicMode ? [] : feed?.candidatePool || []
  const visibleCandidates = candidatePool.slice(0, 8)
  const overflowCounts = overflow?.counts || {}
  const hasOverflowInfo = Boolean(
    overflow?.summary ||
      overflow?.themes?.length ||
      candidatePool.length ||
      overflowCounts.candidates ||
      overflowCounts.overflow ||
      overflowCounts.duplicates ||
      overflowCounts.hidden,
  )

  function persistState(nextState = state, nextExposurePool = exposurePool, nextPinned = pinned) {
    writeJsonMap(stateKey, nextState)
    writeJsonMap(exposurePoolKey, nextExposurePool)
    writeJsonMap(pinnedKey, nextPinned)
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(""), 1800)
  }

  function dismissBlock(block: FeedBlock) {
    const key = blockKey(block)
    const nextState = { ...state, [key]: { status: "dismissed" as const, at: new Date().toISOString(), cleared: false } }
    const nextExposurePool = { ...exposurePool }
    for (const fingerprint of blockFingerprints(block)) {
      nextExposurePool[fingerprint] = { at: new Date().toISOString(), feedStamp, blockId: key }
    }
    const nextPinned = { ...pinned }
    delete nextPinned[key]
    setState(nextState)
    setExposurePool(nextExposurePool)
    setPinned(nextPinned)
    persistState(nextState, nextExposurePool, nextPinned)
  }

  function restoreBlock(block: FeedBlock) {
    const key = blockKey(block)
    const nextState = { ...state }
    delete nextState[key]
    const nextExposurePool = { ...exposurePool }
    for (const fingerprint of blockFingerprints(block)) delete nextExposurePool[fingerprint]
    setState(nextState)
    setExposurePool(nextExposurePool)
    persistState(nextState, nextExposurePool, pinned)
  }

  function clearRoundDismissed() {
    const nextState = { ...state }
    for (const block of blocks) {
      const key = blockKey(block)
      const entry = nextState[key]
      if (entry?.status === "dismissed" || entry?.status === "read") {
        nextState[key] = { ...entry, cleared: true, clearedAt: new Date().toISOString() }
      }
    }
    setState(nextState)
    persistState(nextState, exposurePool, pinned)
    showToast("本轮已丢弃列表已清空")
  }

  function togglePinned(block: FeedBlock) {
    const key = blockKey(block)
    const nextPinned = { ...pinned }
    if (isPinned(block)) {
      delete nextPinned[key]
      showToast("已取消钉住")
    } else {
      nextPinned[key] = { at: new Date().toISOString(), block }
      showToast("已钉住待看")
    }
    setPinned(nextPinned)
    persistState(state, exposurePool, nextPinned)
  }

  async function copyBlock(block: FeedBlock) {
    const key = blockKey(block)
    await navigator.clipboard.writeText(buildCopyText(block))
    setCopiedId(key)
    showToast("已复制给 Codex 讨论")
    window.setTimeout(() => setCopiedId(""), 1400)
  }

  function inferTaskType(block: FeedBlock): AiTaskType {
    const title = block.title.toLowerCase()
    if (block.kind === "paper") return "paper"
    if (title.includes("job") || title.includes("职位") || title.includes("linkedin")) return "job"
    if (block.kind === "action") return "work"
    if (block.kind === "concept" || block.kind === "theme" || block.kind === "signal" || block.kind === "deep-read") return "ai"
    return "project"
  }

  function primaryTaskUrl(block: FeedBlock) {
    const links = block.links || []
    return links.find((link) => !linkIsObsidian(link.url))?.url || links[0]?.url || ""
  }

  async function createTask(payload: Partial<AiTask> & { title: string }) {
    const response = await adminFetch(taskApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => ({}))) as { task?: AiTask; error?: string }
    if (!response.ok || !data.task) {
      setTaskError(data.error || `Task request failed: ${response.status}`)
      return false
    }
    setTasks((current) => [data.task as AiTask, ...current])
    setTaskError("")
    showToast("已加入待办")
    return true
  }

  async function createDraftTask() {
    if (!taskDraft.title.trim()) return
    const created = await createTask({
      title: taskDraft.title.trim(),
      type: taskDraft.type,
      status: "inbox",
      dueAt: taskDraft.dueAt || null,
      note: taskDraft.note.trim() || null,
    })
    if (created) {
      setTaskDraft({ title: "", type: "ai", dueAt: "", note: "" })
      setTaskComposerOpen(false)
    }
  }

  async function addBlockToTasks(block: FeedBlock) {
    await createTask({
      title: block.title,
      type: inferTaskType(block),
      status: block.kind === "action" ? "next" : "inbox",
      url: primaryTaskUrl(block),
      note: block.thought,
      sourceBlockId: blockKey(block),
      sourceTitle: block.title,
    })
  }

  function updateLinkedInImportDraft(patch: Partial<LinkedInImportDraft>) {
    setLinkedinImportDraft((current) => ({ ...current, ...patch }))
    setLinkedinImportError("")
    setLinkedinImportResult("")
  }

  function selectLinkedInImportType(type: LinkedInImportType) {
    setLinkedinImportDraft((current) => ({ ...current, type }))
    setLinkedinImportError("")
    setLinkedinImportResult("")
  }

  function buildLinkedInImportItem() {
    const links = linkedinImportDraft.extraUrl.trim()
      ? [{ label: linkedinImportDraft.extraLabel.trim() || "Source", url: linkedinImportDraft.extraUrl.trim() }]
      : []
    const priority = linkedinImportDraft.priority.trim() ? Number(linkedinImportDraft.priority) : undefined
    const item: Record<string, unknown> = {
      type: linkedinImportDraft.type,
      url: linkedinImportDraft.url.trim(),
      why: linkedinImportDraft.why.trim(),
      thought: linkedinImportDraft.thought.trim() || undefined,
      priority,
      links,
    }

    if (linkedinImportDraft.type === "job") {
      item.company = linkedinImportDraft.company.trim()
      item.role = linkedinImportDraft.role.trim()
      item.location = linkedinImportDraft.location.trim()
      item.summary = linkedinImportDraft.summary.trim() || undefined
    } else {
      item.author = linkedinImportDraft.author.trim()
      item.topic = linkedinImportDraft.topic.trim()
      item.summary = linkedinImportDraft.summary.trim()
    }

    return item
  }

  async function submitLinkedInImport() {
    setLinkedinImportBusy(true)
    setLinkedinImportError("")
    setLinkedinImportResult("")
    try {
      const response = await adminFetch(linkedinImportApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: buildLinkedInImportItem() }),
      })
      const data = (await response.json().catch(() => ({}))) as LinkedInImportResponse
      if (!response.ok) {
        setLinkedinImportError(data.error || `Import request failed: ${response.status}`)
        return
      }

      if (data.feed) setFeed(data.feed)

      const message = data.persisted
        ? data.inserted
          ? "已写入 Supabase 信息流收件箱"
          : data.replaced
            ? "已更新 Supabase 信息流收件箱"
            : "已存在，未重复添加"
        : data.error || "已生成预览，但没有持久写入"
      setLinkedinImportResult(message)
      showToast(message)

      if (data.persisted) {
        setLinkedinImportDraft({ ...emptyLinkedInImportDraft, type: linkedinImportDraft.type })
        setLinkedinImportOpen(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Missing admin session")) setAuthNeeded(true)
      setLinkedinImportError(message)
    } finally {
      setLinkedinImportBusy(false)
    }
  }

  function renderLinkedInImporter() {
    if (!linkedinImportOpen) return null
    const isJob = linkedinImportDraft.type === "job"
    const inputClass = "min-h-[42px] rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f6f66]"
    const labelClass = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#62706e]"

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(28,37,38,0.42)] px-4 py-6">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submitLinkedInImport()
          }}
          className="max-h-[calc(100vh-48px)] w-full max-w-[680px] overflow-y-auto rounded-xl border border-[#d7ddda] bg-[#fffdfa] p-4 shadow-[0_24px_80px_rgba(28,37,38,0.24)] sm:p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold leading-tight tracking-normal text-[#182120]">导入 LinkedIn</h2>
              <div className="mt-1 text-sm text-[#62706e]">写入私有信息流，不进入公开预览。</div>
            </div>
            <button
              type="button"
              onClick={() => setLinkedinImportOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7ddda] bg-white text-[#62706e]"
              aria-label="关闭"
              title="关闭"
            >
              ×
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectLinkedInImportType("job")}
              className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                isJob ? "border-[#2f6f66] bg-[#e9f2ef] text-[#2f6f66]" : "border-[#d7ddda] bg-white text-[#62706e]"
              }`}
            >
              <BriefcaseBusiness className="h-4 w-4" />
              职位
            </button>
            <button
              type="button"
              onClick={() => selectLinkedInImportType("post")}
              className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                !isJob ? "border-[#2f6f66] bg-[#e9f2ef] text-[#2f6f66]" : "border-[#d7ddda] bg-white text-[#62706e]"
              }`}
            >
              <MessageSquareText className="h-4 w-4" />
              Post
            </button>
          </div>

          <div className="grid gap-3">
            <label className={labelClass}>
              URL
              <input
                value={linkedinImportDraft.url}
                onChange={(event) => updateLinkedInImportDraft({ url: event.target.value })}
                placeholder={isJob ? "linkedin.com/jobs/view/..." : "linkedin.com/feed/update/activity:..."}
                className={inputClass}
                required
                autoFocus
              />
            </label>

            {isJob ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  公司
                  <input
                    value={linkedinImportDraft.company}
                    onChange={(event) => updateLinkedInImportDraft({ company: event.target.value })}
                    className={inputClass}
                    required
                  />
                </label>
                <label className={labelClass}>
                  职位
                  <input
                    value={linkedinImportDraft.role}
                    onChange={(event) => updateLinkedInImportDraft({ role: event.target.value })}
                    className={inputClass}
                    required
                  />
                </label>
                <label className={labelClass}>
                  地点
                  <input
                    value={linkedinImportDraft.location}
                    onChange={(event) => updateLinkedInImportDraft({ location: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  优先级
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={linkedinImportDraft.priority}
                    onChange={(event) => updateLinkedInImportDraft({ priority: event.target.value })}
                    placeholder="64"
                    className={inputClass}
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  作者
                  <input
                    value={linkedinImportDraft.author}
                    onChange={(event) => updateLinkedInImportDraft({ author: event.target.value })}
                    className={inputClass}
                    required
                  />
                </label>
                <label className={labelClass}>
                  主题
                  <input
                    value={linkedinImportDraft.topic}
                    onChange={(event) => updateLinkedInImportDraft({ topic: event.target.value })}
                    className={inputClass}
                    required
                  />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  优先级
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={linkedinImportDraft.priority}
                    onChange={(event) => updateLinkedInImportDraft({ priority: event.target.value })}
                    placeholder="58"
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            <label className={labelClass}>
              摘要
              <textarea
                value={linkedinImportDraft.summary}
                onChange={(event) => updateLinkedInImportDraft({ summary: event.target.value })}
                placeholder={isJob ? "可空；空时按公司/职位/地点生成。" : ""}
                className="min-h-[86px] resize-none rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-[#2f6f66]"
                required={!isJob}
              />
            </label>

            <label className={labelClass}>
              价值
              <textarea
                value={linkedinImportDraft.why}
                onChange={(event) => updateLinkedInImportDraft({ why: event.target.value })}
                className="min-h-[86px] resize-none rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-[#2f6f66]"
                required
              />
            </label>

            <label className={labelClass}>
              处理
              <textarea
                value={linkedinImportDraft.thought}
                onChange={(event) => updateLinkedInImportDraft({ thought: event.target.value })}
                className="min-h-[74px] resize-none rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-[#2f6f66]"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <label className={labelClass}>
                外链标签
                <input
                  value={linkedinImportDraft.extraLabel}
                  onChange={(event) => updateLinkedInImportDraft({ extraLabel: event.target.value })}
                  placeholder={isJob ? "Company" : "Source"}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                外链 URL
                <input
                  value={linkedinImportDraft.extraUrl}
                  onChange={(event) => updateLinkedInImportDraft({ extraUrl: event.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          {linkedinImportError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{linkedinImportError}</div> : null}
          {linkedinImportResult ? <div className="mt-4 rounded-lg border border-[#cfe2dd] bg-[#f3faf7] px-3 py-2 text-sm text-[#2f6f66]">{linkedinImportResult}</div> : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setLinkedinImportOpen(false)}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={linkedinImportBusy}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {linkedinImportBusy ? "导入中" : "导入"}
            </button>
          </div>
        </form>
      </div>
    )
  }

  function renderBlockDetails(block: FeedBlock) {
    const details = block.details?.filter((section) => section.title && (section.body || section.items?.length)) || []
    if (!details.length) return null
    const key = blockKey(block)
    const expanded = Boolean(expandedDetails[key])

    return (
      <div className="mt-4 border-t border-[#e4e0d8] pt-3">
        <button
          type="button"
          onClick={() => setExpandedDetails((current) => ({ ...current, [key]: !expanded }))}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-[#cfe2dd] bg-[#f3faf7] px-3 py-2 text-sm font-semibold text-[#2f6f66]"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {expanded ? "收起细节" : "展开细节"}
        </button>
        {expanded ? (
          <div className="mt-3 grid gap-3">
            {details.map((section) => (
              <section key={section.title} className="m-0 rounded-lg border border-[#e4e0d8] bg-[#f8f6f0] p-3">
                <h4 className="m-0 mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#8b4b5a]">{section.title}</h4>
                {section.body ? <p className="m-0 text-[14px] leading-7 text-[#394441]">{section.body}</p> : null}
                {section.items?.length ? (
                  <ul className="m-0 grid gap-1.5 pl-4 text-[14px] leading-7 text-[#394441]">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  async function updateTask(task: AiTask, patch: Partial<AiTask>) {
    const response = await adminFetch(taskApiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, ...patch }),
    })
    const data = (await response.json().catch(() => ({}))) as { task?: AiTask; error?: string }
    if (!response.ok || !data.task) {
      setTaskError(data.error || `Task request failed: ${response.status}`)
      return
    }
    setTasks((current) => current.map((item) => (item.id === task.id ? (data.task as AiTask) : item)))
    setTaskError("")
  }

  async function deleteTask(task: AiTask) {
    const response = await adminFetch(`${taskApiPath}?id=${encodeURIComponent(task.id)}`, { method: "DELETE" })
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      setTaskError(data.error || `Task request failed: ${response.status}`)
      return
    }
    setTasks((current) => current.filter((item) => item.id !== task.id))
    setTaskError("")
    showToast("已删除待办")
  }

  function renderTasks() {
    const openTasks = tasks.filter((task) => task.status !== "done")
    const doneTasks = tasks.filter((task) => task.status === "done").slice(0, 3)
    const visibleTasks = [...openTasks, ...doneTasks]

    return (
      <section className="min-h-0 overflow-hidden rounded-lg border border-[#d7ddda] bg-white shadow-[0_14px_36px_rgba(41,50,48,0.10)]">
        <div className="h-full overflow-y-auto p-3">
          <div className="grid gap-2">
            {visibleTasks.length ? (
              visibleTasks.map((task) => (
                <div key={task.id} className={`rounded-lg border border-[#e4e0d8] bg-[#fffdfa] p-3 ${taskStatusStyles[task.status].card} ${task.status === "done" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a938f]">
                        <span>{taskTypeLabels[task.type]}</span>
                        <span className="h-1 w-1 rounded-full bg-[#c1c9c5]" />
                        <span className={`rounded-full px-1.5 py-0.5 ${taskStatusStyles[task.status].badge}`}>{taskStatusLabels[task.status]}</span>
                      </div>
                      <div className="text-sm font-semibold leading-5 text-[#1c2526]">{task.title}</div>
                      {task.note ? <p className="m-0 mt-1 text-xs leading-5 text-[#62706e]">{task.note}</p> : null}
                      {task.dueAt ? <div className="mt-1 text-xs text-[#8b4b5a]">截止 {task.dueAt.slice(0, 10)}</div> : null}
                      {task.url ? (
                        <a href={task.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 border-b border-[rgba(47,111,102,.35)] text-xs font-semibold text-[#2f6f66]">
                          打开链接
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTask(task)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7ddda] bg-white text-[#62706e]"
                      aria-label="删除待办"
                      title="删除待办"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(["inbox", "next", "waiting", "snoozed", "done"] as AiTaskStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateTask(task, { status })}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          task.status === status ? taskStatusStyles[status].active : "border-[#d7ddda] bg-white text-[#62706e]"
                        }`}
                      >
                        {taskStatusLabels[status]}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[#d7ddda] px-3 py-4 text-sm leading-6 text-[#62706e]">还没有待办。</div>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderTaskComposer() {
    if (!taskComposerOpen) return null
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(28,37,38,0.42)] px-4 py-6">
        <div className="w-full max-w-[460px] rounded-xl border border-[#d7ddda] bg-[#fffdfa] p-4 shadow-[0_24px_80px_rgba(28,37,38,0.24)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold leading-tight tracking-normal text-[#182120]">新增工作待办</h2>
              <div className="mt-1 text-sm text-[#62706e]">只记录真正需要推进的 AI、工作、求职、论文或项目动作。</div>
            </div>
            <button
              type="button"
              onClick={() => setTaskComposerOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7ddda] bg-white text-[#62706e]"
              aria-label="关闭"
              title="关闭"
            >
              ×
            </button>
          </div>
          <div className="grid gap-3">
            <input
              value={taskDraft.title}
              onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="待办标题"
              className="min-h-[42px] rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f6f66]"
              autoFocus
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={taskDraft.type}
                onChange={(event) => setTaskDraft((current) => ({ ...current, type: event.target.value as AiTaskType }))}
                className="min-h-[42px] rounded-lg border border-[#d7ddda] bg-white px-2 py-2 text-sm outline-none"
              >
                {Object.entries(taskTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={taskDraft.dueAt}
                onChange={(event) => setTaskDraft((current) => ({ ...current, dueAt: event.target.value }))}
                className="min-h-[42px] rounded-lg border border-[#d7ddda] bg-white px-2 py-2 text-sm outline-none"
              />
            </div>
            <textarea
              value={taskDraft.note}
              onChange={(event) => setTaskDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="备注"
              className="min-h-[96px] resize-none rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-[#2f6f66]"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setTaskComposerOpen(false)}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={createDraftTask}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white"
            >
              <Plus className="h-4 w-4" />
              添加
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderBlock(block: FeedBlock, compact = false) {
    const key = blockKey(block)
    const dismissed = isDismissed(block)
    const pinnedState = isPinned(block)
    return (
      <article
        key={key}
        className={`rounded-lg border bg-[#fffdfa] shadow-[0_18px_44px_rgba(41,50,48,0.11)] ${
          compact ? "p-3 shadow-none" : "p-4 sm:p-5"
        } ${pinnedState ? "border-[#b8d6cf] bg-[#fbfefd]" : "border-[#d7ddda]"} ${dismissed ? "opacity-70" : ""}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a938f]">
              <span>{kindLabel[block.kind]}</span>
              <span className="h-1 w-1 rounded-full bg-[#c1c9c5]" />
              <span>{block.source}</span>
            </div>
            <h3 className={`${compact ? "text-[15px]" : "text-[21px]"} min-w-0 font-semibold leading-tight tracking-normal text-[#182120]`}>
              {block.title}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!publicMode && !dismissed ? (
              <button
                type="button"
                onClick={() => togglePinned(block)}
                aria-label={pinnedState ? "取消钉住" : "钉住待看"}
                title={pinnedState ? "取消钉住" : "钉住待看"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                  pinnedState ? "border-[#d9bdc4] bg-[#fff8fa] text-[#8b4b5a]" : "border-[#d7ddda] bg-white text-[#62706e]"
                }`}
              >
                <Star className={`h-4 w-4 ${pinnedState ? "fill-current" : ""}`} />
              </button>
            ) : null}
            <span className="whitespace-nowrap rounded-full border border-[#cfe2dd] bg-[#e9f2ef] px-2.5 py-1 text-xs text-[#2f6f66]">
              {block.sourceStatus || kindLabel[block.kind]}
            </span>
          </div>
        </div>

        {block.sourceWarning ? (
          <div className="mb-3 inline-flex rounded-lg border border-[#ead7a4] bg-[#fff7df] px-2 py-1 text-xs text-[#7a5b16]">
            {block.sourceWarning}
          </div>
        ) : null}

        {compact ? (
          <p className="m-0 text-sm leading-6 text-[#62706e]">{block.summary}</p>
        ) : (
          <div className="mt-4 grid gap-4 border-y border-[#e4e0d8] py-4 md:grid-cols-3">
            {readingFields.map((field) => (
              <div key={field.label} className={`min-w-0 border-l-[3px] ${field.rule} pl-3`}>
                <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${field.tone}`}>
                  {field.shortLabel}
                </div>
                <strong className="mb-2 block text-[15px] font-semibold leading-tight text-[#1c2526]">{field.label}</strong>
                <p className="m-0 text-justify text-[14px] leading-7 text-[#394441] [text-align-last:left]">{field.getValue(block)}</p>
              </div>
            ))}
          </div>
        )}

        {!compact ? renderBlockDetails(block) : null}

        {block.links?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {block.links.map((link) => (
              <a
                key={`${key}:${link.url}`}
                href={link.url}
                target={linkIsObsidian(link.url) ? undefined : "_blank"}
                rel={linkIsObsidian(link.url) ? undefined : "noreferrer"}
                className="inline-flex items-center gap-1.5 border-b border-[rgba(47,111,102,.35)] text-sm font-semibold text-[#2f6f66]"
              >
                {link.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        ) : null}

        {!publicMode ? <div className="mt-4 flex flex-wrap gap-2">
          {dismissed ? (
            <button
              type="button"
              onClick={() => restoreBlock(block)}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
            >
              恢复
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dismissBlock(block)}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white"
            >
              丢弃
            </button>
          )}
          <button
            type="button"
            onClick={() => copyBlock(block)}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
          >
            {copiedId === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            复制给 Codex 讨论
          </button>
          <button
            type="button"
            onClick={() => addBlockToTasks(block)}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
          >
            <Plus className="h-4 w-4" />
            加入待办
          </button>
        </div> : null}
      </article>
    )
  }

  function renderCandidatePool() {
    if (!hasOverflowInfo) return null

    const countChips: string[] = []
    if (typeof overflowCounts.candidates === "number") countChips.push(`候选 ${overflowCounts.candidates}`)
    if (typeof overflowCounts.overflow === "number") countChips.push(`压下 ${overflowCounts.overflow}`)
    if (typeof overflowCounts.duplicates === "number") countChips.push(`重复 ${overflowCounts.duplicates}`)
    if (typeof overflowCounts.hidden === "number") countChips.push(`隐藏 ${overflowCounts.hidden}`)

    return (
      <section className="rounded-lg border border-[#d7ddda] bg-white p-4 shadow-[0_14px_36px_rgba(41,50,48,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-lg font-semibold tracking-normal">候选池</h2>
            <p className="m-0 text-sm leading-6 text-[#62706e]">
              主信息流只保留最高价值块；这里记录被压下去但仍值得知道的候选。
            </p>
          </div>
          {candidatePool.length ? (
            <span className="rounded-full border border-[#cfe2dd] bg-[#f3faf7] px-2.5 py-1 text-xs font-semibold text-[#2f6f66]">
              {candidatePool.length}
            </span>
          ) : null}
        </div>

        {overflow?.summary ? <p className="mt-3 text-sm leading-6 text-[#394441]">{overflow.summary}</p> : null}

        {countChips.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {countChips.map((chip) => (
              <span key={chip} className="rounded-full bg-[#f4f1e9] px-2.5 py-1 text-xs text-[#62706e]">
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {overflow?.themes?.length ? (
          <div className="mt-3 border-t border-[#e4e0d8] pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8b4b5a]">过载主题</div>
            <ul className="m-0 grid gap-2 p-0">
              {overflow.themes.slice(0, 4).map((theme) => (
                <li key={`${theme.title}-${theme.count || 0}`} className="list-none text-sm leading-5 text-[#394441]">
                  <span className="font-semibold text-[#1c2526]">{theme.title}</span>
                  {typeof theme.count === "number" ? <span className="text-[#62706e]"> · {theme.count} 条</span> : null}
                  {theme.note ? <div className="mt-0.5 text-[#62706e]">{theme.note}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {visibleCandidates.length ? (
          <ol className="mt-3 grid gap-0 border-t border-[#e4e0d8] p-0">
            {visibleCandidates.map((candidate, index) => {
              const firstLink = candidate.links?.find((link) => link.url)
              const status = candidate.status ? candidateStatusLabel[candidate.status] || candidate.status : "候选"
              return (
                <li key={`${candidate.title}-${index}`} className="list-none border-b border-[#e4e0d8] py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-5 text-[#1c2526]">{candidate.title}</div>
                      <div className="mt-1 text-xs text-[#62706e]">
                        {candidate.source || "来源未标注"} · {status}
                        {typeof candidate.priority === "number" ? ` · P${candidate.priority}` : ""}
                      </div>
                    </div>
                    {firstLink ? (
                      <a
                        href={firstLink.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d7ddda] text-[#2f6f66]"
                        aria-label={`打开 ${candidate.title}`}
                        title={firstLink.label || "打开链接"}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                  {candidate.reason ? <p className="m-0 mt-1 text-[13px] leading-5 text-[#62706e]">{candidate.reason}</p> : null}
                </li>
              )
            })}
          </ol>
        ) : null}

        {candidatePool.length > visibleCandidates.length ? (
          <div className="mt-3 text-xs text-[#62706e]">
            还有 {candidatePool.length - visibleCandidates.length} 个候选保留在 JSON 中。
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-[#1c2526]">
      <div className="mx-auto w-[min(1120px,calc(100vw-32px))] py-7 sm:py-8">
        <header className="mb-6 overflow-hidden rounded-xl border border-[#d7ddda] bg-[#fffdfa] shadow-[0_18px_46px_rgba(41,50,48,0.08)]">
          <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h1 className="m-0 text-[clamp(38px,6vw,72px)] font-semibold leading-[0.92] tracking-normal text-[#182120]">
                信息流
              </h1>
              <div className="mt-3 text-sm text-[#62706e]">
                {feed
                  ? publicMode
                    ? `公开预览 · 更新于 ${feed.generatedAt || feed.date}`
                    : `生成于 ${feed.generatedAt || feed.date} · 每次同步后线上更新 · 来源 本地数据`
                  : "正在读取 feed..."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {publicMode ? (
                <Link href="/ai-feed" className="inline-flex min-h-[38px] items-center rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white">
                  Admin feed
                </Link>
              ) : null}
              {!publicMode ? (
                <>
              <button
                type="button"
                onClick={() => {
                  setLinkedinImportError("")
                  setLinkedinImportResult("")
                  setLinkedinImportOpen(true)
                }}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white"
              >
                <BriefcaseBusiness className="h-4 w-4" />
                导入 LinkedIn
              </button>
              <span className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#62706e]">
                Admin only
              </span>
              <button
                type="button"
                onClick={() => setShowDiscarded((value) => !value)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
              >
                <EyeOff className="h-4 w-4" />
                {showDiscarded ? "隐藏已丢弃" : "查看已丢弃"}
              </button>
              <button
                type="button"
                onClick={clearRoundDismissed}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
              >
                <RotateCcw className="h-4 w-4" />
                清空本轮丢弃
              </button>
                </>
              ) : null}
            </div>
          </div>
          {!publicMode ? <div className="border-t border-[#e4e0d8] bg-[#f8f6f0] px-5 py-3 sm:px-6">
            <div className="max-w-4xl text-[13px] leading-6 text-[#62706e]">
              {feed?.sourceStatusLine ? (
                <>
                  <span className="mr-2 rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b4b5a]">
                    采集状态
                  </span>
                  {feed.sourceStatusLine}
                </>
              ) : null}
            </div>
          </div> : null}
        </header>

        {authNeeded ? (
          <div className="mb-4 rounded-lg border border-[#d7ddda] bg-white px-4 py-5 text-sm text-[#1c2526]">
            <div className="mb-2 font-semibold">需要登录后查看信息流。</div>
            <p className="mb-4 text-[#62706e]">这页现在通过 admin API 读取，不再暴露公开 JSON。登录后会回到当前信息流页面。</p>
            <Link href="/login?next=/ai-feed" className="inline-flex min-h-[38px] items-center rounded-lg border border-[#2f6f66] bg-[#2f6f66] px-3 py-2 text-sm text-white">
              去登录
            </Link>
          </div>
        ) : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className={`grid items-start gap-5 ${publicMode ? "" : "lg:grid-cols-[minmax(0,1fr)_320px]"}`}>
          <div className="grid gap-5">
            {!publicMode ? <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">钉住待看</h2>
              <div className="grid gap-3">
                {pinnedBlocks.length ? pinnedBlocks.map((block) => renderBlock(block)) : <div className="text-[15px] text-[#62706e]">还没有钉住的块。遇到想看但没时间看的内容，可以点星标。</div>}
              </div>
            </section> : null}

            <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">现在最值得看</h2>
              {topBlock ? renderBlock(topBlock) : <div className="text-[15px] text-[#62706e]">现在没有新的高优先级块。</div>}
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">今日信息流</h2>
              <div className="grid gap-3">
                {feedBlocks.length ? feedBlocks.map((block) => renderBlock(block)) : <div className="text-[15px] text-[#62706e]">今日信息流已经被你接收得差不多了。</div>}
              </div>
            </section>

            {!publicMode ? <section>
              <h2 className="mb-2 text-lg font-semibold tracking-normal">待处理</h2>
              <div className="grid gap-3">
                {actionBlocks.length ? actionBlocks.map((block) => renderBlock(block)) : <div className="text-[15px] text-[#62706e]">没有必须处理的行动项。</div>}
              </div>
            </section> : null}

            {!publicMode && showDiscarded ? (
              <section className="border-t border-[#d7ddda] pt-5">
                <h2 className="mb-2 text-lg font-semibold tracking-normal">本轮已丢弃</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {dismissedBlocks.length ? dismissedBlocks.map((block) => renderBlock(block, true)) : <div className="text-[15px] text-[#62706e]">本轮已丢弃列表为空；跨轮丢弃仍会通过指纹池隐藏。</div>}
                </div>
              </section>
            ) : null}
          </div>

          {!publicMode ? <aside className="grid min-h-0 gap-4 lg:sticky lg:top-5 lg:max-h-[calc(100vh-40px)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
            <div className="grid shrink-0 gap-4">
              <section className="rounded-lg border border-[#d7ddda] bg-white p-4 shadow-[0_14px_36px_rgba(41,50,48,0.10)]">
                <h2 className="mb-2 text-lg font-semibold tracking-normal">阅读状态</h2>
                <div className="text-sm text-[#62706e]">{handled} / {roundTotal} 个本轮已处理 · 剩余 {activeBlocks.length}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e1d7]">
                  <div className="h-full bg-gradient-to-r from-[#2f6f66] to-[#8b4b5a] transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#e4e0d8] bg-[#fffdfa] px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-[#1c2526]">工作待办</div>
                    <div className="mt-0.5 text-xs text-[#62706e]">{openTaskCount} 个未完成</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskComposerOpen(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2f6f66] bg-[#2f6f66] text-white"
                    aria-label="新增待办"
                    title="新增待办"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 border-t border-[#d7ddda] pt-3 text-[13px] leading-5 text-[#62706e]">
                  <div className="mb-1 font-semibold">状态同步</div>
                  <p className="m-0">
                    当前页会导入随 feed 同步来的共享状态快照，再用本浏览器状态继续记录新的丢弃/钉住。页头的 Gmail/OpenAI 文字是本轮采集状态，不代表网页连接失败。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#d7ddda] bg-white px-3 py-2 text-sm text-[#1c2526]"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新读取
                </button>
              </section>
              {renderCandidatePool()}
            </div>
            {renderTasks()}
          </aside> : null}
        </div>
      </div>

      <div
        className={`fixed bottom-5 left-1/2 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg bg-[#17211f] px-4 py-2 text-sm text-white transition-opacity ${
          toast ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {toast}
      </div>
      {!publicMode ? renderTaskComposer() : null}
      {!publicMode ? renderLinkedInImporter() : null}
    </main>
  )
}
