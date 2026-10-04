import { mkdir, appendFile, readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/utils/admin-auth.server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = "nodejs"

const recipientEmail = process.env.BOOKING_RECIPIENT_EMAIL || ""
const senderEmail = process.env.BOOKING_SENDER_EMAIL || "Photo Session <booking@cunyli.top>"
const bookingLogFile = path.join(process.cwd(), "logs", "photo-session-bookings.jsonl")

type BookingRecord = {
  id: string
  createdAt: string
  name: string
  contact: string
  date: string
  dateLabel: string
  packageName: string
  packagePrice: string
  packageNote: string
  timeWindow: string
  timeWindowNote: string
  people: string
  style: string
  note: string
  userAgent: string
}

type BookingLogEntry = BookingRecord & {
  status: "sent" | "logged"
  emailSent: boolean
  emailError?: string
}

function textValue(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength)
}

function linesFromBooking(body: Record<string, unknown>) {
  return [
    "新的约拍预约请求",
    "",
    `套餐：${textValue(body.packageName, 80)} / ${textValue(body.packagePrice, 40)} / ${textValue(body.packageNote, 80)}`,
    `日期：${textValue(body.date, 40)} ${textValue(body.dateLabel, 40)}`,
    `时间偏好：${textValue(body.timeWindow, 80)} / ${textValue(body.timeWindowNote, 120)}`,
    "",
    `称呼：${textValue(body.name, 80)}`,
    `联系方式：${textValue(body.contact, 160)}`,
    `人数：${textValue(body.people, 80) || "未填写"}`,
    `想拍什么：${textValue(body.style, 160) || "未填写"}`,
    "",
    "其他信息：",
    textValue(body.note, 1200) || "未填写",
  ]
}

function buildBookingRecord(body: Record<string, unknown>, request: Request): BookingRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: textValue(body.name, 80),
    contact: textValue(body.contact, 160),
    date: textValue(body.date, 40),
    dateLabel: textValue(body.dateLabel, 40),
    packageName: textValue(body.packageName, 80),
    packagePrice: textValue(body.packagePrice, 40),
    packageNote: textValue(body.packageNote, 80),
    timeWindow: textValue(body.timeWindow, 80),
    timeWindowNote: textValue(body.timeWindowNote, 120),
    people: textValue(body.people, 80),
    style: textValue(body.style, 160),
    note: textValue(body.note, 1200),
    userAgent: textValue(request.headers.get("user-agent"), 240),
  }
}

async function appendLocalBookingLog(entry: BookingLogEntry) {
  await mkdir(path.dirname(bookingLogFile), { recursive: true })
  await appendFile(bookingLogFile, `${JSON.stringify(entry)}\n`, "utf8")
}

async function insertSupabaseBookingLog(entry: BookingLogEntry) {
  const { error } = await supabaseAdmin.from("photo_session_bookings").insert({
    id: entry.id,
    created_at: entry.createdAt,
    name: entry.name,
    contact: entry.contact,
    date: entry.date,
    package_name: entry.packageName,
    package_price: entry.packagePrice,
    time_window: entry.timeWindow,
    status: entry.status,
    email_sent: entry.emailSent,
    email_error: entry.emailError || null,
    payload: entry,
    user_agent: entry.userAgent || null,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function persistBookingLog(entry: BookingLogEntry) {
  const errors: string[] = []

  try {
    await insertSupabaseBookingLog(entry)
    return { persisted: true, source: "supabase", errors }
  } catch (error) {
    errors.push(`supabase: ${(error as Error).message}`)
  }

  try {
    await appendLocalBookingLog(entry)
    return { persisted: true, source: "local", errors }
  } catch (error) {
    errors.push(`local: ${(error as Error).message}`)
  }

  return { persisted: false, source: "none", errors }
}

async function readLocalBookingLogs(limit: number) {
  const content = await readFile(bookingLogFile, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return ""
    throw error
  })

  const entries: BookingLogEntry[] = []
  for (const line of content.split(/\r?\n/).filter(Boolean).reverse()) {
    try {
      entries.push(JSON.parse(line) as BookingLogEntry)
    } catch (error) {
      console.warn("[photo-session-booking] skipped invalid local log line", error)
    }
    if (entries.length >= limit) break
  }
  return entries
}

async function readSupabaseBookingLogs(limit: number) {
  const { data, error } = await supabaseAdmin
    .from("photo_session_bookings")
    .select("id,created_at,name,contact,date,package_name,package_price,time_window,status,email_sent,email_error,payload")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row: any) => ({
    ...(row.payload || {}),
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    contact: row.contact,
    date: row.date,
    packageName: row.package_name,
    packagePrice: row.package_price,
    timeWindow: row.time_window,
    status: row.status,
    emailSent: !!row.email_sent,
    emailError: row.email_error || undefined,
  })) as BookingLogEntry[]
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 40, 1), 100)

  try {
    const items = await readSupabaseBookingLogs(limit)
    return NextResponse.json({ items, source: "supabase" })
  } catch (error) {
    console.warn("[photo-session-booking] supabase log read failed, using local log", error)
  }

  const items = await readLocalBookingLogs(limit)
  return NextResponse.json({ items, source: "local" })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid booking request" }, { status: 400 })
  }

  const record = buildBookingRecord(body as Record<string, unknown>, request)
  if (!record.name || !record.contact || !record.date) {
    return NextResponse.json({ error: "Name, contact and date are required" }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  let emailSent = false
  let emailError: string | undefined

  if (!apiKey) {
    emailError = "RESEND_API_KEY is not configured"
  } else if (!recipientEmail) {
    emailError = "BOOKING_RECIPIENT_EMAIL is not configured"
  } else {
    const content = linesFromBooking(body as Record<string, unknown>).join("\n")
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderEmail,
        to: recipientEmail,
        subject: `约拍预约：${record.name} / ${record.date}`,
        text: content,
      }),
    })

    if (response.ok) {
      emailSent = true
    } else {
      emailError = (await response.text()) || "Booking email failed"
    }
  }

  const entry: BookingLogEntry = {
    ...record,
    status: emailSent ? "sent" : "logged",
    emailSent,
    emailError,
  }
  const logResult = await persistBookingLog(entry)

  if (!emailSent && !logResult.persisted) {
    return NextResponse.json(
      { error: emailError || "Booking could not be sent or logged", logErrors: logResult.errors },
      { status: apiKey ? 502 : 503 },
    )
  }

  return NextResponse.json({
    ok: true,
    bookingId: record.id,
    emailSent,
    logSource: logResult.source,
    message: emailSent
      ? "预约信息已发送。"
      : "预约信息已记录；邮件暂时没有发送成功，我会从后台日志处理。",
  })
}
