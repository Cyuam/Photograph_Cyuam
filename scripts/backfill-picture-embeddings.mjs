import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import process from "node:process"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"

const usage = `
Usage:
  pnpm backfill:picture-embeddings [--limit 50 | --all | --ids 1,2,3] [--force] [--dry-run] [--batch-size 8]

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  IMAGE_EMBEDDING_API_URL
  IMAGE_EMBEDDING_SSH_HOST optional, for example triton
  IMAGE_EMBEDDING_API_KEY optional
  HF_IMAGE_EMBEDDING_API_URL optional fallback Hugging Face image embedding endpoint
  HF_IMAGE_EMBEDDING_API_KEY optional, falls back to HF_TOKEN
  JINA_API_KEY optional fallback Jina Embeddings API key
  JINA_EMBEDDING_MODEL optional, default jina-embeddings-v5-omni-small
  JINA_EMBEDDING_DIMENSIONS optional, default 1024
  IMAGE_EMBEDDING_MODEL optional, default sentence-transformers/clip-ViT-B-32

The embedding endpoint receives:
  { imageUrl, text, picture }

It must return:
  { embedding: number[], model?: string }

The optional batch endpoint receives:
  { items: [{ imageUrl, text, picture }] }

It must return:
  { results: [{ embedding: number[], model?: string }] }
`

const loadEnvFile = (filename) => {
  const envPath = resolve(process.cwd(), filename)
  if (!existsSync(envPath)) {
    return
  }

  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  let limit = 50
  let all = false
  let force = false
  let dryRun = false
  let ids = []
  let batchSize = Number(process.env.PICTURE_EMBEDDING_BATCH_SIZE || 1)

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--help" || arg === "-h") {
      console.log(usage)
      process.exit(0)
    }
    if (arg === "--force") {
      force = true
      continue
    }
    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--batch-size") {
      const rawBatchSize = args[index + 1]
      index++
      batchSize = Number(rawBatchSize)
      if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error(`Invalid --batch-size value: ${rawBatchSize}`)
      }
      continue
    }
    if (arg.startsWith("--batch-size=")) {
      const rawBatchSize = arg.slice("--batch-size=".length)
      batchSize = Number(rawBatchSize)
      if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error(`Invalid --batch-size value: ${rawBatchSize}`)
      }
      continue
    }
    if (arg === "--all") {
      all = true
      continue
    }
    if (arg === "--ids") {
      const rawIds = args[index + 1]
      index++
      ids = parseIds(rawIds)
      continue
    }
    if (arg.startsWith("--ids=")) {
      ids = parseIds(arg.slice("--ids=".length))
      continue
    }
    if (arg === "--limit") {
      const rawLimit = args[index + 1]
      index++
      limit = Number(rawLimit)
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Invalid --limit value: ${rawLimit}`)
      }
      continue
    }
    if (arg.startsWith("--limit=")) {
      const rawLimit = arg.slice("--limit=".length)
      limit = Number(rawLimit)
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Invalid --limit value: ${rawLimit}`)
      }
      continue
    }

    throw new Error(`Unknown argument: ${arg}\n${usage}`)
  }

  return { all, batchSize, dryRun, force, ids, limit }
}

const parseIds = (rawIds) => {
  const ids = String(rawIds || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
  if (!ids.length) {
    throw new Error(`Invalid --ids value: ${rawIds}`)
  }
  return Array.from(new Set(ids))
}

const resolveImageUrl = (imagePath) => {
  if (!imagePath) {
    return null
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath
  }

  const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL
  if (!bucketUrl) {
    throw new Error("Missing NEXT_PUBLIC_BUCKET_URL for relative image paths")
  }

  return `${bucketUrl.replace(/\/$/, "")}/${String(imagePath).replace(/^\//, "")}`
}

const getPreferredImageVariantKeys = () =>
  (process.env.PICTURE_EMBEDDING_IMAGE_VARIANTS || "1280,1024,768,640,medium,small,thumbnail,original")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

const chooseImagePath = (picture) => {
  const variants = picture.image_variants || {}
  for (const key of getPreferredImageVariantKeys()) {
    if (variants[key]) {
      return variants[key]
    }
  }

  const numericVariant = Object.keys(variants)
    .filter((key) => key !== "original" && Number.isFinite(Number(key)))
    .sort((left, right) => Number(left) - Number(right))
    .find((key) => variants[key])
  if (numericVariant) {
    return variants[numericVariant]
  }

  return variants.original || picture.raw_image_url || picture.image_url
}

const buildEmbeddingText = (picture) =>
  [
    picture.title,
    picture.subtitle,
    picture.description,
    picture.search_text,
  ]
    .filter(Boolean)
    .join("\n")

const buildContentHash = (picture) =>
  createHash("sha256")
    .update(JSON.stringify({
      image_url: picture.image_url,
      raw_image_url: picture.raw_image_url,
      image_variants: picture.image_variants,
      text: buildEmbeddingText(picture),
    }))
    .digest("hex")

const formatVector = (embedding) => {
  const expectedDimensions = getEmbeddingDimensions()
  if (embedding.length !== expectedDimensions) {
    throw new Error(`Expected a ${expectedDimensions}-dimensional embedding, got ${embedding.length}`)
  }
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite value")
  }
  return `[${embedding.join(",")}]`
}

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\"'\"'")}'`

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const chunkArray = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const DEFAULT_JINA_MODEL = "jina-embeddings-v5-omni-small"
const JINA_EMBEDDING_ENDPOINT = "https://api.jina.ai/v1/embeddings"

