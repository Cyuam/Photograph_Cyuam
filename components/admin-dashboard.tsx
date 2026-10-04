"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PictureSetForm } from "./picture-set-form"
import { PictureSetList } from "./picture-set-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureSetSubmitData } from "@/lib/form-types"
import { useI18n } from "@/lib/i18n"
import { adminFetch } from "@/utils/admin-auth-client"

type BookingLogItem = {
  id: string
  createdAt: string
  name: string
  contact: string
  date: string
  packageName?: string
  packagePrice?: string
  timeWindow?: string
  style?: string
  people?: string
  note?: string
  status?: string
  emailSent?: boolean
  emailError?: string
}

export function AdminDashboard() {
  const { t } = useI18n()
  const [pictureSets, setPictureSets] = useState<PictureSet[]>([])
  const [editingPictureSet, setEditingPictureSet] = useState<PictureSet | null>(null)
  const [activeTab, setActiveTab] = useState("list")
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [bookingLogs, setBookingLogs] = useState<BookingLogItem[]>([])
  const [bookingLogSource, setBookingLogSource] = useState("")
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)

  const fetchPictureSets = async (q?: string) => {
    try {
      setIsLoading(true)
      const query = (typeof q === "string" ? q : searchQuery).trim()
      const url = query ? `/api/admin/picture-sets?q=${encodeURIComponent(query)}` : "/api/admin/picture-sets"
      const res = await adminFetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t("loadSetsFail"))
      setPictureSets(Array.isArray(data?.items) ? data.items : [])
    } catch (error) {
      console.error("Error in fetchPictureSets(server):", error)
      toast({ title: t("error"), description: t("loadSetsFail"), variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPictureSets()
  }, [])

  const fetchBookingLogs = async () => {
    try {
      setIsLoadingBookings(true)
      const res = await adminFetch("/api/photo-session-booking?limit=40")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "预约日志加载失败")
      setBookingLogs(Array.isArray(data?.items) ? data.items : [])
      setBookingLogSource(String(data?.source || ""))
    } catch (error) {
      console.error("Error loading booking logs:", error)
      toast({ title: t("error"), description: "预约日志加载失败", variant: "destructive" })
    } finally {
      setIsLoadingBookings(false)
    }
  }

  useEffect(() => {
    if (activeTab === "bookings") {
      fetchBookingLogs()
    }
  }, [activeTab])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPictureSets(searchQuery)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSubmitPictureSetServer = async (newPictureSet: PictureSetSubmitData, pictureSetId?: number) => {
    try {
      if (pictureSetId) {
        const res = await adminFetch(`/api/admin/picture-sets/${pictureSetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPictureSet),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          console.error("API update picture-set failed:", data)
          toast({ title: t("error"), description: data?.error || t("updateSetFail"), variant: "destructive" })
          return
        }
        if (Array.isArray(data?.storageDeleteErrors) && data.storageDeleteErrors.length > 0) {
          console.warn("Picture set updated, but some old image assets were not deleted:", data.storageDeleteErrors)
          toast({
            title: t("success"),
            description: `${t("updateSetSuccess")} Storage cleanup skipped ${data.storageDeleteErrors.length} file(s).`,
          })
        } else {
          toast({ title: t("success"), description: t("updateSetSuccess") })
        }
        setEditingPictureSet(null)
        setActiveTab("list")
        setTimeout(async () => {
          await fetchPictureSets()
        }, 0)
        return
      }

      const res = await adminFetch("/api/admin/picture-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPictureSet),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error("API create picture-set failed:", data)
        toast({ title: t("error"), description: data?.error || t("createSetFail"), variant: "destructive" })
        return
      }

      toast({ title: t("success"), description: t("createSetSuccess") })
      setEditingPictureSet(null)
      setActiveTab("list")
      await fetchPictureSets()
    } catch (error) {
      console.error("Error in handleSubmitPictureSetServer:", error)
      toast({ title: t("error"), description: t("unexpectedError"), variant: "destructive" })
    }
  }

  const handleDeletePictureSet = async (id: number) => {
    try {
      const res = await adminFetch(`/api/admin/picture-sets/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error("Delete set failed:", data)
        toast({ title: t("error"), description: data?.error || t("deleteSetFail"), variant: "destructive" })
        return
      }
      if (Array.isArray(data?.storageDeleteErrors) && data.storageDeleteErrors.length > 0) {
        console.warn("Picture set deleted, but some image assets were not deleted:", data.storageDeleteErrors)
        toast({
          title: t("success"),
          description: `${t("deleteSetSuccess")} Storage cleanup skipped ${data.storageDeleteErrors.length} file(s).`,
        })
      } else {
        toast({ title: t("success"), description: t("deleteSetSuccess") })
      }
      await fetchPictureSets()
    } catch (error) {
      console.error("Error in handleDeletePictureSet(server):", error)
      toast({ title: t("error"), description: t("unexpectedDeleteError"), variant: "destructive" })
    }
  }

  const handleEditPictureSet = async (pictureSet: PictureSet) => {
    try {
      const res = await adminFetch(`/api/admin/picture-sets/${pictureSet.id}`)
      const data = await res.json()
      if (!res.ok) {
        console.error("Load set detail failed:", data)
        toast({ title: t("error"), description: data?.error || t("loadSetDataFail"), variant: "destructive" })
        return
      }
      setEditingPictureSet(data.item as PictureSet)
      setActiveTab("form")
    } catch (error) {
      console.error("Error in handleEditPictureSet:", error)
      toast({ title: t("error"), description: t("unexpectedError"), variant: "destructive" })
    }
  }

  const handleCancelEdit = () => {
    setEditingPictureSet(null)
    setActiveTab("list")
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{t("adminDashboard")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/portraits">Portrait Library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/portfolio">Home</Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-2 items-center">
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
            {t("clear")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">{t("pictureSetsTab")}</TabsTrigger>
          <TabsTrigger value="form">{editingPictureSet ? t("editSetTab") : t("addNewSetTab")}</TabsTrigger>
          <TabsTrigger value="bookings">预约日志</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>{t("loadingSets")}</p>
            </div>
          ) : (
            <PictureSetList pictureSets={pictureSets} onEdit={handleEditPictureSet} onDelete={handleDeletePictureSet} />
          )}
        </TabsContent>
        <TabsContent value="form">
          <PictureSetForm
            onSubmit={handleSubmitPictureSetServer}
            editingPictureSet={editingPictureSet}
            onCancel={handleCancelEdit}
          />
        </TabsContent>
        <TabsContent value="bookings">
          <section className="rounded-md border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">约拍预约日志</h2>
                <p className="mt-1 text-sm text-gray-500">
                  来源：{bookingLogSource || "loading"} · 最近 {bookingLogs.length} 条
                </p>
              </div>
              <Button type="button" variant="outline" onClick={fetchBookingLogs} disabled={isLoadingBookings}>
                {isLoadingBookings ? "刷新中" : "刷新"}
              </Button>
            </div>

            {isLoadingBookings ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading booking logs...</div>
            ) : bookingLogs.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                暂时没有预约记录。
              </div>
            ) : (
              <div className="grid gap-3">
                {bookingLogs.map((item) => (
                  <article key={item.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-950">{item.name || "未命名"}</h3>
                          <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-600">
                            {item.emailSent ? "邮件已发" : "已记录"}
                          </span>
                          {item.status && (
                            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-600">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-700">{item.contact}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {item.date} · {item.timeWindow || "未选时间"} · {item.packageName || "未选套餐"} {item.packagePrice || ""}
                        </p>
                      </div>
                      <time className="text-xs font-medium text-gray-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false }) : ""}
                      </time>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-3">
                      <p><span className="font-semibold text-gray-800">人数：</span>{item.people || "未填"}</p>
                      <p><span className="font-semibold text-gray-800">想拍：</span>{item.style || "未填"}</p>
                      <p><span className="font-semibold text-gray-800">编号：</span>{item.id}</p>
                    </div>
                    {item.note && (
                      <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm leading-6 text-gray-700">{item.note}</p>
                    )}
                    {item.emailError && (
                      <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{item.emailError}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
