"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { I18nProvider, useI18n } from "@/lib/i18n"
import { supabase } from "@/utils/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function LoginInner() {
  const { t, locale, setLocale } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nextPath, setNextPath] = useState("/admin")
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedNext = params.get("next") || ""
    if (requestedNext.startsWith("/") && !requestedNext.startsWith("//")) {
      setNextPath(requestedNext)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(nextPath)
    } catch (error) {
      console.error("Error logging in:", error)
      alert(t('error'))
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="absolute top-4 right-4">
        <select value={locale} onChange={(e)=>setLocale(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </div>
      <form onSubmit={handleLogin} className="p-8 bg-white rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">{t('loginTitle')}</h1>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            {t('login')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginInner />
    </I18nProvider>
  )
}
