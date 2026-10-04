import { NextRequest, NextResponse } from "next/server"
import { deleteObjectKeysFromR2 } from "@/utils/r2-assets.server"
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { objectKey } = await req.json()
    if (!objectKey) return NextResponse.json({ error: "Missing objectKey" }, { status: 400 })

    const result = await deleteObjectKeysFromR2([objectKey])
    if (result.errors.length) {
      return NextResponse.json({ error: result.errors[0]?.message || "Delete failed" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, deleted: result.deleted })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
