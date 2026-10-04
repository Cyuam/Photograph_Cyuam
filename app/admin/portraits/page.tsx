"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PortraitLibraryAdmin } from "@/components/portrait-library-admin"
import { useI18n } from "@/lib/i18n"
import { supabase } from "@/utils/supabase"

const adminEmails = String(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

export default function PortraitLibraryAdminPage() {
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          console.warn("auth.getUser error:", error)
        }
        const user = data?.user
        const email = String(user?.email || "").trim().toLowerCase()
        if (!user || !email) {
          router.push("/login?next=/admin/portraits")
        } else if (adminEmails.length > 0 && !adminEmails.includes(email)) {
          setAuthError("This account is not allowed to access admin.")
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.warn("checkUser failed:", error)
        setAuthError("Unable to verify admin access.")
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (loading) return <div>{t("loadingSets")}</div>
  if (authError) return <div className="p-6 text-sm text-red-600">{authError}</div>

  return <PortraitLibraryAdmin />
}
