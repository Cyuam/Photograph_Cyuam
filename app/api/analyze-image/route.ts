import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

export async function POST(request: NextRequest) {
  try {
    // Robust JSON parse with friendly error for invalid/missing body
    let payload: any
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', details: 'Request body must be valid JSON', code: 'BAD_JSON' },
        { status: 400 }
      )
    }
    const { imageUrl, analysisType = 'description', customPrompt } = payload || {}

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    const hasOpenAIKey = !!process.env.OPENAI_API_KEY || !!process.env.AZURE_OPENAI_API_KEY
    if (!hasOpenAIKey) {
      return NextResponse.json(
        { error: 'OpenAI/Azure OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // Choose model (vision-enabled) and client
    const isAzure = !!process.env.AZURE_OPENAI_ENDPOINT
    const { client: openai, model } = createOpenAI('vision')

    // Build prompt per analysis type; honor custom prompt if provided
    let prompt = ''
    
    if (customPrompt) {
      // 使用自定义 prompt
      prompt = customPrompt
    } else {
      // Default prompt (中英双语，更具诗意)
      switch (analysisType) {
        case 'title':
          prompt = `为这张摄影作品创作一个富有诗意和意境的标题。

要求：
- 捕捉画面的核心情感、氛围或故事性
- 运用文学化、意象丰富的语言，避免平淡直白
- 可以使用隐喻、通感或诗性表达
- 长度：中文 4-10 字，英文 2-6 词
- 不要使用标点、引号或任何解释说明
- 只返回标题本身

示例风格：
- "暮色中的低语" 而非 "夕阳下的风景"
- "时光的褶皱" 而非 "老旧的墙壁"
- "光影的诗篇" 而非 "明暗对比"

Create a poetic and evocative title for this photograph.

Requirements:
- Capture the core emotion, atmosphere, or narrative
- Use literary, imagery-rich language, avoid plain descriptions
- You may use metaphor, synesthesia, or poetic expression
- Length: 2-6 words (EN) or 4-10 characters (ZH)
- No punctuation, quotes, or explanations
- Return ONLY the title

Example style:
- "Whispers at Dusk" not "Sunset Landscape"
- "Folds of Time" not "Old Wall"
- "Poem of Light and Shadow" not "Contrast of Light and Dark"

请返回标题（可以是中文或英文，选择更适合画面意境的语言）：`
          break
      case 'subtitle':
        prompt = `为这张摄影作品创作一个富有文学性的副标题句子，深化标题的意境。

要求：
- 延伸标题的意境，加入一个具体而诗意的细节（场景、时刻、情绪或故事暗示）
- 语言流畅自然，具有散文诗般的节奏感
- 避免堆砌形容词，追求意象的准确和深度
- 长度：中文 10-20 字，英文 8-16 词
- 单句，可用逗号但避免冒号、破折号
- 只返回副标题本身

示例风格：
- "晨雾散去时，旧巷深处传来木屐声" 而非 "早晨的街道很安静"
- "Between rain and rainbow, the world holds its breath" 而非 "After the rain, it looks beautiful"

Write a literary subtitle sentence that deepens the title's poetic resonance.

Requirements:
- Extend the title's mood with one concrete, poetic detail
- Flow naturally with prose-poem rhythm
- Avoid piling adjectives, seek precise and deep imagery
- Length: 8-16 words (EN) or 10-20 characters (ZH)
- Single sentence, commas allowed but avoid colons/dashes
- Return ONLY the subtitle

请返回副标题（可以是中文或英文，与标题相呼应）：`
        break
      case 'complete':
        prompt = `为这张摄影作品创作标题、副标题和描述，整体风格应富有诗意和文学性。

严格按照以下格式返回（不要有其他文字）：

Title: [2-6 词/4-10 字，诗意简洁]
Subtitle: [8-16 词/10-20 字，意境延伸]
Description: [70-110 词/80-120 字，包含主体、氛围、光影、情感]

描述要求：
- 用散文诗般的语言描绘画面
- 融入情感共鸣和想象空间
- 描述光影、色彩、构图时追求意境而非技术性
- 形成连贯的段落，不要列表或相机参数

Generate poetic title, subtitle and description for this photograph.

Return EXACTLY in this format (no extra text):

Title: [2-6 words/4-10 chars, poetic and concise]
Subtitle: [8-16 words/10-20 chars, extending the mood]
Description: [70-110 words/80-120 chars, covering subject, atmosphere, light/shadow, emotion]

Description requirements:
- Use prose-poem language to depict the scene
- Integrate emotional resonance and imaginative space
- Describe light, color, composition with poetic sense, not technical terms
- Form a cohesive paragraph, no lists or camera specs`
        break
      case 'description':
        prompt = `仔细观察这张摄影作品，写一段富有文学性和诗意的作品描述，适合展示在摄影作品集中。

要求：
- 长度：中文 80-120 字，英文 70-110 词
- 内容涵盖：
  * 主体与环境，用意象化的语言描绘
  * 氛围与情感，唤起观者的共鸣
  * 光影与色彩，强调其诗意和象征意义
  * 构图或技法，若有明显特点可融入叙述
- 文字流畅连贯，形成完整段落
- 避免技术性术语和相机参数
- 追求意境和情感深度，而非客观描述
- 只返回描述段落本身

示例风格：
"晨光如细纱般铺洒在古旧的石阶上，每一级台阶都承载着岁月的重量。光影在墙面上勾勒出时间的纹理，那些剥落的痕迹仿佛在低语着被遗忘的故事。构图的纵深引导视线深入未知，留下想象的空间。"

Study this photograph carefully and write a literary, poetic description suitable for a photography portfolio.

Requirements:
- Length: 70-110 words (EN) or 80-120 characters (ZH)
- Cover:
  * Subject and surroundings, using imagery-rich language
  * Atmosphere and emotion, evoking viewer resonance
  * Light and color, emphasizing poetic and symbolic meaning
  * Composition or techniques, if notable, weave into narrative
- Flow as cohesive paragraph
- Avoid technical jargon and camera specs
- Seek emotional depth and poetic mood over objective description
- Return ONLY the description paragraph

请返回描述段落：`
        break
      case 'tags':
        prompt = `Generate bilingual tags for this photograph in both English and Chinese.
Cover: subject category, style, color, and mood.
Return a single comma-separated line with up to 10 tags in the format: "english-tag (中文标签)".
Example: "landscape (风景), sunset (日落), warm-tones (暖色调), serene (宁静)"
Return ONLY the comma-separated tags, no extra text.`
        break
      case 'technical':
        prompt = `Provide a concise technical analysis (<= 150 words):
shooting techniques (depth of field, composition, angle), lighting (type/direction), post-processing style, and suggested camera settings.`
        break
      default:
        prompt = 'Briefly describe the content of this image.'
      }
    }

    // Prefer passing public URL directly to OpenAI vision
    let text: string = ''
    const runResponsesWith = async (useImageData: boolean) => {
      // If useImageData, download and attach base64
      let imageContent: any
      if (useImageData) {
        const r = await fetch(imageUrl)
        if (!r.ok) throw new Error(`fetch image failed: ${r.status}`)
        const buf = Buffer.from(await r.arrayBuffer())
        const mime = r.headers.get('content-type') || 'image/jpeg'
        const b64 = buf.toString('base64')
        imageContent = { type: 'input_image', image_url: `data:${mime};base64,${b64}` }
      } else {
        // Azure Responses API often accepts plain string for image_url
        imageContent = { type: 'input_image', image_url: imageUrl as any }
      }
      const resp = await openai.responses.create({
        model,
        instructions: 'You are a professional photography curator and copywriter. Keep outputs concise and usable.',
        input: [ { role: 'user', content: [ { type: 'input_text', text: prompt }, imageContent ] } ] as any,
      } as any)
      // @ts-ignore
      let out = String((resp as any).output_text || '').trim()
      if (!out) {
        try {
          // @ts-ignore
          const content = (resp as any).output?.[0]?.content?.[0]
          out = String(content?.text?.value || '')
        } catch {}
      }
      return out
    }

    if (isAzure) {
      // Prefer Responses API first on Azure
      try {
        text = await runResponsesWith(false)
      } catch (e) {
        // fallback to image_data
        text = await runResponsesWith(true)
      }
    } else {
      // OpenAI public: try chat first, then responses
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a professional photography curator and copywriter. Keep outputs concise and usable.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ] as any,
            },
          ],
          temperature: 0.7,
        })
        text = (completion.choices?.[0]?.message?.content || '').trim()
      } catch (err: any) {
        const msg = String(err?.message || '')
        if (/unsupported\s*parameter|moved to 'input'|responses api/i.test(msg)) {
          try { text = await runResponsesWith(false) } catch { text = await runResponsesWith(true) }
        } else {
          throw err
        }
      }
    }

    return NextResponse.json({
      success: true,
      analysisType,
      result: text.trim()
    })

  } catch (error) {
    console.error('OpenAI/Azure Vision API error:', error)
    
    // Map common errors to structured codes/messages
    if (error instanceof Error) {
      const errorMessage = error.message
      
      // 429 Too Many Requests - quota exceeded
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('quota')) {
        return NextResponse.json(
          { 
            error: 'API quota exceeded', 
            details: 'OpenAI rate limit or quota reached. Try again later or adjust plan.',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        )
      }
      
      // 401 Unauthorized - API Key issue
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('api key')) {
        return NextResponse.json(
          { 
            error: 'Invalid API key', 
            details: 'OpenAI API key is invalid or expired. Check configuration.',
            code: 'INVALID_API_KEY'
          },
          { status: 401 }
        )
      }
      
      // 400 Bad Request - invalid request
      if (errorMessage.includes('400')) {
        return NextResponse.json(
          { 
            error: 'Bad request', 
            details: 'Unsupported image format or invalid parameters.',
            code: 'BAD_REQUEST'
          },
          { status: 400 }
        )
      }
    }
    
    // Unknown error
    return NextResponse.json({ error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error. Please try again later.', code: 'UNKNOWN_ERROR' }, { status: 500 })
  }
}
