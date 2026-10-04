import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAdminRequest } from "@/utils/admin-auth.server"

export const runtime = "nodejs"

const r2Endpoint = process.env.R2_ENDPOINT_URL
const r2Bucket = process.env.R2_BUCKET_NAME
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID
const r2Secret = process.env.R2_SECRET_ACCESS_KEY

// S3 client configuration using env variables
const s3 = new S3Client({
  endpoint: r2Endpoint,
  region: "auto",
  forcePathStyle: true,
  credentials: {
    accessKeyId: r2AccessKeyId || "",
    secretAccessKey: r2Secret || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (!r2Endpoint || !r2Bucket || !r2AccessKeyId || !r2Secret) {
      return NextResponse.json(
        { error: "Missing R2 configuration" },
        { status: 500 },
      )
    }

    const requestContentType = request.headers.get("content-type") || ""
    if (requestContentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const objectName = String(formData.get("objectName") || "").trim()
      const file = formData.get("file")
      const contentType = String(formData.get("contentType") || "")

      if (!objectName) {
        return NextResponse.json({ error: "Missing objectName" }, { status: 400 })
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 })
      }

      const fileContentType = contentType || file.type || "application/octet-stream"
      const body = Buffer.from(await file.arrayBuffer())
      await s3.send(
        new PutObjectCommand({
          Bucket: r2Bucket,
          Key: objectName,
          Body: body,
          ContentType: fileContentType,
        }),
      )

      return NextResponse.json({
        imageUrl: `/${objectName}`,
        objectName,
        contentType: fileContentType,
      })
    }

    const { objectName, contentType } = await request.json();
    if (!objectName) {
      return NextResponse.json({ error: "Missing objectName" }, { status: 400 });
    }

    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: objectName,
      ContentType: contentType || "application/octet-stream",
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return NextResponse.json({
      uploadUrl: signedUrl,
      contentType: contentType || "application/octet-stream",
    });
  } catch (error) {
    return NextResponse.json({ error: `❌ Failed to create signed URL: ${error}` }, { status: 500 });
  }
}
