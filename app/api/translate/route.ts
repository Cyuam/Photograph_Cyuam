import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

function createOpenAI(kind: 'vision' | 'text') {
  const isAzure = !!process.env.AZURE_OPENAI_ENDPOINT
  if (isAzure) {
    const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '')
    const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || (kind === 'vision' ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_TRANSLATION_MODEL) || 'gpt-4o-mini'
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultHeaders: { 'api-key': apiKey },
      defaultQuery: { 'api-version': apiVersion },
    } as any)
    return { client, model: deployment }
  }
  const apiKey = process.env.OPENAI_API_KEY || ''
  const client = new OpenAI({ apiKey })
  const model = (kind === 'vision' ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_TRANSLATION_MODEL) || 'gpt-4o-mini'
  return { client, model }
}

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLang = "en", targetLang = "zh" } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY || !!process.env.AZURE_OPENAI_API_KEY
    if (!hasOpenAIKey) {
      return NextResponse.json({ error: "OPENAI/Azure API key not configured" }, { status: 500 })
    }

    const { client: openai, model } = createOpenAI('text')
    const fromLabel = sourceLang === 'auto' ? 'auto-detected language' : sourceLang
    const system = `You are a professional translator. Preserve meaning, tone, and style. Return ONLY the translated text, with no quotes or extra commentary.`
    const user = `Translate the following text from ${fromLabel} to ${targetLang}:
${text}`

    let out: string = ''
    try {
      // Try Chat Completions first (works on OpenAI & many Azure deployments)
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      })
      out = (completion.choices?.[0]?.message?.content || '').trim()
    } catch (err: any) {
      const msg = String(err?.message || '')
      // Fallback to Responses API if server complains about 'messages'/'input'
      if (/unsupported\s*parameter|moved to 'input'|responses api/i.test(msg)) {
        const combined = `${system}\n\n${user}`
        const resp = await openai.responses.create({
          model,
          input: [
            { role: 'user', content: [ { type: 'input_text', text: combined } ] },
          ] as any,
        } as any)
        // @ts-ignore - SDK exposes output_text helper
        out = String((resp as any).output_text || '').trim()
        if (!out) {
          // fallback parse
          try {
            // @ts-ignore
            const content = (resp as any).output?.[0]?.content?.[0]
            out = String(content?.text?.value || content?.input_text?.text || '')
          } catch {}
        }
      } else {
        throw err
      }
    }
    return NextResponse.json({ success: true, translated: out })
  } catch (err) {
    console.error("/api/translate error", err)
    return NextResponse.json({ error: "Translation failed", debug: String((err as any)?.message || err) }, { status: 500 })
  }
}
