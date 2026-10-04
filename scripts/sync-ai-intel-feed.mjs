import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(
  process.env.AI_INTEL_FEED_SOURCE || `${process.env.HOME}/Projects/ai-intel-feed/feed-input.json`,
)
const target = resolve(repoRoot, "data/ai-intel-feed/feed-input.json")
const stateSource = resolve(
  process.env.AI_INTEL_FEED_STATE_SOURCE || `${process.env.HOME}/Projects/ai-intel-feed/shared-state.json`,
)
const stateTarget = resolve(repoRoot, "data/ai-intel-feed/shared-state.json")
const syncState = process.env.AI_INTEL_FEED_SYNC_STATE === "1"

const sourceStat = statSync(source)
if (!sourceStat.isFile()) {
  throw new Error(`AI feed source is not a file: ${source}`)
}

mkdirSync(dirname(target), { recursive: true })
const feedJson = JSON.parse(readFileSync(source, "utf8"))
if (!Array.isArray(feedJson.blocks)) {
  throw new Error(`AI feed source must contain a blocks array: ${source}`)
}
writeFileSync(target, `${JSON.stringify(feedJson, null, 2)}\n`)

if (syncState && existsSync(stateSource)) {
  const stateStat = statSync(stateSource)
  if (!stateStat.isFile()) {
    throw new Error(`AI feed state source is not a file: ${stateSource}`)
  }
  const stateJson = JSON.parse(readFileSync(stateSource, "utf8"))
  const sharedState = {
    state: stateJson.state || {},
    exposurePool: stateJson.exposurePool || {},
    pinned: stateJson.pinned || {},
  }
  writeFileSync(stateTarget, `${JSON.stringify(sharedState, null, 2)}\n`)
  console.log(`Synced AI feed shared state to ${stateTarget}`)
} else {
  writeFileSync(stateTarget, `${JSON.stringify({ state: {}, exposurePool: {}, pinned: {} }, null, 2)}\n`)
  console.log(`Reset AI feed shared state at ${stateTarget}; online browser localStorage is the source of reading state`)
}

console.log(`Synced AI feed JSON to ${target}`)
