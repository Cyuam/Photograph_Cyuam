"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, CheckCircle2, FolderOpen } from "lucide-react"
import { PictureSetForm } from "@/components/picture-set-form"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import type { PictureSetSubmitData } from "@/lib/form-types"
import { adminFetch } from "@/utils/admin-auth-client"

const sourceFolder = "/Users/lilijie/Pictures/人像/作品集人像"

type SaveStatus =
  | {
      state: "success"
      pictureSetId: number
      pictureCount: number
      savedAt: Date
    }
  | {
      state: "error"
      message: string
      savedAt: Date
    }
  | null

export function PortraitLibraryAdmin() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)

  const handleSubmit = async (pictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    try {
      setSaveStatus(null)
      const res = await adminFetch(pictureSetId ? `/api/admin/picture-sets/${pictureSetId}` : "/api/admin/picture-sets", {
        method: pictureSetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pictureSet),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "人像作品库保存失败")
      }

      const savedPictureSetId = Number(data?.id || pictureSetId)
      const pictureCount = Array.isArray(pictureSet.pictures) ? pictureSet.pictures.length : 0
      setSaveStatus({
        state: "success",
        pictureSetId: savedPictureSetId,
        pictureCount,
        savedAt: new Date(),
      })
      toast({
        title: "已保存",
        description: `${pictureCount} 张图片已入库，作品库 ID ${savedPictureSetId}。`,
      })
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
      })
    } catch (error) {
      console.error("Portrait library submit failed:", error)
      const message = error instanceof Error ? error.message : "提交时出现了意外错误。"
      setSaveStatus({
        state: "error",
        message,
        savedAt: new Date(),
      })
      toast({
        title: "保存失败",
        description: message,
        variant: "destructive",
      })
      throw new Error(message)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-4 py-8 text-[#20231f]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#7a6f62]">Portrait Library Admin</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">人像图片标签库</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin">返回通用后台</Link>
            </Button>
            <Button asChild className="bg-[#20231f] text-white hover:bg-[#2b302a]">
              <Link href="/helsinki-photo-session">查看约拍页</Link>
            </Button>
          </div>
        </div>

        <section className="mb-5 rounded-md border border-[#ded4c6] bg-white px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#4e493f]">
              <FolderOpen className="h-4 w-4" />
              默认来源
            </div>
            <p className="break-all rounded-md bg-[#f7f3ec] px-3 py-2 font-mono text-xs text-[#4e493f]">
              {sourceFolder}
            </p>
          </div>
        </section>

        {saveStatus && (
          <section
            className={
              saveStatus.state === "success"
                ? "mb-5 rounded-md border border-[#8fb27d] bg-[#f1f7ed] px-4 py-3 text-[#273c21]"
                : "mb-5 rounded-md border border-[#d59b8d] bg-[#fff2ef] px-4 py-3 text-[#5b2820]"
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                {saveStatus.state === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {saveStatus.state === "success" ? "保存好了，图片已经入库" : "保存没有成功"}
                  </p>
                  <p className="mt-1 text-sm">
                    {saveStatus.state === "success"
                      ? `${saveStatus.pictureCount} 张图片已保存到作品库 ID ${saveStatus.pictureSetId}。`
                      : saveStatus.message}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium opacity-75">
                {saveStatus.savedAt.toLocaleTimeString("zh-CN", { hour12: false })}
              </span>
            </div>
          </section>
        )}

        <section className="rounded-md border border-[#ded4c6] bg-white p-4 shadow-[0_24px_80px_-70px_rgba(32,35,31,0.7)]">
          <PictureSetForm onSubmit={handleSubmit} editingPictureSet={null} variant="portraitLibrary" />
        </section>
      </div>
    </main>
  )
}