const getEmbeddingDimensions = () => Number(process.env.JINA_EMBEDDING_DIMENSIONS || 1024)

const getJinaModel = () => process.env.JINA_EMBEDDING_MODEL || DEFAULT_JINA_MODEL

const getJinaDataUrlMaxSide = () => Number(process.env.JINA_IMAGE_DATA_URL_MAX_SIDE || 640)

const getJinaDataUrlMaxBytes = () => Number(process.env.JINA_IMAGE_DATA_URL_MAX_BYTES || 4_900_000)

const getProviderOrder = () =>
  (process.env.PICTURE_EMBEDDING_PROVIDER_ORDER || "primary,hf,jina")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

const getExpectedEmbeddingModel = () =>
  process.env.PICTURE_EMBEDDING_MODEL ||
  process.env.IMAGE_EMBEDDING_MODEL ||
  process.env.HF_IMAGE_EMBEDDING_MODEL ||
  (process.env.IMAGE_EMBEDDING_API_URL ? getJinaModel() : null) ||
  (process.env.JINA_API_KEY ? getJinaModel() : "sentence-transformers/clip-ViT-B-32")

const isNonRetriableEmbeddingError = (error) => {
  const message = error?.message || String(error)
  return (
    message.includes("jina failed: 400") ||
    message.includes("Failed to load image from")
  )
}

const embedPictureWithRetry = async (picture, attempts = 3) => {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await embedPicture(picture)
    } catch (error) {
      lastError = error
      if (isNonRetriableEmbeddingError(error)) {
        break
      }
      if (attempt < attempts) {
        console.warn(`[retry] picture ${picture.id}: attempt ${attempt} failed, retrying`)
        await wait(1000 * attempt)
      }
    }
  }
  throw lastError
}

const buildEmbeddingRequestPayload = (picture) => {
  const imageUrl = resolveImageUrl(chooseImagePath(picture))
  if (!imageUrl) {
    throw new Error(`No image URL available for picture ${picture.id}`)
  }

  return {
    imageUrl,
    text: buildEmbeddingText(picture),
    picture,
  }
}

const getPrimaryHealthUrl = (endpoint) => {
  if (process.env.IMAGE_EMBEDDING_HEALTH_URL) {
    return process.env.IMAGE_EMBEDDING_HEALTH_URL
  }
  try {
    const url = new URL(endpoint)
    url.pathname = "/health"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return ""
  }
}

const isPrimaryEmbeddingEndpointAvailable = async (endpoint) => {
  if (process.env.IMAGE_EMBEDDING_SSH_HOST) {
    return true
  }

  const healthUrl = getPrimaryHealthUrl(endpoint)
  if (!healthUrl) {
    return true
  }

  try {
    const response = await fetch(healthUrl, { cache: "no-store" })
    return response.ok
  } catch {
    return false
  }
}

const getSshArgs = (remoteCommand) => {
  const args = []
  if (process.env.IMAGE_EMBEDDING_SSH_MULTIPLEX !== "0") {
    args.push(
      "-o",
      "ControlMaster=auto",
      "-o",
      "ControlPersist=10m",
      "-o",
      `ControlPath=${process.env.IMAGE_EMBEDDING_SSH_CONTROL_PATH || "/tmp/picture-embedding-%r@%h:%p"}`,
    )
  }
  args.push(process.env.IMAGE_EMBEDDING_SSH_HOST, remoteCommand)
  return args
}

