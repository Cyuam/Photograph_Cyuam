import { supabaseAdmin } from "@/utils/supabaseAdmin"

const parseAdminEmails = () =>
  String(process.env.ADMIN_EMAILS || process.env.SUPABASE_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

export async function requireAdminRequest(request: Request): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>["data"]["user"]> }
  | { ok: false; status: number; error: string }
> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
  const match = authHeader?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token) {
    return { ok: false, status: 401, error: "Missing admin authorization token" }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, status: 401, error: "Invalid or expired admin session" }
  }

  const adminEmails = parseAdminEmails()
  if (adminEmails.length === 0) {
    return { ok: false, status: 500, error: "Admin access is not configured" }
  }

  const email = String(data.user.email || "").trim().toLowerCase()
  if (!email || !adminEmails.includes(email)) {
    return { ok: false, status: 403, error: "Admin access denied" }
  }

  return { ok: true, user: data.user }
}
