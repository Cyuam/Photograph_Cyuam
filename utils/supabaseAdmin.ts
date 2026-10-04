import { createClient } from "@supabase/supabase-js"

// 使用服务端 key 创建 admin client（需要在部署环境配置 SUPABASE_SERVICE_ROLE_KEY）。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

if (!supabaseUrl) {
  throw new Error("[supabaseAdmin] Missing NEXT_PUBLIC_SUPABASE_URL")
}
if (!serviceKey) {
  throw new Error("[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY")
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceKey,
)