const embedViaSsh = (endpoint, requestPayload) => {
  const encodedPayload = Buffer.from(JSON.stringify(requestPayload), "utf8").toString("base64")
  const code = [
    "import base64, json, sys, urllib.request",
    "endpoint = sys.argv[1]",
    "payload = base64.b64decode(sys.argv[2])",
    "request = urllib.request.Request(endpoint, data=payload, headers={'content-type': 'application/json'}, method='POST')",
    "with urllib.request.urlopen(request, timeout=900) as response:",
    "    sys.stdout.write(response.read().decode('utf-8'))",
  ].join("\n")
  const remoteCommand = [
    "python3",
    "-c",
    shellQuote(code),
    shellQuote(endpoint),
    shellQuote(encodedPayload),
  ].join(" ")
  const output = execFileSync("ssh", getSshArgs(remoteCommand), {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(output)
}

const getBatchEndpoint = (endpoint) => {
  if (process.env.IMAGE_EMBEDDING_BATCH_API_URL) {
    return process.env.IMAGE_EMBEDDING_BATCH_API_URL
  }
  try {
    const url = new URL(endpoint)
    if (url.pathname.endsWith("/embed-image")) {
      url.pathname = url.pathname.replace(/\/embed-image$/, "/embed-images")
      return url.toString()
    }
  } catch {
    // Fall through to a string replacement for non-standard endpoint values.
  }
  return endpoint.replace(/\/embed-image$/, "/embed-images")
}

const embedWithEndpoint = async (endpoint, requestPayload, { apiKey, provider, useSsh = false }) => {
  if (useSsh) {
    const payload = embedViaSsh(endpoint, requestPayload)
    if (!Array.isArray(payload.embedding)) {
      throw new Error(`${provider} returned no embedding`)
    }
    return { ...payload, provider }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey
        ? { authorization: `Bearer ${apiKey}` }
        : {}),
    },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    throw new Error(`${provider} failed: ${response.status} ${await response.text()}`)
  }

  const responsePayload = await response.json()
  if (!Array.isArray(responsePayload.embedding)) {
    throw new Error(`${provider} returned no embedding`)
  }
  return { ...responsePayload, provider }
}

const embedBatchWithEndpoint = async (endpoint, requestPayload, { apiKey, provider, useSsh = false }) => {
  if (useSsh) {
    const payload = embedViaSsh(endpoint, requestPayload)
    if (!Array.isArray(payload.results)) {
      throw new Error(`${provider} returned no batch results`)
    }
    return { ...payload, provider }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey
        ? { authorization: `Bearer ${apiKey}` }
        : {}),
    },
    body: JSON.stringify(requestPayload),
  })

  if (!response.ok) {
    throw new Error(`${provider} batch failed: ${response.status} ${await response.text()}`)
  }

  const responsePayload = await response.json()
  if (!Array.isArray(responsePayload.results)) {
    throw new Error(`${provider} returned no batch results`)
  }
  return { ...responsePayload, provider }
}

const embedWithPrimaryEndpoint = async (requestPayload) => {
  const endpoint = process.env.IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL")
  }
  if (!(await isPrimaryEmbeddingEndpointAvailable(endpoint))) {
    throw new Error("Primary image embedding endpoint is not available")
  }
  return embedWithEndpoint(endpoint, requestPayload, {
    apiKey: process.env.IMAGE_EMBEDDING_API_KEY,
    provider: process.env.IMAGE_EMBEDDING_PROVIDER || "primary",
    useSsh: Boolean(process.env.IMAGE_EMBEDDING_SSH_HOST),
  })
}

const embedBatchWithPrimaryEndpoint = async (requestPayload) => {
  const endpoint = process.env.IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL")
  }
  if (!(await isPrimaryEmbeddingEndpointAvailable(endpoint))) {
    throw new Error("Primary image embedding endpoint is not available")
  }
  return embedBatchWithEndpoint(getBatchEndpoint(endpoint), requestPayload, {
    apiKey: process.env.IMAGE_EMBEDDING_API_KEY,
    provider: process.env.IMAGE_EMBEDDING_PROVIDER || "primary",
    useSsh: Boolean(process.env.IMAGE_EMBEDDING_SSH_HOST),
  })
}

const embedWithHfImageEndpoint = async (requestPayload) => {
  const endpoint = process.env.HF_IMAGE_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing HF_IMAGE_EMBEDDING_API_URL")
  }
  return embedWithEndpoint(endpoint, requestPayload, {
    apiKey: process.env.HF_IMAGE_EMBEDDING_API_KEY || process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN,
    provider: "hf-image-endpoint",
  })
}

