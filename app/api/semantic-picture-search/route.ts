import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/utils/supabaseAdmin"

export const runtime = "nodejs"

const DEFAULT_HF_MODEL = "sentence-transformers/clip-ViT-B-32-multilingual-v1"
const DEFAULT_JINA_MODEL = "jina-embeddings-v5-omni-small"
const HF_ROUTER_BASE = "https://router.huggingface.co/hf-inference/models"
const JINA_EMBEDDING_ENDPOINT = "https://api.jina.ai/v1/embeddings"
const MAX_QUERY_LENGTH = 160
const MAX_LIMIT = 30

const getEmbeddingDimensions = () => Number(process.env.JINA_EMBEDDING_DIMENSIONS || 1024)

type EmbeddingPayload = number[] | number[][] | number[][][]

const flattenEmbedding = (payload: EmbeddingPayload): number[] => {
  let value: unknown = payload
  while (
    Array.isArray(value)
    && value.length === 1
    && Array.isArray(value[0])
  ) {
    value = value[0]
  }

  if (!Array.isArray(value) || value.some((item) => Array.isArray(item))) {
    throw new Error("Embedding provider returned token embeddings instead of a pooled vector")
  }

  const embedding = value.map((item) => Number(item))
  if (embedding.some((item) => !Number.isFinite(item))) {
    throw new Error("Embedding provider returned non-numeric values")
  }
  const expectedDimensions = getEmbeddingDimensions()
  if (embedding.length !== expectedDimensions) {
    throw new Error(`Expected ${expectedDimensions}-dimensional embedding, got ${embedding.length}`)
  }
  return embedding
}

const normalizeEmbedding = (embedding: number[]) => {
  const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0))
  if (!norm) {
    throw new Error("Embedding provider returned a zero vector")
  }
  return embedding.map((value) => value / norm)
}

const embedQueryWithHf = async (query: string) => {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN
  if (!token) {
    throw new Error("Missing HF_TOKEN")
  }

  const model = process.env.HF_TEXT_EMBEDDING_MODEL || DEFAULT_HF_MODEL
  const endpoint = `${HF_ROUTER_BASE}/${model}/pipeline/feature-extraction`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      inputs: query,
      options: { wait_for_model: true },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Embedding request failed: ${response.status} ${detail}`)
  }

  return {
    embedding: normalizeEmbedding(flattenEmbedding(await response.json())),
    model,
    provider: "hf",
  }
}

const parseJinaEmbedding = (payload: unknown) => {
  const responsePayload = payload as { data?: Array<{ embedding?: unknown }> }
  const embedding = responsePayload.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    throw new Error("Jina embedding response did not include an embedding")
  }
  const values = embedding.map((value) => Number(value))
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Jina embedding response included non-numeric values")
  }
  const expectedDimensions = getEmbeddingDimensions()
  if (values.length !== expectedDimensions) {
    throw new Error(`Expected ${expectedDimensions}-dimensional embedding, got ${values.length}`)
  }
  return values
}

const embedQueryWithJina = async (query: string) => {
  const token = process.env.JINA_API_KEY
  if (!token) {
    throw new Error("Missing JINA_API_KEY")
  }

  const model = process.env.JINA_EMBEDDING_MODEL || DEFAULT_JINA_MODEL
  const response = await fetch(JINA_EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      dimensions: getEmbeddingDimensions(),
      task: process.env.JINA_TEXT_EMBEDDING_TASK || "retrieval.query",
      normalized: true,
      embedding_type: "float",
      input: [{ text: query }],
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Jina embedding request failed: ${response.status} ${detail}`)
  }

  return {
    embedding: parseJinaEmbedding(await response.json()),
    model,
    provider: "jina",
  }
}

const embedQueryWithEndpoint = async (query: string) => {
  const endpoint = process.env.TEXT_EMBEDDING_API_URL
  if (!endpoint) {
    throw new Error("Missing TEXT_EMBEDDING_API_URL")
  }

  const apiKey = process.env.TEXT_EMBEDDING_API_KEY
    || process.env.IMAGE_EMBEDDING_API_KEY
    || process.env.HF_TOKEN
    || process.env.HUGGINGFACEHUB_API_TOKEN
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      text: query,
      task: "query",
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Text embedding endpoint failed: ${response.status} ${detail}`)
  }

  const payload = await response.json() as { embedding?: unknown; model?: string; provider?: string }
  if (!Array.isArray(payload.embedding)) {
    throw new Error("Text embedding endpoint returned no embedding")
  }
  return {
    embedding: normalizeEmbedding(flattenEmbedding(payload.embedding as EmbeddingPayload)),
    model: payload.model || process.env.JINA_EMBEDDING_MODEL || DEFAULT_JINA_MODEL,
    provider: payload.provider || "endpoint",
  }
}

const embedQuery = async (query: string) => {
  const provider = process.env.SEMANTIC_EMBEDDING_PROVIDER
    || (process.env.TEXT_EMBEDDING_API_URL
      ? "endpoint"
      : !process.env.HF_TOKEN && !process.env.HUGGINGFACEHUB_API_TOKEN && process.env.JINA_API_KEY
      ? "jina"
      : "hf")

  if (provider === "endpoint") {
    try {
      return await embedQueryWithEndpoint(query)
    } catch (error) {
      if (!process.env.JINA_API_KEY) {
        throw error
      }
      console.warn("Text embedding endpoint failed; falling back to Jina API:", error)
      return embedQueryWithJina(query)
    }
  }
  if (provider === "jina") {
    return embedQueryWithJina(query)
  }
  return embedQueryWithHf(query)
}

const parseLimit = (value: string | null) => {
  const limit = Number(value || 12)
  if (!Number.isFinite(limit) || limit < 1) return 12
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") || "").normalize("NFKC").replace(/\s+/g, " ").trim()
  const limit = parseLimit(searchParams.get("limit"))
  const minSimilarity = Number(searchParams.get("minSimilarity") || 0)

  if (!query) {
    return NextResponse.json({ results: [] })
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Query is too long" }, { status: 400 })
  }

  try {
    const embeddingPayload = await embedQuery(query)
    const { data, error } = await supabaseAdmin.rpc("match_pictures_by_embedding", {
      query_embedding: embeddingPayload.embedding,
      match_count: limit,
      min_similarity: Number.isFinite(minSimilarity) ? minSimilarity : 0,
      min_lng: null,
      min_lat: null,
      max_lng: null,
      max_lat: null,
    })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      results: data || [],
      model: embeddingPayload.model,
      provider: embeddingPayload.provider,
    })
  } catch (error: any) {
    console.error("[api/semantic-picture-search]", error)
    return NextResponse.json(
      { error: error?.message || "Semantic search failed" },
      { status: 500 },
    )
  }
}
