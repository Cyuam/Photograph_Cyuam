import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3"

type AssetRecord = Record<string, any> | null | undefined

const r2Endpoint = process.env.R2_ENDPOINT_URL
const r2Bucket = process.env.R2_BUCKET_NAME
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
const r2Secret = process.env.R2_SECRET_ACCESS_KEY

const s3 = new S3Client({
  endpoint: r2Endpoint,
  region: "auto",
  forcePathStyle: true,
  credentials: {
    accessKeyId: r2AccessKeyId || "",
    secretAccessKey: r2Secret || "",
  },
})

export function getObjectKeyFromStorageUrl(value?: string | null): string | null {
  try {
    if (!value || typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed) return null

    if (/^https?:\/\//i.test(trimmed)) {
      const parsedUrl = new URL(trimmed)
      return decodeURI(parsedUrl.pathname.replace(/^\/+/, ""))
    }

    return decodeURI(trimmed.split(/[?#]/)[0].replace(/^\/+/, ""))
  } catch (error) {
    console.error("Failed to extract R2 object key:", value, error)
    return null
  }
}

function addUrlKey(keys: Set<string>, value?: string | null) {
  const key = getObjectKeyFromStorageUrl(value)
  if (key) keys.add(key)
}

function addVariantKeys(keys: Set<string>, variants: unknown) {
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) return

  for (const value of Object.values(variants as Record<string, unknown>)) {
    if (typeof value === "string") {
      addUrlKey(keys, value)
    }
  }
}

export function collectImageAssetKeys(records: AssetRecord[]): Set<string> {
  const keys = new Set<string>()

  for (const record of records) {
    if (!record) continue
    addUrlKey(keys, record.cover_image_url)
    addUrlKey(keys, record.image_url)
    addUrlKey(keys, record.raw_image_url)
    addVariantKeys(keys, record.cover_image_variants)
    addVariantKeys(keys, record.image_variants)
  }

  return keys
}

export async function deleteObjectKeysFromR2(keys: Iterable<string>) {
  const uniqueKeys = Array.from(new Set(Array.from(keys).filter(Boolean)))
  if (!uniqueKeys.length) return { deleted: [], errors: [] as Array<{ key?: string; message: string }> }

  if (!r2Bucket || !r2Endpoint || !r2AccessKeyId || !r2Secret) {
    return {
      deleted: [],
      errors: uniqueKeys.map((key) => ({ key, message: "Missing R2 configuration" })),
    }
  }

  const deleted: string[] = []
  const errors: Array<{ key?: string; message: string }> = []

  for (let i = 0; i < uniqueKeys.length; i += 1000) {
    const batch = uniqueKeys.slice(i, i + 1000)
    try {
      const result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: r2Bucket,
          Delete: {
            Objects: batch.map((Key) => ({ Key })),
            Quiet: false,
          },
        }),
      )

      for (const item of result.Deleted || []) {
        if (item.Key) deleted.push(item.Key)
      }

      for (const item of result.Errors || []) {
        errors.push({
          key: item.Key,
          message: item.Message || item.Code || "Delete failed",
        })
      }
    } catch (error: any) {
      const message = String(error?.message || error)
      errors.push(...batch.map((key) => ({ key, message })))
    }
  }

  return { deleted, errors }
}
