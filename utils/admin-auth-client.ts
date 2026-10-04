"use client"

import { supabase } from "@/utils/supabase"

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (error || !token) {
    throw new Error("Missing admin session")
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)

  return fetch(input, {
    ...init,
    headers,
  })
}
