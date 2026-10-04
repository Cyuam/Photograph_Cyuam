import process from "node:process"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

// Load environment variables from .env and .env.local files
function loadEnvFile(filename: string) {
  try {
    const envPath = resolve(process.cwd(), filename)
    if (!existsSync(envPath)) {
      return
    }
    const envContent = readFileSync(envPath, "utf-8")
    const envLines = envContent.split("\n")
    for (const line of envLines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim()
        let value = trimmed.slice(eqIndex + 1).trim()
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        // Only set if not already set (so .env.local can override .env)
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
    console.log(`✅ Loaded environment from ${filename}`)
  } catch (error) {
    console.warn(`Could not load ${filename} file:`, error)
  }
}

// Load .env first, then .env.local (so .env.local overrides .env)
loadEnvFile(".env")
loadEnvFile(".env.local")

// Create supabase admin client after loading env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl) {
  console.error("[script] Missing NEXT_PUBLIC_SUPABASE_URL")
  process.exit(1)
}
if (!serviceKey) {
  console.warn("[script] Missing SUPABASE_SERVICE_ROLE_KEY, falling back to anon key. Writes may fail due to RLS.")
}

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceKey || anonKey || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

const usage = `
Usage:
  pnpm dlx tsx scripts/debug-translations.ts picture <pictureId> [--locale en|zh] [--title="..."] [--subtitle="..."] [--description="..."]
  pnpm dlx tsx scripts/debug-translations.ts set <setId> [--locale en|zh] [--title="..."] [--subtitle="..."] [--description="..."]

Examples:
  pnpm dlx tsx scripts/debug-translations.ts picture 42
  pnpm dlx tsx scripts/debug-translations.ts set 17 --locale en --title="Sunset" --description="Warm light"
`

type Locale = "en" | "zh"

type TranslationPayload = {
  title?: string
  subtitle?: string | null
  description?: string | null
}

const parseArgs = () => {
  const [, , entity, idRaw, ...rest] = process.argv
  if (!entity || !idRaw) {
    console.error("Missing entity or id.\n" + usage)
    process.exit(1)
  }
  const id = Number(idRaw)
  if (!Number.isFinite(id)) {
    console.error(`Invalid id: ${idRaw}`)
    process.exit(1)
  }
  let locale: Locale | undefined
  const updates: TranslationPayload = {}
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    if (!token.startsWith("--")) continue
    let key = token
    let value = ""
    const eqIndex = token.indexOf("=")
    if (eqIndex >= 0) {
      key = token.slice(0, eqIndex)
      value = token.slice(eqIndex + 1)
    } else if (i + 1 < rest.length && !rest[i + 1].startsWith("--")) {
      value = rest[i + 1]
      i++
    }
    switch (key) {
      case "--locale":
        if (value !== "en" && value !== "zh") {
          console.error("Locale must be en or zh")
          process.exit(1)
        }
        locale = value
        break
      case "--title":
        updates.title = value
        break
      case "--subtitle":
        updates.subtitle = value
        break
      case "--description":
        updates.description = value
        break
      default:
        console.warn(`Unknown option ${key}, ignoring`)
    }
  }
  return { entity, id, locale, updates }
}

const selectTranslation = async (entity: string, id: number, locale: Locale) => {
  const table = entity === "picture" ? "picture_translations" : "picture_set_translations"
  const filterColumn = entity === "picture" ? "picture_id" : "picture_set_id"
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("title,subtitle,description")
    .eq(filterColumn, id)
    .eq("locale", locale)
    .maybeSingle()
  if (error) throw error
  return data || { title: "", subtitle: "", description: "" }
}

const upsertTranslation = async (entity: string, id: number, locale: Locale, payload: TranslationPayload) => {
  const table = entity === "picture" ? "picture_translations" : "picture_set_translations"
  const idColumn = entity === "picture" ? "picture_id" : "picture_set_id"
  const upsertPayload: Record<string, any> = {
    [idColumn]: id,
    locale,
    title: payload.title ?? "",
    subtitle: payload.subtitle ?? null,
    description: payload.description ?? null,
  }
  const { error } = await supabaseAdmin.from(table).upsert(upsertPayload, {
    onConflict: `${idColumn},locale`,
  })
  if (error) throw error
}

const run = async () => {
  const { entity, id, locale, updates } = parseArgs()
  if (entity !== "picture" && entity !== "set") {
    console.error("Entity must be picture or set")
    process.exit(1)
  }

  const activeLocale: Locale = locale ?? "en"
  console.log(`Fetching ${entity} translation: id=${id}, locale=${activeLocale}`)
  const current = await selectTranslation(entity, id, activeLocale)
  console.log("Current translation:", current)

  const hasUpdates = Object.keys(updates).length > 0
  if (!hasUpdates) {
    console.log("No update payload provided. Pass --title/--subtitle/--description to write.")
    return
  }

  console.log("Applying updates:", updates)
  await upsertTranslation(entity, id, activeLocale, { ...current, ...updates })
  const refreshed = await selectTranslation(entity, id, activeLocale)
  console.log("Updated translation:", refreshed)
}

run()
  .catch((err) => {
    console.error("Debug translation script failed:", err)
    process.exit(1)
  })
