import { NextResponse } from "next/server"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

const taskTypes = new Set(["ai", "work", "job", "paper", "project"])
const taskStatuses = new Set(["inbox", "next", "waiting", "done", "snoozed"])

type TaskRow = {
  id: string
  owner_email: string
  title: string
  type: string
  status: string
  due_at: string | null
  url: string | null
  note: string | null
  source_block_id: string | null
  source_title: string | null
  created_at: string
  updated_at: string
}

function normalizeTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    dueAt: row.due_at,
    url: row.url,
    note: row.note,
    sourceBlockId: row.source_block_id,
    sourceTitle: row.source_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function textValue(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength)
}

function nullableTextValue(value: unknown, maxLength: number) {
  const text = textValue(value, maxLength)
  return text || null
}

function typeValue(value: unknown) {
  const text = textValue(value, 24)
  return taskTypes.has(text) ? text : "ai"
}

function statusValue(value: unknown) {
  const text = textValue(value, 24)
  return taskStatuses.has(text) ? text : "inbox"
}

function dueAtValue(value: unknown) {
  const text = textValue(value, 64)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dbError(error: { message?: string } | null) {
  const message = error?.message || "AI task request failed"
  if (message.includes("ai_tasks") || message.includes("schema cache")) {
    return NextResponse.json({ error: "AI tasks table is not ready. Run docs/ai-tasks.sql in Supabase SQL Editor." }, { status: 400 })
  }
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const ownerEmail = String(auth.user.email || "").trim().toLowerCase()
  const { data, error } = await supabaseAdmin
    .from("ai_tasks")
    .select("id,owner_email,title,type,status,due_at,url,note,source_block_id,source_title,created_at,updated_at")
    .eq("owner_email", ownerEmail)
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(80)

  if (error) return dbError(error)
  return NextResponse.json({ tasks: (data || []).map((row) => normalizeTask(row as TaskRow)) })
}

export async function POST(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const title = textValue(body.title, 180)
  if (!title) {
    return NextResponse.json({ error: "Task title is required" }, { status: 400 })
  }

  const ownerEmail = String(auth.user.email || "").trim().toLowerCase()
  const { data, error } = await supabaseAdmin
    .from("ai_tasks")
    .insert({
      owner_email: ownerEmail,
      title,
      type: typeValue(body.type),
      status: statusValue(body.status),
      due_at: dueAtValue(body.dueAt),
      url: nullableTextValue(body.url, 1200),
      note: nullableTextValue(body.note, 1200),
      source_block_id: nullableTextValue(body.sourceBlockId, 160),
      source_title: nullableTextValue(body.sourceTitle, 240),
    })
    .select("id,owner_email,title,type,status,due_at,url,note,source_block_id,source_title,created_at,updated_at")
    .single()

  if (error) return dbError(error)
  return NextResponse.json({ task: normalizeTask(data as TaskRow) })
}

export async function PATCH(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const id = textValue(body.id, 80)
  if (!id) {
    return NextResponse.json({ error: "Task id is required" }, { status: 400 })
  }

  const updates: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }
  if ("title" in body) updates.title = textValue(body.title, 180)
  if ("type" in body) updates.type = typeValue(body.type)
  if ("status" in body) updates.status = statusValue(body.status)
  if ("dueAt" in body) updates.due_at = dueAtValue(body.dueAt)
  if ("url" in body) updates.url = nullableTextValue(body.url, 1200)
  if ("note" in body) updates.note = nullableTextValue(body.note, 1200)

  const ownerEmail = String(auth.user.email || "").trim().toLowerCase()
  const { data, error } = await supabaseAdmin
    .from("ai_tasks")
    .update(updates)
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .select("id,owner_email,title,type,status,due_at,url,note,source_block_id,source_title,created_at,updated_at")
    .single()

  if (error) return dbError(error)
  return NextResponse.json({ task: normalizeTask(data as TaskRow) })
}

export async function DELETE(request: Request) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const id = textValue(url.searchParams.get("id"), 80)
  if (!id) {
    return NextResponse.json({ error: "Task id is required" }, { status: 400 })
  }

  const ownerEmail = String(auth.user.email || "").trim().toLowerCase()
  const { error } = await supabaseAdmin.from("ai_tasks").delete().eq("id", id).eq("owner_email", ownerEmail)
  if (error) return dbError(error)
  return NextResponse.json({ ok: true })
}
