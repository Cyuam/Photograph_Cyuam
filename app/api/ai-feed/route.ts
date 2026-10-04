import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { mergeFeedWithPrivateImports, normalizePrivateImports } from "@/lib/ai-feed-linkedin-import"
import { intelFeedDbError, isIntelFeedStorageMissing, readIntelFeedItems } from "@/lib/intel-feed-items.server"
import { requireAdminRequest } from "@/utils/admin-auth.server"

const feedDir = join(process.cwd(), "data", "ai-intel-feed")

type NodeError = Error & { code?: string }

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && (error as NodeError).code === "ENOENT"
}

async function readJsonFile(path: string, fallback: unknown) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (isNotFound(error)) return fallback
    throw error
  }
}

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const ownerEmail = String(auth.user.email || "").trim().toLowerCase()
  const [feed, sharedState, privateImports] = await Promise.all([
    readJsonFile(join(feedDir, "feed-input.json"), { date: "", blocks: [] }),
    readJsonFile(join(feedDir, "shared-state.json"), { state: {}, exposurePool: {}, pinned: {} }),
    readIntelFeedItems(ownerEmail),
  ])
  if (privateImports.error && !isIntelFeedStorageMissing(privateImports.error)) {
    return intelFeedDbError(privateImports.error)
  }

  return NextResponse.json({
    feed: mergeFeedWithPrivateImports(feed, normalizePrivateImports(privateImports.imports)),
    sharedState,
    privateImports: {
      count: privateImports.imports.blocks.length,
      storage: "supabase:intel_feed.items",
      ready: !privateImports.error,
      error: privateImports.error?.message,
    },
  })
}
