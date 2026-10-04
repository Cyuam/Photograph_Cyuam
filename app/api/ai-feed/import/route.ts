import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { buildLinkedInImportBlock, mergeFeedWithPrivateImports, type FeedPayload } from "@/lib/ai-feed-linkedin-import"
import { intelFeedDbError, persistIntelFeedItem } from "@/lib/intel-feed-items.server"
import { requireAdminRequest } from "@/utils/admin-auth.server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const feedDir = join(process.cwd(), "data", "ai-intel-feed")
const feedPath = join(feedDir, "feed-input.json")

type NodeError = Error & { code?: string }

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && (error as NodeError).code === "ENOENT"
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T
  } catch (error) {
    if (isNotFound(error)) return fallback
    throw error
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
  }

  const item = isRecord(payload) && "item" in payload ? payload.item : payload
  const replaceExisting = isRecord(payload) && Boolean(payload.replaceExisting)
  let block
  try {
    block = buildLinkedInImportBlock(item)
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 })
  }

  const ownerEmail = String(auth.user.email || "").trim().toLowerCase()
  const [feed, persisted] = await Promise.all([
    readJsonFile<FeedPayload>(feedPath, { date: "", blocks: [] }),
    persistIntelFeedItem(ownerEmail, block, replaceExisting),
  ])
  if (persisted.error || !persisted.result) return intelFeedDbError(persisted.error)

  const nextFeed = mergeFeedWithPrivateImports(feed, persisted.result.imports)

  return NextResponse.json({
    block: persisted.result.block,
    feed: nextFeed,
    inserted: persisted.result.inserted,
    replaced: persisted.result.replaced,
    persisted: true,
    storage: "supabase:intel_feed.items",
  })
}
