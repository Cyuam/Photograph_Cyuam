import { NextResponse } from "next/server"
import { mergeBlockList, normalizePrivateImports, type FeedBlock, type PrivateImportPayload } from "@/lib/ai-feed-linkedin-import"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

const feedSchema = "intel_feed"
const itemsTable = "items"
const sourcesTable = "sources"
const linkedinSourceId = "linkedin"
const readItemsRpc = "intel_feed_read_items"
const upsertItemRpc = "intel_feed_upsert_item"

type SupabaseError = {
  message?: string
}

type IntelFeedItemRow = {
  id: string
  owner_email: string
  source_id: string
  source_type: string
  canonical_url: string
  external_id: string | null
  title: string
  status: string
  tags: string[]
  block: FeedBlock
  raw: Record<string, unknown>
  created_at: string
  updated_at: string
}

type IntelFeedItemRpcRow = IntelFeedItemRow & {
  inserted: boolean
  replaced: boolean
}

export type IntelFeedPersistenceResult = {
  imports: PrivateImportPayload
  block: FeedBlock
  inserted: boolean
  replaced: boolean
}

function textValue(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength)
}

function dbErrorMessage(error: SupabaseError | null, fallback = "Intel feed request failed") {
  return error?.message || fallback
}

export function intelFeedDbError(error: SupabaseError | null) {
  const message = dbErrorMessage(error)
  if (isIntelFeedStorageMissing(error)) {
    return NextResponse.json({ error: "Intel feed storage is not ready. Apply the Supabase migration in /Users/lilijie/supabase/migrations." }, { status: 400 })
  }
  return NextResponse.json({ error: message }, { status: 400 })
}

export function isIntelFeedStorageMissing(error: SupabaseError | null) {
  const message = dbErrorMessage(error, "")
  return message.includes(feedSchema) || message.includes(itemsTable) || message.includes(sourcesTable) || message.includes(readItemsRpc) || message.includes(upsertItemRpc) || message.includes("schema cache")
}

function normalizeOwnerEmail(email: unknown) {
  return String(email || "").trim().toLowerCase()
}

function sourceTypeForBlock(block: FeedBlock) {
  return block.kind === "action" ? "linkedin_job" : "linkedin_post"
}

function primaryCanonicalUrl(block: FeedBlock) {
  return textValue(block.links?.[0]?.url, 1200)
}

function externalIdForBlock(block: FeedBlock) {
  const canonicalUrl = primaryCanonicalUrl(block)
  const jobMatch = canonicalUrl.match(/\/jobs\/view\/(\d+)/)
  if (jobMatch) return jobMatch[1]

  const activityMatch = canonicalUrl.match(/\/feed\/update\/activity:([0-9]+)/)
  if (activityMatch) return activityMatch[1]

  const postMatch = canonicalUrl.match(/\/posts\/([^/?#]+)/)
  if (postMatch) return postMatch[1]

  return textValue(block.id, 180) || null
}

function normalizeRow(row: IntelFeedItemRow): FeedBlock {
  return row.block
}

export async function readIntelFeedItems(ownerEmail: string): Promise<{ imports: PrivateImportPayload; error: SupabaseError | null }> {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail)
  if (!normalizedEmail) return { imports: { version: 1, blocks: [] }, error: null }

  const { data, error } = await supabaseAdmin.rpc(readItemsRpc, {
    p_owner_email: normalizedEmail,
    p_limit: 120,
  })

  if (error) return { imports: { version: 1, blocks: [] }, error }
  return {
    imports: normalizePrivateImports({
      version: 1,
      updatedAt: (data?.[0] as IntelFeedItemRow | undefined)?.updated_at,
      blocks: ((data || []) as IntelFeedItemRow[]).map(normalizeRow),
    }),
    error: null,
  }
}

export async function persistIntelFeedItem(ownerEmail: string, block: FeedBlock, replaceExisting: boolean): Promise<{ result: IntelFeedPersistenceResult | null; error: SupabaseError | null }> {
  const normalizedEmail = normalizeOwnerEmail(ownerEmail)
  const blockId = textValue(block.id, 180)
  const canonicalUrl = primaryCanonicalUrl(block)

  if (!normalizedEmail) return { result: null, error: { message: "Missing owner email." } }
  if (!blockId) return { result: null, error: { message: "Generated import block is missing an id." } }
  if (!canonicalUrl) return { result: null, error: { message: "Generated import block is missing a canonical URL." } }

  const { data, error } = await supabaseAdmin.rpc(upsertItemRpc, {
    p_owner_email: normalizedEmail,
    p_id: blockId,
    p_source_id: linkedinSourceId,
    p_source_type: sourceTypeForBlock(block),
    p_canonical_url: canonicalUrl,
    p_external_id: externalIdForBlock(block),
    p_title: textValue(block.title, 300),
    p_status: "inbox",
    p_tags: ["linkedin"],
    p_block: block,
    p_raw: {
      adapter: "private_ai_feed_import",
      canonical_url: canonicalUrl,
      source_block_id: block.id,
    },
    p_replace_existing: replaceExisting,
  }).single()

  if (error) return { result: null, error }

  const imports = await readIntelFeedItems(normalizedEmail)
  if (imports.error) return { result: null, error: imports.error }
  const row = data as IntelFeedItemRpcRow
  const merged = mergeBlockList(imports.imports.blocks, row.block, true)

  return {
    result: {
      imports: { ...imports.imports, blocks: merged.blocks },
      block: row.block,
      inserted: row.inserted,
      replaced: row.replaced,
    },
    error: null,
  }
}
