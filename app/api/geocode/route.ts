import { NextRequest, NextResponse } from "next/server"

// Simple geocoding proxy using OpenStreetMap Nominatim.
// For production/heavy use, switch to a paid provider (Mapbox/Google) and respect rate limits.

export async function POST(req: NextRequest) {
  try {
    const { q, limit = 5 } = await req.json()
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    const params = new URLSearchParams({
      format: 'jsonv2',
      q: q.trim(),
      limit: String(Math.max(1, Math.min(Number(limit) || 5, 10))),
      addressdetails: '1',
    })
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        // Identify application per Nominatim usage policy
        'User-Agent': 'PrivatePortfolio/1.0 (+https://example.com)'
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: 'Geocoding failed', details: text }, { status: 502 })
    }
    const data = await res.json()
    const items = Array.isArray(data) ? data : []
    const results = items.map((it: any) => ({
      display_name: it.display_name,
      name: it.name || it.display_name,
      lat: it.lat ? Number(it.lat) : null,
      lon: it.lon ? Number(it.lon) : null,
    })).filter((r: any) => typeof r.lat === 'number' && typeof r.lon === 'number')

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