const parseJinaEmbedding = (payload) => {
  const embedding = payload?.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    throw new Error("Jina embedding response did not include an embedding")
  }
  const values = embedding.map((value) => Number(value))
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Jina embedding response included non-numeric values")
  }
  return values
}

const requestJinaEmbedding = async (imageInput) => {
  const token = process.env.JINA_API_KEY
  if (!token) {
    throw new Error("Missing JINA_API_KEY")
  }

  const body = {
    model: getJinaModel(),
    dimensions: getEmbeddingDimensions(),
    normalized: true,
    embedding_type: "float",
    input: [{ image: imageInput }],
  }
  if (process.env.JINA_IMAGE_EMBEDDING_TASK) {
    body.task = process.env.JINA_IMAGE_EMBEDDING_TASK
  }

  const response = await fetch(JINA_EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`jina failed: ${response.status} ${await response.text()}`)
  }

  return {
    embedding: parseJinaEmbedding(await response.json()),
    model: getJinaModel(),
    provider: "jina",
  }
}

const buildJinaImageDataUrl = async (imageUrl) => {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image for Jina data URL fallback: ${response.status} ${await response.text()}`)
  }

  const input = Buffer.from(await response.arrayBuffer())
  const output = await sharp(input)
    .rotate()
    .resize({
      width: getJinaDataUrlMaxSide(),
      height: getJinaDataUrlMaxSide(),
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: Number(process.env.JINA_IMAGE_DATA_URL_WEBP_QUALITY || 82) })
    .toBuffer()

  if (output.length > getJinaDataUrlMaxBytes()) {
    throw new Error(`Jina data URL fallback image is too large after resize: ${output.length} bytes`)
  }

  return `data:image/webp;base64,${output.toString("base64")}`
}

const isJinaImageLoadError = (error) => {
  const message = error?.message || String(error)
  return message.includes("Failed to load image from") || message.includes("Image too large")
}

const embedWithJina = async (requestPayload) => {
  try {
    return await requestJinaEmbedding(requestPayload.imageUrl)
  } catch (error) {
    if (process.env.JINA_IMAGE_DATA_URL_FALLBACK === "0" || !isJinaImageLoadError(error)) {
      throw error
    }
    return requestJinaEmbedding(await buildJinaImageDataUrl(requestPayload.imageUrl))
  }
}

const embedPicture = async (picture) => {
  const requestPayload = buildEmbeddingRequestPayload(picture)
  const errors = []

  for (const provider of getProviderOrder()) {
    if (provider === "primary" && process.env.IMAGE_EMBEDDING_API_URL) {
      try {
        return await embedWithPrimaryEndpoint(requestPayload)
      } catch (error) {
        errors.push(`primary: ${error.message}`)
      }
    }

    if ((provider === "hf" || provider === "hf-image-endpoint") && process.env.HF_IMAGE_EMBEDDING_API_URL) {
      try {
        return await embedWithHfImageEndpoint(requestPayload)
      } catch (error) {
        errors.push(`hf-image-endpoint: ${error.message}`)
      }
    }

    if (provider === "jina" && process.env.JINA_API_KEY) {
      try {
        return await embedWithJina(requestPayload)
      } catch (error) {
        errors.push(`jina: ${error.message}`)
      }
    }
  }

  if (!errors.length) {
    throw new Error("Missing IMAGE_EMBEDDING_API_URL, HF_IMAGE_EMBEDDING_API_URL, or JINA_API_KEY. Run with --dry-run to inspect candidates without embedding.")
  }

  throw new Error(`All image embedding providers failed (${errors.join("; ")})`)
}

const embedPictureBatchWithRetry = async (pictures, attempts = 3) => {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await embedPictureBatch(pictures)
    } catch (error) {
      lastError = error
      if (isNonRetriableEmbeddingError(error)) {
        break
      }
      if (attempt < attempts) {
        console.warn(`[retry-batch] pictures ${pictures.map((picture) => picture.id).join(",")}: attempt ${attempt} failed, retrying`)
        await wait(1000 * attempt)
      }
    }
  }
  throw lastError
}

const embedPictureBatchAdaptive = async (pictures) => {
  try {
    return await embedPictureBatchWithRetry(pictures, pictures.length > 1 ? 1 : 3)
  } catch (error) {
    if (pictures.length === 1) {
      throw error
    }
    const midpoint = Math.ceil(pictures.length / 2)
    console.warn(`[split-batch] pictures ${pictures.map((picture) => picture.id).join(",")}: ${error.message}`)
    const left = await embedPictureBatchAdaptive(pictures.slice(0, midpoint))
    const right = await embedPictureBatchAdaptive(pictures.slice(midpoint))
    return [...left, ...right]
  }
}

const embedPictureBatch = async (pictures) => {
  if (!pictures.length) {
    return []
  }
  if (pictures.length === 1 || !process.env.IMAGE_EMBEDDING_API_URL) {
    return Promise.all(pictures.map((picture) => embedPictureWithRetry(picture)))
  }

  const requestPayload = {
    items: pictures.map((picture) => buildEmbeddingRequestPayload(picture)),
  }
  const errors = []

  try {
    const payload = await embedBatchWithPrimaryEndpoint(requestPayload)
    if (payload.results.length !== pictures.length) {
      throw new Error(`Expected ${pictures.length} batch results, got ${payload.results.length}`)
    }
    return payload.results.map((result) => ({ ...result, provider: result.provider || payload.provider }))
  } catch (error) {
    errors.push(`primary-batch: ${error.message}`)
  }

  try {
    const results = []
    for (const picture of pictures) {
      results.push(await embedPictureWithRetry(picture))
    }
    return results
  } catch (error) {
    errors.push(`single-fallback: ${error.message}`)
  }

  throw new Error(`All batch image embedding providers failed (${errors.join("; ")})`)
}

const resolveEmbeddingModel = (embeddingPayload) =>
  embeddingPayload.model
  || (embeddingPayload.provider === "jina"
    ? getJinaModel()
    : embeddingPayload.provider === "hf-image-endpoint"
    ? process.env.HF_IMAGE_EMBEDDING_MODEL
    : process.env.IMAGE_EMBEDDING_MODEL)
  || (process.env.IMAGE_EMBEDDING_API_URL ? getJinaModel() : "sentence-transformers/clip-ViT-B-32")

const main = async () => {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const { all, batchSize, dryRun, force, ids, limit } = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  let query = supabaseAdmin
    .from("pictures")
    .select("id,title,subtitle,description,image_url,raw_image_url,image_variants,search_text")
    .order("id", { ascending: true })

  if (ids.length) {
    query = query.in("id", ids)
  } else if (!all) {
    query = query.limit(limit)
  }

  const { data: pictures, error: picturesError } = await query

  if (picturesError) {
    throw picturesError
  }

  let inserted = 0
  let skipped = 0
  const failed = []
  const candidates = []

  for (const picture of pictures || []) {
    const contentHash = buildContentHash(picture)

    if (!force) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("picture_embeddings")
        .select("content_hash,model")
        .eq("picture_id", picture.id)
        .maybeSingle()

      if (existingError) {
        throw existingError
      }
      if (existing?.content_hash === contentHash && existing.model === getExpectedEmbeddingModel()) {
        skipped++
        continue
      }
    }

    if (dryRun) {
      console.log(`[dry-run] picture ${picture.id}: ${picture.title} -> ${resolveImageUrl(chooseImagePath(picture))}`)
      continue
    }

    candidates.push({ picture, contentHash })
  }

  for (const batch of chunkArray(candidates, batchSize)) {
    const batchPictures = batch.map((item) => item.picture)
    let embeddingPayloads
    try {
      embeddingPayloads = await embedPictureBatchAdaptive(batchPictures)
    } catch (error) {
      for (const { picture } of batch) {
        failed.push({ id: picture.id, title: picture.title, message: error.message })
        console.error(`[failed] picture ${picture.id}: ${picture.title} - ${error.message}`)
      }
      continue
    }

    const rows = batch.map(({ picture, contentHash }, index) => {
      const embeddingPayload = embeddingPayloads[index]
      return {
        picture_id: picture.id,
        embedding: formatVector(embeddingPayload.embedding),
        model: resolveEmbeddingModel(embeddingPayload),
        content_hash: contentHash,
        embedding_source: "image",
      }
    })

    const { error: upsertError } = await supabaseAdmin
      .from("picture_embeddings")
      .upsert(rows, {
        onConflict: "picture_id",
      })

    if (upsertError) {
      throw upsertError
    }

    inserted += rows.length
    console.log(`[ok-batch] pictures ${batchPictures.map((picture) => picture.id).join(",")}`)
  }

  console.log(`Done. inserted_or_updated=${inserted} skipped=${skipped} failed=${failed.length}`)
  for (const failure of failed) {
    console.log(`[failed-summary] picture ${failure.id}: ${failure.title} - ${failure.message}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
