// components/picture-set-form.tsx
"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowUp, Sparkles, Camera, FolderOpen } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import imageCompression from "browser-image-compression"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageAnalysisComponent } from "@/components/image-analysis"
import { useImageAnalysis } from "@/hooks/use-image-analysis"
import { supabase } from "@/utils/supabase"
import { LocationPreviewMap } from "@/components/location-preview-map"
import { adminFetch } from "@/utils/admin-auth-client"
import { toast } from "@/components/ui/use-toast"

import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSetSubmitData, pictureSetId?: number) => void | Promise<void>
  editingPictureSet?: PictureSet | null
  onCancel?: () => void
  variant?: "default" | "portraitLibrary"
}

const PORTRAIT_LIBRARY_DEFAULT_TAGS = [
  "portrait-library",
  "约拍样片",
  "人像",
  "portfolio",
  "sample-candidate",
]

const PORTRAIT_LIBRARY_PICTURE_DEFAULT_TAGS = ["portrait-library", "sample-candidate", "display:sample"]

const PORTRAIT_GROUP_SHARED_TAG_PREFIXES = new Set(["location", "model", "type", "style", "technique", "gear", "series"])
const PORTRAIT_HIDDEN_OPTION_TAGS = new Set([
  "type:solo-portrait",
  "location:travel",
  "style:natural",
  "style:playful",
  "display:location",
  "display:moment",
])

const PORTRAIT_TAG_FIELDS = [
  {
    prefix: "location",
    label: "地点",
    placeholder: "选择地点",
    options: [
      { value: "location:helsinki", label: "Helsinki" },
      { value: "location:stockholm", label: "Stockholm" },
      { value: "location:aalto", label: "Aalto / Otaniemi" },
      { value: "location:switzerland", label: "Switzerland" },
      { value: "location:italy", label: "Italy" },
      { value: "location:other-city", label: "其他城市 / 地点" },
    ],
  },
  {
    prefix: "type",
    label: "拍摄内容",
    placeholder: "选择拍摄内容",
    options: [
      { value: "type:travel-session", label: "旅拍 / 游客照" },
      { value: "type:couple-session", label: "情侣约拍" },
      { value: "type:family-session", label: "亲子 / 家庭" },
      { value: "type:pet-session", label: "宠物约拍" },
      { value: "type:id-photo", label: "证件照" },
      { value: "type:graduation-session", label: "毕业写真" },
      { value: "type:campus-session", label: "校园写真" },
    ],
  },
  {
    prefix: "model",
    label: "模特",
    placeholder: "添加模特名",
    help: "用于按被拍摄者归档；可以填昵称、英文名或代号。",
    options: [],
  },
  {
    prefix: "style",
    label: "画面风格",
    placeholder: "选择画面风格",
    options: [
      { value: "style:editorial", label: "写真感" },
      { value: "style:street", label: "街拍" },
      { value: "style:quiet", label: "安静松弛" },
      { value: "style:cinematic", label: "电影感" },
    ],
  },
  {
    prefix: "technique",
    label: "拍摄技法",
    placeholder: "选择技法",
    options: [
      { value: "technique:shallow-depth", label: "大光圈虚化" },
      { value: "technique:telephoto-compression", label: "长焦压缩" },
      { value: "technique:wide-environment", label: "环境人像" },
      { value: "technique:close-up", label: "近景 / 大头照" },
      { value: "technique:full-body", label: "全身构图" },
      { value: "technique:motion", label: "走路 / 动态" },
    ],
  },
  {
    prefix: "gear",
    label: "设备",
    placeholder: "选择设备",
    options: [
      { value: "gear:digital", label: "数码" },
      { value: "gear:film", label: "胶片" },
      { value: "gear:ccd", label: "CCD" },
      { value: "gear:polaroid", label: "拍立得" },
    ],
  },
  {
    prefix: "display",
    label: "展示用途",
    placeholder: "选择展示用途",
    help: "只决定前台怎么调用这张图，不描述照片内容或风格。",
    options: [
      { value: "display:hero", label: "首屏大图：第一眼吸引人" },
      { value: "display:cover", label: "封面候选：卡片/入口图" },
      { value: "display:sample", label: "样本墙" },
      { value: "display:hidden", label: "只入库：暂不公开展示" },
    ],
  },
]

const PORTRAIT_GROUP_TAG_FIELDS = PORTRAIT_TAG_FIELDS.filter((field) =>
  PORTRAIT_GROUP_SHARED_TAG_PREFIXES.has(field.prefix),
)

function mergeTagList(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next].map((tag) => tag.trim()).filter(Boolean)))
}

function getTagsByPrefix(tags: string[] = [], prefix: string) {
  return tags.filter((tag) => tag.startsWith(`${prefix}:`))
}

function getPortraitTagLabel(tag: string) {
  const [, ...parts] = tag.split(":")
  return parts.join(":") || tag
}

function getPortraitTagPrefix(tag: string) {
  const [prefix] = tag.split(":")
  return prefix || ""
}

function normalizeCustomPortraitTag(prefix: string, value: string) {
  const clean = value.trim()
  if (!clean) return ""
  if (clean.includes(":")) {
    const [rawPrefix, ...rest] = clean.split(":")
    const suffix = rest.join(":").trim()
    if (!suffix) return ""
    return `${rawPrefix.trim().toLowerCase()}:${suffix}`
  }
  return `${prefix}:${clean}`
}

function createDefaultSeriesName() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")
}

const PORTRAIT_DRAFT_DB_NAME = "portrait-library-drafts"
const PORTRAIT_DRAFT_STORE = "drafts"
const PORTRAIT_DRAFT_KEY = "current"

type PortraitLibraryDraft = {
  version: 1
  savedAt: string
  title: string
  subtitle: string
  description: string
  tagsText: string
  sameSeriesUpload: boolean
  seriesTagDraft: string
  portraitGroupTags: string[]
  pictures: PictureFormData[]
  en: { title: string; subtitle: string; description: string }
  zh: { title: string; subtitle: string; description: string }
}

function openPortraitDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = window.indexedDB.open(PORTRAIT_DRAFT_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PORTRAIT_DRAFT_STORE)) {
        db.createObjectStore(PORTRAIT_DRAFT_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Failed to open portrait draft database"))
  })
}

async function readPortraitLibraryDraft(): Promise<PortraitLibraryDraft | null> {
  const db = await openPortraitDraftDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTRAIT_DRAFT_STORE, "readonly")
    const request = tx.objectStore(PORTRAIT_DRAFT_STORE).get(PORTRAIT_DRAFT_KEY)
    request.onsuccess = () => resolve((request.result as PortraitLibraryDraft | undefined) || null)
    request.onerror = () => reject(request.error || new Error("Failed to read portrait draft"))
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error("Portrait draft read transaction failed"))
    }
  })
}

async function savePortraitLibraryDraft(draft: PortraitLibraryDraft) {
  const db = await openPortraitDraftDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PORTRAIT_DRAFT_STORE, "readwrite")
    tx.objectStore(PORTRAIT_DRAFT_STORE).put(draft, PORTRAIT_DRAFT_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error("Portrait draft save transaction failed"))
    }
  })
}

async function clearPortraitLibraryDraft() {
  const db = await openPortraitDraftDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PORTRAIT_DRAFT_STORE, "readwrite")
    tx.objectStore(PORTRAIT_DRAFT_STORE).delete(PORTRAIT_DRAFT_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error("Portrait draft clear transaction failed"))
    }
  })
}

const RESPONSIVE_IMAGE_WIDTHS = [640, 1280] as const
const RESPONSIVE_PRIMARY_WIDTH = RESPONSIVE_IMAGE_WIDTHS[RESPONSIVE_IMAGE_WIDTHS.length - 1]

function getResponsiveImageQuality(width: number) {
  if (width <= 640) return 0.64
  if (width <= 1280) return 0.74
  return 0.84
}

function getResponsiveImageMaxSizeMB(width: number) {
  if (width <= 640) return 0.26
  if (width <= 1280) return 0.9
  if (width <= 1920) return 2.2
  return 3.4
}

function normalizeObjectNamePart(value: string) {
  return value
    .replace(/\.[^/.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "image"
}

function getOriginalExtension(file: File) {
  const match = file.name.match(/\.[A-Za-z0-9]+$/)
  if (match) return match[0].toLowerCase()
  if (file.type === "image/png") return ".png"
  if (file.type === "image/webp") return ".webp"
  if (file.type === "image/gif") return ".gif"
  return ".jpg"
}

function createResponsiveImagePrefix(kind: string, fileName: string, idx?: number) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  const suffix = typeof idx === "number" ? `-${idx}` : ""
  return `picture/responsive/${kind}-${Date.now()}${suffix}-${random}-${normalizeObjectNamePart(fileName)}`
}

async function createResponsiveVariant(file: File, width: number): Promise<File> {
  const variant = await imageCompression(file, {
    maxWidthOrHeight: width,
    useWebWorker: true,
    initialQuality: getResponsiveImageQuality(width),
    maxSizeMB: getResponsiveImageMaxSizeMB(width),
    fileType: "image/webp",
  })

  return new File([variant], `w${width}.webp`, { type: "image/webp" })
}

// 生成预览 URL
async function getImagePreview(file: File): Promise<{ url: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) =>
      resolve({
        url: e.target?.result as string,
        size: file.size,
      })
    reader.readAsDataURL(file)
  })
}

export function PictureSetForm({ onSubmit, editingPictureSet, onCancel, variant = "default" }: PictureSetFormProps) {
  const { t } = useI18n()
  const isPortraitLibrary = variant === "portraitLibrary"
  const { analyzeImage } = useImageAnalysis()
  const looksZh = (s?: string) => /[\u4e00-\u9fff]/.test(String(s || ''))
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverOriginalSize, setCoverOriginalSize] = useState<number>(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string>("")
  const [pictures, setPictures] = useState<PictureFormData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<string | null>(null)
  const [position, setPosition] = useState<string>("up")
  const [isPublished, setIsPublished] = useState<boolean>(true)
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [seasonIds, setSeasonIds] = useState<number[]>([])
  const [sectionIds, setSectionIds] = useState<number[]>([])
  const [availableCategories, setAvailableCategories] = useState<Array<{id:number; name:string}>>([])
  const [availableSeasons, setAvailableSeasons] = useState<Array<{id:number; name:string}>>([])
  const [availableSections, setAvailableSections] = useState<Array<{id:number; name:string}>>([])
  const [primaryLocationName, setPrimaryLocationName] = useState<string>("")
  const [primaryLocationLat, setPrimaryLocationLat] = useState<number | "">("")
  const [primaryLocationLng, setPrimaryLocationLng] = useState<number | "">("")
  const [applySetPropsToPictures, setApplySetPropsToPictures] = useState<boolean>(true)
  const [overrideExistingPictureProps, setOverrideExistingPictureProps] = useState<boolean>(false)
  const [propagateCategoriesToPictures, setPropagateCategoriesToPictures] = useState<boolean>(true)
  const [autoFillLocalesAll, setAutoFillLocalesAll] = useState<boolean>(false)
  const [asyncEnrich, setAsyncEnrich] = useState<boolean>(true)
  const [isBulkTagsGenerating, setIsBulkTagsGenerating] = useState<boolean>(false)
  const [autoGenerateTagsForUntagged, setAutoGenerateTagsForUntagged] = useState<boolean>(true)
  const [showAITrans, setShowAITrans] = useState<boolean>(false)
  // simplified flags per your request
  const [fillMissingFromSet, setFillMissingFromSet] = useState<boolean>(true)
  const [autogenTitlesSubtitles, setAutogenTitlesSubtitles] = useState<boolean>(true)
  const [showPictureTagsEditor, setShowPictureTagsEditor] = useState<{[key:number]: boolean}>({})
  const [customPortraitTagDrafts, setCustomPortraitTagDrafts] = useState<Record<string, string>>({})
  const [sameSeriesUpload, setSameSeriesUpload] = useState<boolean>(true)
  const [seriesTagDraft, setSeriesTagDraft] = useState<string>(() => createDefaultSeriesName())
  const [portraitGroupTags, setPortraitGroupTags] = useState<string[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [isGenerating, setIsGenerating] = useState({
    title: false,
    subtitle: false,
    description: false,
    tags: false,
  })
  const [isTranslatingAll, setIsTranslatingAll] = useState(false)
  const [isTranslatingPic, setIsTranslatingPic] = useState<{[idx:number]: boolean}>({})
  // translations
  const [en, setEn] = useState<{title: string; subtitle: string; description: string}>({ title: "", subtitle: "", description: "" })
  const [zh, setZh] = useState<{title: string; subtitle: string; description: string}>({ title: "", subtitle: "", description: "" })
  
  // simple comma-separated tags input
  const [tagsText, setTagsText] = useState<string>("")
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [showPictureAIAnalysis, setShowPictureAIAnalysis] = useState<{[key: number]: boolean}>({})
  const [showPictureTranslations, setShowPictureTranslations] = useState<{[key: number]: boolean}>({})
  const isHydratingFromEdit = useRef(false)
  // translation autofill touching flags
  const [enTouched, setEnTouched] = useState<{title:boolean; subtitle:boolean; description:boolean}>({ title: false, subtitle: false, description: false })
  const [picEnTouched, setPicEnTouched] = useState<{[idx:number]: { title?: boolean; subtitle?: boolean; description?: boolean }}>({})
  const formRef = useRef<HTMLFormElement>(null)
  const picturesContainerRef = useRef<HTMLDivElement>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const portraitPresetAppliedRef = useRef(false)
  const portraitDraftReadyRef = useRef(false)
  const portraitDraftTimerRef = useRef<number | null>(null)
  // drag-n-drop reorder refs
  const dragItem = useRef<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const movePicture = (from: number, to: number) => {
    if (from === to) return
    setPictures((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(from, 1)
      updated.splice(to, 0, moved)
      return updated
    })
  }

  const handleDragStartThumb = (index: number) => {
    dragItem.current = index
    setDraggingIndex(index)
  }

  const handleDragEnterThumb = (index: number) => {
    if (dragItem.current === null) return
    if (dragItem.current === index) return
    // reorder live while dragging
    movePicture(dragItem.current, index)
    dragItem.current = index
    setDraggingIndex(index)
  }

  const handleDragEndThumb = () => {
    dragItem.current = null
    setDraggingIndex(null)
  }

  const getPortraitFieldOptions = (prefix: string, options: Array<{ value: string; label: string }>) => {
    const dynamicOptions = [
      ...getTagsByPrefix(portraitGroupTags, prefix),
      ...pictures.flatMap((pic) => getTagsByPrefix(pic.tags || [], prefix)),
    ]
      .filter((tag) => !PORTRAIT_HIDDEN_OPTION_TAGS.has(tag))
      .filter((tag) => !options.some((option) => option.value === tag))
      .map((tag) => ({ value: tag, label: getPortraitTagLabel(tag) }))
    const visibleOptions = options.filter((option) => !PORTRAIT_HIDDEN_OPTION_TAGS.has(option.value))
    return [...visibleOptions, ...Array.from(new Map(dynamicOptions.map((option) => [option.value, option])).values())]
  }

  const getCurrentSeriesTag = (value = seriesTagDraft) =>
    sameSeriesUpload ? normalizeCustomPortraitTag("series", value || createDefaultSeriesName()) : ""

  const getActivePortraitGroupTags = (seriesValue = seriesTagDraft) => {
    if (!sameSeriesUpload) return []
    return mergeTagList(portraitGroupTags, [getCurrentSeriesTag(seriesValue)])
  }

  const addPortraitGroupTag = (tag: string) => {
    if (!tag || tag === "none") return
    setPortraitGroupTags((prev) => mergeTagList(prev, [tag]))
    setPictures((prev) =>
      prev.map((pic) => ({
        ...pic,
        tags: mergeTagList(pic.tags || [], [tag]),
      })),
    )
  }

  const addCustomPortraitGroupTag = (prefix: string) => {
    const key = `group:${prefix}`
    const tag = normalizeCustomPortraitTag(prefix, customPortraitTagDrafts[key] || "")
    if (!tag) return
    addPortraitGroupTag(tag)
    setCustomPortraitTagDrafts((prev) => ({
      ...prev,
      [key]: "",
    }))
  }

  const removePortraitGroupTag = (tag: string) => {
    setPortraitGroupTags((prev) => prev.filter((item) => item !== tag))
    setPictures((prev) =>
      prev.map((pic) => ({
        ...pic,
        tags: (pic.tags || []).filter((item) => item !== tag),
      })),
    )
  }

  const addPictureTag = (index: number, tag: string) => {
    if (!tag || tag === "none") return
    setPictures((prev) =>
      prev.map((pic, i) =>
        i === index
          ? {
              ...pic,
              tags: mergeTagList(pic.tags || [], [tag]),
            }
          : pic,
      ),
    )
  }

  const getPortraitPictureDefaultTags = () => {
    const tags = [...PORTRAIT_LIBRARY_PICTURE_DEFAULT_TAGS]
    return mergeTagList(tags, getActivePortraitGroupTags())
  }

  const setCustomPortraitTagDraft = (index: number, prefix: string, value: string) => {
    setCustomPortraitTagDrafts((prev) => ({
      ...prev,
      [`${index}:${prefix}`]: value,
    }))
  }

  const addCustomPortraitTag = (index: number, prefix: string) => {
    const key = `${index}:${prefix}`
    const tag = normalizeCustomPortraitTag(prefix, customPortraitTagDrafts[key] || "")
    if (!tag) return
    addPictureTag(index, tag)
    setCustomPortraitTagDrafts((prev) => ({
      ...prev,
      [key]: "",
    }))
  }

  const removePictureTag = (index: number, tag: string) => {
    setPictures((prev) =>
      prev.map((pic, i) => (i === index ? { ...pic, tags: (pic.tags || []).filter((item) => item !== tag) } : pic)),
    )
  }

  // AI生成函数
  const generateField = async (field: 'title' | 'subtitle' | 'description') => {
    if (!coverPreview) return
    
    setIsGenerating(prev => ({ ...prev, [field]: true }))
    try {
      const result = await analyzeImage(coverPreview, field)
      if (result.success) {
        const val = result.result || ''
        if (field === 'title') setTitle(val)
        if (field === 'subtitle') setSubtitle(val)
        if (field === 'description') setDescription(val)
      }
    } catch (error) {
      console.error(`生成${field}失败:`, error)
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }))
    }
  }

  // 为图片生成字段
  const generatePictureField = async (pictureIndex: number, field: 'title' | 'subtitle' | 'description') => {
    const picture = pictures[pictureIndex]
    if (!picture.previewUrl) return
    
    setIsGenerating(prev => ({ ...prev, [field]: true }))
    try {
      const result = await analyzeImage(picture.previewUrl, field)
      if (result.success) {
        // 先取消该字段的 touched，允许 AI 结果覆盖自动值
        setPicEnTouched(prev => ({
          ...prev,
          [pictureIndex]: { ...(prev[pictureIndex] || {}), [field]: false },
        }))
        handlePictureChange(pictureIndex, field, result.result)
      }
    } catch (error) {
      console.error(`生成图片${pictureIndex + 1}的${field}失败:`, error)
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }))
    }
  }

  const generatePictureTags = async (pictureIndex: number) => {
    const picture = pictures[pictureIndex]
    const src = picture.previewUrl || (picture.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${picture.image_url}` : '')
    if (!src) return
    setIsGenerating(prev => ({ ...prev, tags: true }))
    try {
      const result = await analyzeImage(src, 'tags')
      if (result.success) {
        // Parse bilingual tags in format: "english-tag (中文标签), ..."
        const parts = result.result
          .replace(/\n/g, ',')
          .split(/[,，;；]/)
          .map(s => s.trim())
          .filter(Boolean)
        const generated = Array.from(new Set(parts))
        const current = Array.isArray(picture.tags) ? picture.tags.filter(Boolean) : []
        const union = Array.from(new Set([ ...current, ...generated ]))
        handlePictureChange(pictureIndex, 'tags', union)
      }
    } catch (e) {
      console.error('生成图片标签失败:', e)
    } finally {
      setIsGenerating(prev => ({ ...prev, tags: false }))
    }
  }

  // 生成集合标签（优先使用封面图；没有则用第一张图片）
  const generateTagsForSet = async () => {
    const sourceImage = coverPreview || pictures.find(p => p.previewUrl)?.previewUrl
    if (!sourceImage) return
    setIsGenerating(prev => ({ ...prev, tags: true }))
    try {
      const result = await analyzeImage(sourceImage, 'tags')
      if (result.success) {
        // Parse bilingual tags in format: "english-tag (中文标签), ..."
        const parts = result.result
          .replace(/\n/g, ',')
          .split(/[,，;；]/)
          .map(s => s.trim())
          .filter(Boolean)
        const uniq = Array.from(new Set(parts));
        setTagsText(uniq.join(', '))
      }
    } catch (e) {
      console.error('生成标签失败', e)
    } finally {
      setIsGenerating(prev => ({ ...prev, tags: false }))
    }
  }

  // Track the last loaded editing ID to prevent re-initialization
  const lastLoadedIdRef = useRef<number | null>(null)

  // 编辑模式初始化
  useEffect(() => {
    // preload vocab tables
    const loadVocab = async () => {
      try {
        const preferred = (typeof window !== 'undefined' ? (localStorage.getItem('locale') || 'en') : 'en')
        const res = await adminFetch(`/api/admin/vocab?locale=${encodeURIComponent(preferred)}`)
        const data = await res.json()
        if (res.ok) {
          setAvailableCategories((data?.categories || []).map((c:any)=>({ id: c.id, name: (preferred === 'zh' ? (c.nameCN || c.name) : c.name) })))
          setAvailableSeasons((data?.seasons || []).map((s:any)=>({ id: s.id, name: (preferred === 'zh' ? (s.nameCN || s.name) : s.name) })))
          setAvailableSections((data?.sections || []).map((s:any)=>({ id: s.id, name: (preferred === 'zh' ? (s.nameCN || s.name) : s.name) })))
        }
      } catch (e) {
        console.warn('Load vocab failed', e)
      }
    }
    loadVocab()

    if (editingPictureSet) {
      // Only hydrate if this is a new picture set ID
      if (lastLoadedIdRef.current === editingPictureSet.id) {
        return
      }
      
      lastLoadedIdRef.current = editingPictureSet.id
      isHydratingFromEdit.current = true
      setIsEditMode(true)
      setEditingId(editingPictureSet.id)
      setTitle(editingPictureSet.title || "")
      setSubtitle(editingPictureSet.subtitle || "")
      setDescription(editingPictureSet.description || "")
      setCoverImageUrl(editingPictureSet.cover_image_url || "")
      setCoverPreview(editingPictureSet.cover_image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${editingPictureSet.cover_image_url}` : null)
      setPosition(editingPictureSet.position || "up")
      // translations and tags (optional on type)
      const enData = {
        title: editingPictureSet.en?.title || "",
        subtitle: editingPictureSet.en?.subtitle || "",
        description: editingPictureSet.en?.description || "",
      }
      const zhData = {
        title: editingPictureSet.zh?.title || "",
        subtitle: editingPictureSet.zh?.subtitle || "",
        description: editingPictureSet.zh?.description || "",
      }
      const touchedData = {
        title: !!(editingPictureSet.en?.title && editingPictureSet.en.title.trim()),
        subtitle: !!(editingPictureSet.en?.subtitle && editingPictureSet.en.subtitle.trim()),
        description: !!(editingPictureSet.en?.description && editingPictureSet.en.description.trim()),
      }
      setEn(enData)
      // Mark touched for en fields only if DB provided a non-empty translation
      setEnTouched(touchedData)
      setZh(zhData)
      setTagsText((editingPictureSet.tags || []).join(", "))
      setIsPublished(editingPictureSet.is_published ?? true)
      // 预填分类与季节：直接用后端返回字段，避免客户端读取 RLS 表
      if (Array.isArray((editingPictureSet as any).category_ids) && (editingPictureSet as any).category_ids.length) {
        setCategoryIds([...(editingPictureSet as any).category_ids])
      } else if (editingPictureSet.primary_category_id) {
        setCategoryIds([editingPictureSet.primary_category_id])
      }
      if (editingPictureSet.season_id) setSeasonIds([editingPictureSet.season_id])
      // 预填 sections（由后端详情提供）
      if (Array.isArray((editingPictureSet as any).section_ids)) {
        setSectionIds([...(editingPictureSet as any).section_ids])
      }
      // 预填主位置（由后端详情提供）
      if ((editingPictureSet as any).primary_location_name) setPrimaryLocationName((editingPictureSet as any).primary_location_name)
      if ((editingPictureSet as any).primary_location_latitude != null) setPrimaryLocationLat((editingPictureSet as any).primary_location_latitude)
      if ((editingPictureSet as any).primary_location_longitude != null) setPrimaryLocationLng((editingPictureSet as any).primary_location_longitude)

      if (editingPictureSet.pictures) {
        const initialTouched: {[idx:number]: { title?: boolean; subtitle?: boolean; description?: boolean }} = {}
        const mapped = editingPictureSet.pictures.map((pic, idx) => ({
            id: pic.id,
            title: pic.title || "",
            subtitle: pic.subtitle || "",
            description: pic.description || "",
            style: (pic as any).style ?? null,
            season_id: (pic as any).season_id ?? null,
            location_name: (pic as any).location_name || '',
            location_latitude: (pic as any).location_latitude ?? null,
            location_longitude: (pic as any).location_longitude ?? null,
            picture_category_ids: (pic as any).picture_category_ids || [],
            tags: pic.tags || [],
            en: {
              title: pic.en?.title || "",
              subtitle: pic.en?.subtitle || "",
              description: pic.en?.description || "",
            },
            zh: {
              title: pic.zh?.title || "",
              subtitle: pic.zh?.subtitle || "",
              description: pic.zh?.description || "",
            },
            cover: null,
            previewUrl: pic.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${pic.image_url}` : undefined,
            originalSize: 0,
            compressedSize: undefined,
            image_url: pic.image_url || "",
            image_variants: pic.image_variants || {},
          }))
        // initialize touched map: mark true if DB provided non-empty en.*
        editingPictureSet.pictures.forEach((p, i) => {
          initialTouched[i] = {
            title: !!(p.en?.title && p.en.title.trim()),
            subtitle: !!(p.en?.subtitle && p.en.subtitle.trim()),
            description: !!(p.en?.description && p.en.description.trim()),
          }
        })
        setPictures(mapped)
        setPicEnTouched(initialTouched)
      }
      // 让自动同步 useEffect 在一轮渲染后才开始生效，避免初始化时清空翻译
      setTimeout(() => {
        isHydratingFromEdit.current = false
      }, 0)
    } else if (editingPictureSet === null && (isEditMode || editingId !== undefined)) {
      lastLoadedIdRef.current = null
      isHydratingFromEdit.current = false
      // 只有当明确从编辑模式切换到非编辑模式时才重置表单
      setIsEditMode(false)
      setEditingId(undefined)
      setTitle("")
      setSubtitle("")
      setDescription("")
      setCover(null)
      setCoverPreview(null)
      setCoverOriginalSize(0)
      setCoverImageUrl("")
      setPictures([])
      setPosition("up")
      setIsPublished(true)
      setCategoryIds([])
      setSeasonIds([])
      setSectionIds([])
      setPrimaryLocationName("")
      setPrimaryLocationLat("")
      setPrimaryLocationLng("")
      setEn({ title: "", subtitle: "", description: "" })
      setZh({ title: "", subtitle: "", description: "" })
      setTagsText("")
    }
  }, [editingPictureSet])

  useEffect(() => {
    if (!isPortraitLibrary || editingPictureSet || portraitPresetAppliedRef.current) return
    portraitPresetAppliedRef.current = true
    setTitle("Portrait Booking Samples")
    setSubtitle("Portrait and session-ready portfolio library")
    setDescription("人像约拍样片库。用于按地点、拍摄内容、画面风格、拍摄技法、设备、展示用途和系列标签筛选照片。")
    setTagsText(PORTRAIT_LIBRARY_DEFAULT_TAGS.join(", "))
    setIsPublished(false)
    setFillMissingFromSet(true)
    setPropagateCategoriesToPictures(true)
    setAutoGenerateTagsForUntagged(false)
    setAutogenTitlesSubtitles(false)
    setAsyncEnrich(true)
  }, [editingPictureSet, isPortraitLibrary])

  useEffect(() => {
    if (!isPortraitLibrary || editingPictureSet) return

    let cancelled = false
    const restoreDraft = async () => {
      try {
        const draft = await readPortraitLibraryDraft()
        if (cancelled) return
        if (!draft) {
          portraitDraftReadyRef.current = true
          return
        }

        setTitle(draft.title || "Portrait Booking Samples")
        setSubtitle(draft.subtitle || "Portrait and session-ready portfolio library")
        setDescription(draft.description || "")
        setTagsText(draft.tagsText || PORTRAIT_LIBRARY_DEFAULT_TAGS.join(", "))
        setSameSeriesUpload(draft.sameSeriesUpload ?? true)
        setSeriesTagDraft(draft.seriesTagDraft || createDefaultSeriesName())
        setPortraitGroupTags(Array.isArray(draft.portraitGroupTags) ? draft.portraitGroupTags : [])
        setEn(draft.en || { title: "", subtitle: "", description: "" })
        setZh(draft.zh || { title: "", subtitle: "", description: "" })

        const restoredPictures = await Promise.all(
          (draft.pictures || []).map(async (pic) => {
            const file = pic.cover instanceof File ? pic.cover : null
            if (!file) return { ...pic, cover: null, previewUrl: pic.previewUrl || undefined }
            const preview = await getImagePreview(file)
            return {
              ...pic,
              cover: file,
              previewUrl: preview.url,
              originalSize: preview.size,
              compressedSize: undefined,
              compressedFile: null,
            }
          }),
        )
        if (cancelled) return
        setPictures(restoredPictures)
        if (restoredPictures.length > 0 || draft.portraitGroupTags?.length) {
          setDraftStatus(`已恢复本地草稿：${restoredPictures.length} 张图片`)
        }
      } catch (error) {
        console.warn("Restore portrait draft failed:", error)
        if (!cancelled) setDraftStatus("本地草稿读取失败，请先不要刷新页面。")
      } finally {
        if (!cancelled) portraitDraftReadyRef.current = true
      }
    }

    restoreDraft()
    return () => {
      cancelled = true
    }
  }, [editingPictureSet, isPortraitLibrary])

  useEffect(() => {
    if (!isPortraitLibrary || editingPictureSet || !portraitDraftReadyRef.current) return
    if (portraitDraftTimerRef.current) window.clearTimeout(portraitDraftTimerRef.current)

    portraitDraftTimerRef.current = window.setTimeout(() => {
      const draftPictures = pictures.map((pic) => ({
        ...pic,
        previewUrl: undefined,
        compressedSize: undefined,
        compressedFile: null,
      }))
      const draft: PortraitLibraryDraft = {
        version: 1,
        savedAt: new Date().toISOString(),
        title,
        subtitle,
        description,
        tagsText,
        sameSeriesUpload,
        seriesTagDraft,
        portraitGroupTags,
        pictures: draftPictures,
        en,
        zh,
      }
      savePortraitLibraryDraft(draft)
        .then(() => setDraftStatus(`草稿已自动保存：${pictures.length} 张图片`))
        .catch((error) => {
          console.warn("Save portrait draft failed:", error)
          setDraftStatus("草稿自动保存失败，请先不要刷新页面。")
        })
    }, 700)

    return () => {
      if (portraitDraftTimerRef.current) window.clearTimeout(portraitDraftTimerRef.current)
    }
  }, [
    description,
    editingPictureSet,
    en,
    isPortraitLibrary,
    pictures,
    portraitGroupTags,
    sameSeriesUpload,
    seriesTagDraft,
    subtitle,
    tagsText,
    title,
    zh,
  ])

  // 滚动监听
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollToTop(true)
      } else {
        setShowScrollToTop(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const { url, size } = await getImagePreview(file)
        setCoverPreview(url)
        setCoverOriginalSize(size)
        setCover(file)
        
        // Auto-generate tags when cover is uploaded
        if (url) {
          setTimeout(async () => {
            setIsGenerating(prev => ({ ...prev, tags: true }))
            try {
              const result = await analyzeImage(url, 'tags')
              if (result.success) {
                const parts = result.result
                  .replace(/\n/g, ',')
                  .split(/[,，;；]/)
                  .map(s => s.trim())
                  .filter(Boolean)
                const uniq = Array.from(new Set(parts));
                setTagsText(uniq.join(', '))
              }
            } catch (e) {
              console.error('自动生成标签失败', e)
            } finally {
              setIsGenerating(prev => ({ ...prev, tags: false }))
            }
          }, 100)
        }
      } catch (error) {
        console.error("Error loading cover image:", error)
      }
    }
  }

  const handleAddPicture = () => {
    setPictures([
      ...pictures,
      {
        tempId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        title: "",
        subtitle: "",
        description: "",
        season_id: null,
        location_name: '',
        location_latitude: null,
        location_longitude: null,
        picture_category_ids: [],
        style: null,
        tags: isPortraitLibrary ? getPortraitPictureDefaultTags() : [],
        en: { title: "", subtitle: "", description: "" },
        zh: { title: "", subtitle: "", description: "" },
        cover: null,
        previewUrl: undefined,
        originalSize: 0,
        compressedSize: undefined,
        image_url: "",
      },
    ])
  }

  const addPictureFiles = async (files: File[]) => {
    if (files.length === 0) return

    const toAdd: PictureFormData[] = []
    for (const file of files) {
      try {
        const { url, size } = await getImagePreview(file)
        toAdd.push({
          tempId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          title: "",
          subtitle: "",
          description: "",
          style: null,
          season_id: null,
          location_name: '',
          location_latitude: null,
          location_longitude: null,
          picture_category_ids: [],
          tags: isPortraitLibrary ? getPortraitPictureDefaultTags() : [],
          en: { title: "", subtitle: "", description: "" },
          zh: { title: "", subtitle: "", description: "" },
          cover: file,
          previewUrl: url,
          originalSize: size,
          compressedSize: undefined,
          image_url: "",
        })
      } catch (err) {
        console.error("Preview generation failed:", err)
      }
    }
    if (toAdd.length > 0) setPictures((prev) => [...prev, ...toAdd])
  }

  const handleRemovePicture = (index: number) => {
    setPictures(pictures.filter((_, i) => i !== index))
  }

  const handlePictureChange = (index: number, field: string, value: any) => {
    setPictures((prevPictures) =>
      prevPictures.map((pic, i) => {
        if (i !== index) return pic

        if (field === "cover" && value instanceof File) {
          getImagePreview(value).then(({ url, size }) => {
            setPictures((current) =>
              current.map((p, idx) => (idx === index ? { ...p, previewUrl: url, originalSize: size } : p))
            )
          })
          return { ...pic, cover: value }
        }

        // support nested updates like 'en.title' or 'zh.description'
        if (field.includes('.')) {
          const [root, key] = field.split('.')
          if (root === 'en') {
            return { ...pic, en: { ...(pic.en || {}), [key]: value } }
          }
          if (root === 'zh') {
            return { ...pic, zh: { ...(pic.zh || {}), [key]: value } }
          }
        }

        return { ...pic, [field]: value }
      })
    )
  }

  // --- Translation helpers ---
  const translateText = async (text: string, source: 'zh'|'en'|'auto' = 'zh', target: 'zh'|'en' = 'en'): Promise<string> => {
    try {
      if (!text || !text.trim()) return ''
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang: source, targetLang: target })
      })
      if (!res.ok) return ''
      const data = await res.json()
      return (data.translated as string) || ''
    } catch { return '' }
  }

  const autoTranslatePicture = async (idx: number) => {
    const pic = pictures[idx]
    if (!pic) return
    setIsTranslatingPic(prev => ({ ...prev, [idx]: true }))
    try {
      const toEn: any = { ...(pic.en || {}) }
      const toZh: any = { ...(pic.zh || {}) }
      const touched = picEnTouched[idx] || {}
      
      for (const key of ['title','subtitle','description'] as const) {
        const baseVal = String((pic as any)[key] || '')
        const enVal = String((toEn as any)[key] || '')
        const zhVal = String((toZh as any)[key] || '')
        const originalEn = String(pic.en?.[key] || '')
        const originalZh = String(pic.zh?.[key] || '')
        const baseIsChinese = looksZh(baseVal)
        
        // 如果该字段的英文已被手动编辑过，跳过自动翻译
        const isEnTouched = touched[key]
        
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) (toEn as any)[key] = t
        } else if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) (toZh as any)[key] = t
        } else if (!enVal && !zhVal && baseVal) {
          if (baseIsChinese) {
            (toZh as any)[key] = baseVal
            if (!isEnTouched) {
              const t = await translateText(baseVal, 'auto', 'en')
              if (t) (toEn as any)[key] = t
            }
          } else {
            if (!isEnTouched) (toEn as any)[key] = baseVal
            const t = await translateText(baseVal, 'auto', 'zh')
            if (t) (toZh as any)[key] = t
          }
        }
        // 最后保障：确保两侧都不为空
        const enNow = String((toEn as any)[key] || '')
        const zhNow = String((toZh as any)[key] || '')
        if (!enNow && zhNow && !isEnTouched) {
          const t = await translateText(zhNow, 'auto', 'en')
          if (t) (toEn as any)[key] = t
        }
        if (!zhNow && enNow) {
          const t = await translateText(enNow, 'auto', 'zh')
          if (t) (toZh as any)[key] = t
        }
        const enAfter = String((toEn as any)[key] || '')
        if (!enAfter && !isEnTouched) {
          const fallback = originalEn && !looksZh(originalEn) ? originalEn : !baseIsChinese ? baseVal : ''
          if (fallback && !looksZh(fallback)) (toEn as any)[key] = fallback
        }
        const zhAfter = String((toZh as any)[key] || '')
        if (!zhAfter) {
          const fallbackZh = originalZh && looksZh(originalZh) ? originalZh : baseIsChinese ? baseVal : ''
          if (fallbackZh && looksZh(fallbackZh)) (toZh as any)[key] = fallbackZh
        }
      }
      const updatedPicTouch: { title?: boolean; subtitle?: boolean; description?: boolean } = {}
      for (const key of ['title','subtitle','description'] as const) {
        const finalVal = String((toEn as any)[key] || '')
        if (finalVal && !looksZh(finalVal)) {
          updatedPicTouch[key] = true
        }
      }
      if (Object.keys(updatedPicTouch).length) {
        setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...updatedPicTouch } }))
      }
      setPictures(prev => prev.map((p, i) => i === idx ? { ...p, en: toEn, zh: toZh } : p))
      // 标记已生成的英文内容为 touched，防止后续基础字段的自动同步把它们清空
    } finally {
      setIsTranslatingPic(prev => ({ ...prev, [idx]: false }))
    }
  }

  const completeTitleSubtitleTranslations = async (
    baseVals: { title: string; subtitle: string; description: string },
    currentEn: { title: string; subtitle: string; description: string },
    currentZh: { title: string; subtitle: string; description: string },
  ) => {
    const nextEn = { ...currentEn }
    const nextZh = { ...currentZh }
    for (const key of ['title', 'subtitle'] as const) {
      const baseVal = String(baseVals[key] || '').trim()
      let enVal = String(nextEn[key] || '').trim()
      let zhVal = String(nextZh[key] || '').trim()
      if (!enVal && !zhVal && baseVal) {
        if (looksZh(baseVal)) {
          zhVal = baseVal
          enVal = await translateText(baseVal, 'auto', 'en')
        } else {
          enVal = baseVal
          zhVal = await translateText(baseVal, 'auto', 'zh')
        }
      }
      if (!enVal && zhVal) {
        enVal = await translateText(zhVal, 'auto', 'en')
      }
      if (!zhVal && enVal) {
        zhVal = await translateText(enVal, 'auto', 'zh')
      }
      nextEn[key] = enVal
      nextZh[key] = zhVal
    }
    return { en: nextEn, zh: nextZh }
  }

  const completePictureTitleSubtitleTranslations = async (pic: PictureFormData) => {
    const base = {
      title: String(pic.title || ''),
      subtitle: String(pic.subtitle || ''),
      description: String(pic.description || ''),
    }
    const currentEn = {
      title: String(pic.en?.title || ''),
      subtitle: String(pic.en?.subtitle || ''),
      description: String(pic.en?.description || ''),
    }
    const currentZh = {
      title: String(pic.zh?.title || ''),
      subtitle: String(pic.zh?.subtitle || ''),
      description: String(pic.zh?.description || ''),
    }
    const filled = await completeTitleSubtitleTranslations(base, currentEn, currentZh)
    return {
      ...pic,
      en: { ...pic.en, ...filled.en },
      zh: { ...pic.zh, ...filled.zh },
    }
  }

  const autoTranslateAll = async (forceTranslate = false): Promise<{ en: typeof en; zh: typeof zh; pictures: typeof pictures }> => {
    setIsTranslatingAll(true)
    console.log('🚀 autoTranslateAll called with forceTranslate:', forceTranslate)
    try {
      const nextEn = { ...en }
      const nextZh = { ...zh }
      const updatedSetTouches: Partial<typeof enTouched> = {}
      const nextPicTouches: { [idx: number]: { title?: boolean; subtitle?: boolean; description?: boolean } } = {}
      for (const key of ['title','subtitle','description'] as const) {
        const baseVal = String((key === 'title' ? title : key === 'subtitle' ? subtitle : description) || '')
        let enVal = String(nextEn[key] || '')
        let zhVal = String(nextZh[key] || '')
        const existingEn = String((en as any)[key] || '')
        const existingZh = String((zh as any)[key] || '')
        const baseIsChinese = looksZh(baseVal)
        
        console.log(`🔍 Processing ${key}:`, { baseVal, enVal, zhVal, existingEn, existingZh })
        
        // forceTranslate=true 表示用户勾选了"自动补全"，强制翻译所有内容
        const isEnTouched = forceTranslate ? false : enTouched[key]
        console.log(`   isEnTouched for ${key}:`, isEnTouched, '(forceTranslate:', forceTranslate, ')')

        if (!enVal && zhVal && !isEnTouched) {
          console.log(`   🌐 Translating ${key} from zh to en:`, zhVal)
          const t = await translateText(zhVal, 'auto', 'en')
          console.log(`   ✅ Translation result:`, t)
          if (t) enVal = t
        } else if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        } else if (!enVal && !zhVal && baseVal) {
          if (baseIsChinese) {
            zhVal = baseVal
            if (!isEnTouched) {
              const t = await translateText(baseVal, 'auto', 'en')
              if (t) enVal = t
            }
          } else {
            if (!isEnTouched) enVal = baseVal
            const t = await translateText(baseVal, 'auto', 'zh')
            if (t) zhVal = t
          }
        }
        // 最后保障：两侧都不为空
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) enVal = t
        }
        if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        }
        if (!enVal && !isEnTouched) {
          if (existingEn && !looksZh(existingEn)) enVal = existingEn
          else if (!baseIsChinese) enVal = baseVal
        }
        if (!zhVal) {
          if (existingZh) zhVal = existingZh
          else if (baseIsChinese) zhVal = baseVal
        }
        nextEn[key] = enVal
        nextZh[key] = zhVal
        if (enVal && !looksZh(enVal)) {
          updatedSetTouches[key] = true
        }
        console.log(`   📝 Final values for ${key}:`, { enVal, zhVal })
      }
      setEn(nextEn)
      setZh(nextZh)
      if (Object.keys(updatedSetTouches).length) {
        setEnTouched(prev => ({ ...prev, ...updatedSetTouches }))
      }
      console.log('✅ SET translation complete - nextEn:', nextEn, 'nextZh:', nextZh)

      // 翻译所有图片并收集结果
      const nextPictures = [...pictures]
      for (let i = 0; i < nextPictures.length; i++) {
        const pic = nextPictures[i]
        if (!pic) continue
        
        const toEn: any = { ...(pic.en || {}) }
        const toZh: any = { ...(pic.zh || {}) }
  const touched = picEnTouched[i] || {}
        
        for (const key of ['title','subtitle','description'] as const) {
          const baseVal = String((pic as any)[key] || '')
          const enVal = String((toEn as any)[key] || '')
          const zhVal = String((toZh as any)[key] || '')
          const originalEn = String(pic.en?.[key] || '')
          const originalZh = String(pic.zh?.[key] || '')
          const baseIsChinese = looksZh(baseVal)
          
          const isEnTouched = forceTranslate ? false : touched[key]
          
          if (!enVal && zhVal && !isEnTouched) {
            const t = await translateText(zhVal, 'auto', 'en')
            if (t) (toEn as any)[key] = t
          } else if (!zhVal && enVal) {
            const t = await translateText(enVal, 'auto', 'zh')
            if (t) (toZh as any)[key] = t
          } else if (!enVal && !zhVal && baseVal) {
            if (baseIsChinese) {
              (toZh as any)[key] = baseVal
              if (!isEnTouched) {
                const t = await translateText(baseVal, 'auto', 'en')
                if (t) (toEn as any)[key] = t
              }
            } else {
              if (!isEnTouched) (toEn as any)[key] = baseVal
              const t = await translateText(baseVal, 'auto', 'zh')
              if (t) (toZh as any)[key] = t
            }
          }
          const enNow = String((toEn as any)[key] || '')
          const zhNow = String((toZh as any)[key] || '')
          if (!enNow && zhNow && !isEnTouched) {
            const t = await translateText(zhNow, 'auto', 'en')
            if (t) (toEn as any)[key] = t
          }
          if (!zhNow && enNow) {
            const t = await translateText(enNow, 'auto', 'zh')
            if (t) (toZh as any)[key] = t
          }
          const enAfter = String((toEn as any)[key] || '')
          if (!enAfter && !isEnTouched) {
            const fallback = originalEn && !looksZh(originalEn) ? originalEn : !baseIsChinese ? baseVal : ''
            if (fallback && !looksZh(fallback)) (toEn as any)[key] = fallback
          }
          const zhAfter = String((toZh as any)[key] || '')
          if (!zhAfter) {
            const fallbackZh = originalZh && looksZh(originalZh) ? originalZh : baseIsChinese ? baseVal : ''
            if (fallbackZh && looksZh(fallbackZh)) (toZh as any)[key] = fallbackZh
          }
        }
        const picTouch: { title?: boolean; subtitle?: boolean; description?: boolean } = {}
        for (const key of ['title','subtitle','description'] as const) {
          const finalVal = String((toEn as any)[key] || '')
          if (finalVal && !looksZh(finalVal)) {
            picTouch[key] = true
          }
        }
        if (Object.keys(picTouch).length) {
          nextPicTouches[i] = picTouch
        }
        nextPictures[i] = { ...pic, en: toEn, zh: toZh }
      }
      setPictures(nextPictures)
      if (Object.keys(nextPicTouches).length) {
        setPicEnTouched(prev => {
          const merged = { ...prev }
          for (const [idxStr, touch] of Object.entries(nextPicTouches)) {
            const idx = Number(idxStr)
            merged[idx] = { ...(merged[idx] || {}), ...touch }
          }
          return merged
        })
      }
      
      return { en: nextEn, zh: nextZh, pictures: nextPictures }
    } finally {
      setIsTranslatingAll(false)
    }
  }

  // 仅翻译集合的标题/副标题/描述
  const autoTranslateSetOnly = async () => {
    setIsTranslatingAll(true)
    try {
      const nextEn = { ...en }
      const nextZh = { ...zh }
      const updatedSetTouches: Partial<typeof enTouched> = {}
      for (const key of ['title','subtitle','description'] as const) {
        const baseVal = String((key === 'title' ? title : key === 'subtitle' ? subtitle : description) || '')
        let enVal = String(nextEn[key] || '')
        let zhVal = String(nextZh[key] || '')
        const existingEn = String((en as any)[key] || '')
        const existingZh = String((zh as any)[key] || '')
        const baseIsChinese = looksZh(baseVal)
        
        // 如果英文字段已被手动编辑过，跳过自动翻译该字段
        const isEnTouched = enTouched[key]
        
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) enVal = t
        } else if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        } else if (!enVal && !zhVal && baseVal) {
          if (looksZh(baseVal)) {
            zhVal = baseVal
            if (!isEnTouched) {
              const t = await translateText(baseVal, 'auto', 'en')
              if (t) enVal = t
            }
          } else {
            if (!isEnTouched) enVal = baseVal
            const t = await translateText(baseVal, 'auto', 'zh')
            if (t) zhVal = t
          }
        }
        // 最后保障：两侧都不为空
        if (!enVal && zhVal && !isEnTouched) {
          const t = await translateText(zhVal, 'auto', 'en')
          if (t) enVal = t
        }
        if (!zhVal && enVal) {
          const t = await translateText(enVal, 'auto', 'zh')
          if (t) zhVal = t
        }
        if (!enVal && !isEnTouched) {
          if (existingEn && !looksZh(existingEn)) enVal = existingEn
          else if (!baseIsChinese) enVal = baseVal
        }
        if (!zhVal) {
          if (existingZh) zhVal = existingZh
          else if (baseIsChinese) zhVal = baseVal
        }
        nextEn[key] = enVal
        nextZh[key] = zhVal
        if (enVal && !looksZh(enVal)) {
          updatedSetTouches[key] = true
        }
      }
      setEn(nextEn)
      setZh(nextZh)
      if (Object.keys(updatedSetTouches).length) {
        setEnTouched(prev => ({ ...prev, ...updatedSetTouches }))
      }
    } finally {
      setIsTranslatingAll(false)
    }
  }

  // 一键为无标签图片生成标签
  // 批量为无标签图片生成标签：返回最新 pictures 数组，避免批量生成后 setState 尚未同步导致 payload 丢失
  const generateTagsForUntaggedPictures = async (sourcePictures = pictures): Promise<typeof pictures> => {
    setIsBulkTagsGenerating(true)
    let next = [...sourcePictures]
    try {
      for (let i = 0; i < next.length; i++) {
        const p = next[i]
        if (!p || (Array.isArray(p.tags) && p.tags.length > 0)) continue
        const src = p.previewUrl || (p.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${p.image_url}` : '')
        if (!src) continue
        try {
          const result = await analyzeImage(src, 'tags')
          if (result.success) {
            const parts = result.result.replace(/\n/g, ',').split(/[,，;；]/).map(s => s.trim()).filter(Boolean)
            const generated = Array.from(new Set(parts.map(s => s.toLowerCase())))
            const current = Array.isArray(p.tags) ? p.tags.map(s => s.trim().toLowerCase()).filter(Boolean) : []
            const union = Array.from(new Set([ ...current, ...generated ]))
            next[i] = { ...p, tags: union }
          }
        } catch (e) {
          console.error('批量生成标签失败:', e)
        }
      }
      setPictures(next)
      return next
    } finally {
      setIsBulkTagsGenerating(false)
    }
  }

  // dynamic autofill for set-level translations: follow base fields until user manually edits en.*
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("管理员登录状态已过期，请重新登录后再保存。")
      }

      // 根据选项，自动补齐集合与图片语种，并获取翻译后的值
      let translatedEn = en
      let translatedZh = zh
      let picturesForPayload = pictures

      if (autogenTitlesSubtitles) {
        const completedSet = await completeTitleSubtitleTranslations(
          {
            title: String(title || ''),
            subtitle: String(subtitle || ''),
            description: String(description || ''),
          },
          {
            title: String(translatedEn.title || ''),
            subtitle: String(translatedEn.subtitle || ''),
            description: String(translatedEn.description || ''),
          },
          {
            title: String(translatedZh.title || ''),
            subtitle: String(translatedZh.subtitle || ''),
            description: String(translatedZh.description || ''),
          },
        )
        translatedEn = completedSet.en
        translatedZh = completedSet.zh
        picturesForPayload = await Promise.all(
          picturesForPayload.map((pic) => completePictureTitleSubtitleTranslations(pic)),
        )
        setEn(translatedEn)
        setZh(translatedZh)
        setPictures(picturesForPayload)
      }
      
      // 为未设置标签的图片自动生成标签（与现有标签做并集），并使用返回的 next 数组继续构造 payload，避免批量生成后 state 未同步
      if (autoGenerateTagsForUntagged && !asyncEnrich) {
        picturesForPayload = await generateTagsForUntaggedPictures(picturesForPayload)
      }
      // Debug: log intended picture order before upload/submit
      try {
        const debugOrder = pictures.map((p, i) => ({ idx: i, id: (p as any).id, image_url: p.image_url, title: p.title }))
        console.log('Submitting pictures order (top->bottom):', debugOrder)
      } catch {}

      // Upload through our own admin API so browser-side R2/CORS failures cannot drop the draft.
      const uploadFile = async (file: File, objectName: string): Promise<string> => {
        try {
          const body = new FormData()
          body.set("objectName", objectName)
          body.set("contentType", file.type || "application/octet-stream")
          body.set("file", file)

          const res = await adminFetch("/api/upload-to-r2", {
            method: "POST",
            body,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(data?.error || `上传接口返回 ${res.status}`)
          }
          return data?.imageUrl || `/${objectName}`
        } catch (error: any) {
          console.error(`Error uploading file ${file.name}:`, error)
          throw new Error(`上传 ${file.name} 失败：${error?.message || "网络请求失败"}`)
        }
      }

      const uploadResponsiveImage = async (
        file: File,
        kind: "cover" | "image",
        idx?: number,
      ): Promise<{ imageUrl: string; variants: Record<string, string>; displaySize?: number }> => {
        const prefix = createResponsiveImagePrefix(kind, file.name, idx)
        const originalObjectName = `${prefix}/original${getOriginalExtension(file)}`
        const variants: Record<string, string> = {}

        try {
          const originalUploadPromise = uploadFile(file, originalObjectName)
          let displaySize: number | undefined

          for (const width of RESPONSIVE_IMAGE_WIDTHS) {
            const variant = await createResponsiveVariant(file, width)
            const url = await uploadFile(variant, `${prefix}/w${width}.webp`)
            variants[String(width)] = url
            if (width === RESPONSIVE_PRIMARY_WIDTH) {
              displaySize = variant.size
            }
          }

          const originalUrl = await originalUploadPromise
          variants.original = originalUrl

          return { imageUrl: originalUrl, variants, displaySize }
        } catch (error) {
          console.error(`Error creating responsive variants for ${file.name}, falling back to original image:`, error)
          const fallbackUrl = await uploadFile(file, originalObjectName)
          return {
            imageUrl: fallbackUrl,
            variants: { original: fallbackUrl },
          }
        }
      }

      // Cover upload (if provided)
      let coverKey = coverImageUrl
      let coverImageVariants = editingPictureSet?.cover_image_variants || {}
      if (cover) {
        const { imageUrl, variants } = await uploadResponsiveImage(cover, "cover")
        coverKey = imageUrl
        coverImageVariants = variants
      }

      // Pictures: upload raw and responsive display variants if a new file provided
      const processedPictures = await Promise.all(
        picturesForPayload.map(async (pic, idx) => {
          let image_url = pic.image_url || ""
          let raw_image_url = pic.raw_image_url || ""
          let image_variants = pic.image_variants || {}

          if (pic.cover instanceof File) {
            const responsiveUploadPromise = uploadResponsiveImage(pic.cover, "image", idx)
            const { imageUrl, variants, displaySize } = await responsiveUploadPromise
            image_url = imageUrl
            raw_image_url = variants.original || imageUrl
            image_variants = variants
            // update UI display variant size (non-blocking)
            setPictures((current) =>
              current.map((p, i) =>
                i === idx
                  ? { ...p, compressedSize: displaySize }
                  : p,
              ),
            )
          }

          return {
            id: pic.id,
            title: pic.title,
            subtitle: pic.subtitle,
            description: pic.description,
            style: (pic as any).style ?? null,
            season_id: (pic as any).season_id ?? null,
            location_name: (pic as any).location_name || undefined,
            location_latitude: (pic as any).location_latitude ?? null,
            location_longitude: (pic as any).location_longitude ?? null,
            picture_category_ids: (pic as any).picture_category_ids || [],
            tags: pic.tags,
            en: pic.en,
            zh: pic.zh,
            image_url,
            raw_image_url,
            image_variants,
          }
        }),
      )

      // Optionally apply set-level season/location to pictures if missing
      const propagatedPictures = processedPictures.map((p, idx) => {
        // Backward flags preserved; prefer simplified flag for behavior
        const allowApply = applySetPropsToPictures || fillMissingFromSet
        if (!allowApply) return p
        let season_id = p.season_id
        if (seasonIds.length === 1) {
          if (overrideExistingPictureProps || season_id == null) season_id = seasonIds[0]
        }
        let location_name = p.location_name
        let location_latitude = p.location_latitude
        let location_longitude = p.location_longitude
        const hasPicLoc = !!(location_name) || (typeof location_latitude === 'number' && typeof location_longitude === 'number')
        const hasSetLoc = !!primaryLocationName || (typeof primaryLocationLat === 'number' && typeof primaryLocationLng === 'number')
        if (hasSetLoc) {
          if (overrideExistingPictureProps || !hasPicLoc) {
            location_name = primaryLocationName || undefined
            location_latitude = typeof primaryLocationLat === 'number' ? primaryLocationLat : null
            location_longitude = typeof primaryLocationLng === 'number' ? primaryLocationLng : null
          }
        }
        return { ...p, season_id, location_name, location_latitude, location_longitude }
      })

      // Derive position from selected sections (keeps existing layout logic working)
      const selectedSectionNames = availableSections
        .filter(s => sectionIds.includes(s.id))
        .map(s => (s.name || '').toLowerCase().trim())
      const hasDown = selectedSectionNames.some(n => /\bdown\b|bottom|下|底/.test(n))
      const hasUp = selectedSectionNames.some(n => /\bup\b|top|上|顶/.test(n))
      const derivedPosition = hasDown ? 'down' : (hasUp ? 'up' : 'up')

      console.log('📦 Building payload with translatedEn:', translatedEn, 'translatedZh:', translatedZh)

      const payload: PictureSetSubmitData = {
        title,
        subtitle,
        description,
        position: derivedPosition,
        cover_image_url: coverKey,
        cover_image_variants: coverImageVariants,
        pictures: propagatedPictures,
        is_published: isPublished,
        // keep single fields for backward compatibility but prefer multi
        primary_category_id: categoryIds.length ? categoryIds[0] : null,
        season_id: seasonIds.length ? seasonIds[0] : null,
        category_ids: categoryIds,
        season_ids: seasonIds,
        section_ids: sectionIds,
        primary_location_name: primaryLocationName || undefined,
        primary_location_latitude: typeof primaryLocationLat === 'number' ? primaryLocationLat : null,
        primary_location_longitude: typeof primaryLocationLng === 'number' ? primaryLocationLng : null,
        en: translatedEn,
        zh: translatedZh,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        apply_set_props_to_pictures: applySetPropsToPictures,
        override_existing_picture_props: overrideExistingPictureProps,
        propagate_categories_to_pictures: propagateCategoriesToPictures,
        fill_missing_from_set: fillMissingFromSet,
        autogen_titles_subtitles: autogenTitlesSubtitles,
        async_enrich: asyncEnrich,
        auto_generate_tags_untagged: autoGenerateTagsForUntagged,
        auto_fill_locales_all: autoFillLocalesAll,
      }

      await onSubmit(payload, editingId ?? editingPictureSet?.id)
      if (isPortraitLibrary) {
        await clearPortraitLibraryDraft()
        setDraftStatus("已入库，草稿已清除。")
      }
      
      // 表单重置逻辑由父组件通过 editingPictureSet 的变化来触发
    } catch (error) {
      console.error("Error submitting form:", error)
      const message = error instanceof Error ? error.message : "保存失败，请检查登录状态或图片文件后重试。"
      setSubmitError(message)
      toast({
        title: isPortraitLibrary ? "保存失败" : t("error"),
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatSize = (b: number) => {
    return b < 1024
      ? b + " B"
      : b < 1048576
      ? (b / 1024).toFixed(2) + " KB"
      : (b / 1048576).toFixed(2) + " MB"
  }

  const renderAddPictureControls = () => (
    <div className={isPortraitLibrary ? "flex flex-wrap items-center gap-2" : "flex flex-col sm:flex-row items-center justify-center gap-3 py-6"}>
      {isPortraitLibrary && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#ded4c6] bg-white px-2 py-1.5">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-xs font-medium text-[#4e493f]">
              <input
                type="checkbox"
                checked={sameSeriesUpload}
                onChange={(event) => {
                  const checked = event.target.checked
                  setSameSeriesUpload(checked)
                  if (checked) {
                    const nextSeries = seriesTagDraft.trim() || createDefaultSeriesName()
                    setSeriesTagDraft(nextSeries)
                    const groupTags = mergeTagList(portraitGroupTags, [normalizeCustomPortraitTag("series", nextSeries)])
                    setPictures((prev) =>
                      prev.map((pic) => ({
                        ...pic,
                        tags: mergeTagList(pic.tags || [], groupTags),
                      })),
                    )
                  }
                }}
              />
              本次导入同一组
            </label>
            <p className="text-[11px] leading-4 text-[#8c8172]">
              整组 tag 会打到所有图片，单张图片可以继续微调。
            </p>
          </div>
          <Input
            value={seriesTagDraft}
            onChange={(event) => {
              const previousTag = getCurrentSeriesTag()
              const nextValue = event.target.value
              const nextTag = normalizeCustomPortraitTag("series", nextValue || createDefaultSeriesName())
              setSeriesTagDraft(nextValue)
              if (sameSeriesUpload) {
                setPictures((prev) =>
                  prev.map((pic) => ({
                    ...pic,
                    tags: mergeTagList(
                      (pic.tags || []).filter((tag) => tag !== previousTag),
                      [nextTag],
                    ),
                  })),
                )
              }
            }}
            disabled={!sameSeriesUpload}
            placeholder="组名，如 florence-walk-01"
            className="h-8 w-48 bg-white text-xs"
          />
        </div>
      )}
      <Button
        type="button"
        onClick={() => bulkInputRef.current?.click()}
        variant={isPortraitLibrary ? "default" : "outline"}
        className={
          isPortraitLibrary
            ? "bg-[#20231f] text-white hover:bg-[#2b302a]"
            : "flex items-center gap-2 px-6 py-3 border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
        }
      >
        <Plus className="h-4 w-4" />
        选择图片
      </Button>
      {isPortraitLibrary && (
        <Button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          variant="outline"
          className="border-[#20231f] text-[#20231f] hover:bg-[#f2eadb]"
        >
          <FolderOpen className="h-4 w-4" />
          选择文件夹
        </Button>
      )}
      <Button
        type="button"
        onClick={handleAddPicture}
        variant="outline"
        className={
          isPortraitLibrary
            ? "border-[#ded4c6] text-[#4e493f] hover:bg-[#f7f3ec]"
            : "flex items-center gap-2 px-6 py-3 border-2 border-dashed border-purple-300 text-purple-600 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200"
        }
      >
        <Plus className="h-4 w-4" />
        {isPortraitLibrary ? "空白图片" : t('addImageBtn')}
      </Button>
      <input
        ref={bulkInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          await addPictureFiles(files)
          if (e.target) e.target.value = ""
        }}
      />
      {isPortraitLibrary && (
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          {...({ webkitdirectory: "", directory: "" } as any)}
          onChange={async (e) => {
            const files = Array.from(e.target.files || [])
            await addPictureFiles(files)
            if (e.target) e.target.value = ""
          }}
        />
      )}
    </div>
  )

  const renderPortraitGroupTagControls = () => {
    if (!isPortraitLibrary || !sameSeriesUpload) return null

    const activeGroupTags = getActivePortraitGroupTags()

    return (
      <div className="rounded-md border border-[#ded4c6] bg-white p-3">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#20231f]">整组 tag</h3>
            <p className="text-xs leading-5 text-[#8c8172]">
              这里选择的是这一组照片共同拥有的 tag，会自动加到所有图片；单张图片下面再做个别调整。
            </p>
          </div>
          <span className="text-xs font-medium text-[#8c8172]">{activeGroupTags.length} 个整组 tag</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PORTRAIT_GROUP_TAG_FIELDS.map((field) => {
            const selectedTags = getTagsByPrefix(portraitGroupTags, field.prefix)
            const draftKey = `group:${field.prefix}`
            const draftValue = customPortraitTagDrafts[draftKey] || ""
            const fieldOptions = getPortraitFieldOptions(field.prefix, field.options)

            return (
              <div key={field.prefix} className="space-y-2 rounded-md border border-[#e5dccf] bg-[#fbfaf7] p-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-[#4e493f]">{field.label}</Label>
                  <span className="text-[11px] text-[#8c8172]">{selectedTags.length} 个</span>
                </div>
                <Select value="" onValueChange={(value) => addPortraitGroupTag(value)}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder={`添加${field.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((option) => {
                      const alreadySelected = selectedTags.includes(option.value)
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          {alreadySelected ? "✓ " : ""}{option.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <div className="flex gap-1.5">
                  <Input
                    value={draftValue}
                    onChange={(event) =>
                      setCustomPortraitTagDrafts((prev) => ({
                        ...prev,
                        [draftKey]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        addCustomPortraitGroupTag(field.prefix)
                      }
                    }}
                    placeholder={`自定义${field.label}`}
                    className="h-8 bg-white text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCustomPortraitGroupTag(field.prefix)}
                    className="h-8 w-8 shrink-0 px-0"
                    title={`添加整组${field.label}`}
                  >
                    +
                  </Button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removePortraitGroupTag(tag)}
                        className="rounded-full bg-[#f2eadb] px-2 py-0.5 text-[11px] font-medium text-[#4e493f] hover:bg-[#e4d7c3]"
                        title="从整组移除"
                      >
                        {tag.replace(`${field.prefix}:`, "")} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {activeGroupTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeGroupTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#ded4c6] bg-[#fbfaf7] px-2.5 py-1 text-xs font-medium text-[#4e493f]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{isPortraitLibrary ? "图片标签库" : isEditMode ? t('editSet') : t('createSet')}</h2>
        {isEditMode && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancelEdit')}
          </Button>
        )}
      </div>

      {isPortraitLibrary && (
        <div className="space-y-3 rounded-md border border-[#ded4c6] bg-[#fbfaf7] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-[#4e493f]">
              {pictures.length > 0 ? `${pictures.length} 张图片` : "先设置整组 tag 或导入图片"}
            </div>
            {renderAddPictureControls()}
          </div>
          {draftStatus && (
            <p className="rounded-md border border-[#ded4c6] bg-white px-3 py-2 text-xs text-[#6f6659]">
              {draftStatus}
            </p>
          )}
          {renderPortraitGroupTagControls()}
        </div>
      )}

      {/* 顶部区域：三列布局（字段+翻译 | 封面 | 其它属性） */}
      {!isPortraitLibrary && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 第一列：基础字段 + 翻译 */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold">{t('setDetails')}</h3>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="title">{t('title')}</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => generateField('title')}
                  disabled={isGenerating.title}
                  title={t('aiGenerateTitle')}
                >
                  {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="subtitle">{t('subtitle')}</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => generateField('subtitle')}
                  disabled={isGenerating.subtitle}
                  title={t('aiGenerateSubtitle')}
                >
                  {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="description">{t('description')}</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => generateField('description')}
                  disabled={isGenerating.description}
                  title={t('aiGenerateDescription')}
                >
                  {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          
          {/* 翻译（常显） */}
          <div className="grid grid-cols-2 gap-4 border border-gray-200 rounded-lg p-3">
            <div className="col-span-2">
              <h3 className="text-lg font-bold">{t('translations')}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t('englishLabel')}</Label>
              </div>
              <Input placeholder="English title" value={en.title}
                    onChange={(e) => { setEnTouched((t)=>({ ...t, title: true })); setEn((prev) => ({ ...prev, title: e.target.value })) }} />
              <Input placeholder="English subtitle" value={en.subtitle}
                    onChange={(e) => { setEnTouched((t)=>({ ...t, subtitle: true })); setEn((prev) => ({ ...prev, subtitle: e.target.value })) }} />
              <Textarea placeholder="English description" value={en.description}
                        onChange={(e) => { setEnTouched((t)=>({ ...t, description: true })); setEn((prev) => ({ ...prev, description: e.target.value })) }} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">{t('chineseLabel')}</Label>
              </div>
              <Input placeholder="Chinese title" value={zh.title}
                    onChange={(e) => setZh((prev) => ({ ...prev, title: e.target.value }))} />
              <Input placeholder="Chinese subtitle" value={zh.subtitle}
                    onChange={(e) => setZh((prev) => ({ ...prev, subtitle: e.target.value }))} />
              <Textarea placeholder="Chinese description" value={zh.description}
                        onChange={(e) => setZh((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
          </div>
        </div>
        {/* 第二列：封面预览 */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold">{t('coverImage')}</h3>
          {coverPreview ? (
            <div className="mt-2 mb-4">
              <div 
                className="relative w-full overflow-hidden rounded-md border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors group"
                onClick={() => document.getElementById('cover-input')?.click()}
                title="Click to change cover image"
              >
                <img
                  src={coverPreview || "/placeholder.svg"}
                  alt="Cover preview"
                  className="w-full max-h-80 object-contain group-hover:opacity-90 transition-opacity"
                  style={{
                    aspectRatio: 'auto'
                  }}
                />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 px-3 py-1 rounded-md text-sm font-medium text-gray-700">
                  {t('clickToChangeImage')}
                </div>
              </div>
              </div>
              {coverOriginalSize > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  {t('originalSize')} {formatSize(coverOriginalSize)}
                  {" • 640/1280 WebP + original"}
                </p>
              )}
            </div>
          ) : (
            <div 
              className="mt-2 mb-4 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
              onClick={() => document.getElementById('cover-input')?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center transition-colors">
                  <Camera className="h-6 w-6 text-gray-400 group-hover:text-blue-500" />
                </div>
                <div>
                  <p className="text-gray-600 font-medium">{t('clickToUploadCover')}</p>
                  <p className="text-sm text-gray-400">{t('supportsFormats')}</p>
                </div>
              </div>
            </div>
          )}
          <input 
            id="cover-input"
            type="file" 
            accept="image/*" 
            onChange={handleCoverChange}
            className="hidden"
          />
          {/* Options moved under cover */}
          <div className="flex flex-col gap-2 pt-3 border-t">
            <h4 className="text-base font-bold">{t('options')}</h4>
            <label className="flex items-center gap-2 text-sm">
              <input id="fill_missing_from_set" type="checkbox" checked={fillMissingFromSet} onChange={(e)=>setFillMissingFromSet(e.target.checked)} />
              <span>{t('optionsFillMissing')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="async_enrich" type="checkbox" checked={asyncEnrich} onChange={(e)=>setAsyncEnrich(e.target.checked)} />
              <span>{t('asyncEnrich')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="propagate_categories_to_pictures" type="checkbox" checked={propagateCategoriesToPictures} onChange={(e)=>setPropagateCategoriesToPictures(e.target.checked)} />
              <span>{t('optionsPropagateCategories')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="auto_generate_tags_untagged" type="checkbox" checked={autoGenerateTagsForUntagged} onChange={(e)=>setAutoGenerateTagsForUntagged(e.target.checked)} />
              <span>{t('generateTagsForUntagged')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="autogen_titles_subtitles" type="checkbox" checked={autogenTitlesSubtitles} onChange={(e)=>setAutogenTitlesSubtitles(e.target.checked)} />
              <span>{t('optionsAutogenTitles')}</span>
            </label>
          </div>

          {/* Cover AI tools moved here under cover */}
          {coverPreview && (
            <div className="border-t pt-3">
              <h4 className="text-base font-bold mb-2">{t('aiToolsCover')}</h4>
              <ImageAnalysisComponent
                imageUrl={coverPreview}
                onResultUpdate={(field, result) => {
                  const val = result || ''
                  if (field === 'title') setTitle(val)
                  if (field === 'subtitle') setSubtitle(val)
                  if (field === 'description') setDescription(val)
                }}
              />
            </div>
          )}
        </div>
        {/* 第三列：其它属性（AI、发布、分类、季节、区块、位置、标签、选项） */}
        <div className="space-y-4">
          {/* Publish */}
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">{t('properties')}</h3>
          </div>
          <div className="flex items-center gap-3 border rounded-md px-3 py-2">
            <input id="is_published" type="checkbox" checked={isPublished} onChange={(e)=>setIsPublished(e.target.checked)} />
            <Label htmlFor="is_published">{t('published')}</Label>
          </div>

          {/* Categories */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">{t('categories')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('examplesCategoriesHelp')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {availableCategories.map(c => {
                const checked = categoryIds.includes(c.id)
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        setCategoryIds(prev => e.target.checked ? Array.from(new Set([...prev, c.id])) : prev.filter(id=>id!==c.id))
                      }}
                    />
                    <span>{c.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Seasons */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">{t('seasons')}</h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {availableSeasons.map(s => {
                const checked = seasonIds.includes(s.id)
                return (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        setSeasonIds(prev => e.target.checked ? Array.from(new Set([...prev, s.id])) : prev.filter(id=>id!==s.id))
                      }}
                    />
                    <span>{s.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Sections */}
          <div className="border-t pt-3">
            <h4 className="text-base font-bold">{t('sections')}</h4>
            <p className="text-xs text-gray-500 mt-1">{t('sectionsHelp')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {availableSections.map(s => {
                const checked = sectionIds.includes(s.id)
                return (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e)=>{
                        setSectionIds(prev => e.target.checked ? Array.from(new Set([...prev, s.id])) : prev.filter(id=>id!==s.id))
                      }}
                    />
                    <span>{s.name}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Primary location inputs */}
          <div className="grid grid-cols-1 gap-2 border-t pt-3">
            <h4 className="text-base font-bold">{t('primaryLocation')}</h4>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async ()=>{
                  if (!primaryLocationName.trim()) return
                  try {
                    const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: primaryLocationName, limit: 1 }) })
                    const data = await res.json()
                    const g = data?.results?.[0]
                    if (g) {
                      setPrimaryLocationLat(g.lat)
                      setPrimaryLocationLng(g.lon)
                    }
                  } catch (e) { console.warn('Geocode failed', e) }
                }}
              >{t('geocode')}</Button>
            </div>
            <Input placeholder={t('locationNamePlaceholder')} value={primaryLocationName} onChange={(e)=>setPrimaryLocationName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder={t('latitude')} value={primaryLocationLat} onChange={(e)=>setPrimaryLocationLat(e.target.value ? Number(e.target.value) : "")} />
              <Input placeholder={t('longitude')} value={primaryLocationLng} onChange={(e)=>setPrimaryLocationLng(e.target.value ? Number(e.target.value) : "")} />
            </div>
            
            {/* Location preview map */}
            {primaryLocationLat && primaryLocationLng && (
              <LocationPreviewMap 
                latitude={primaryLocationLat}
                longitude={primaryLocationLng}
                locationName={primaryLocationName}
              />
            )}
          </div>

          {/* Set tags */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{t('tags')} ({t('commaSeparated')})</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateTagsForSet}
                  disabled={isGenerating.tags || (!coverPreview && pictures.length === 0)}
                  title={coverPreview || pictures.length > 0 ? t('aiGenerateTags') : t('pleaseAddCoverOrImages')}
                  className="h-8 px-2"
                >
                {isGenerating.tags ? (
                  <span className="text-xs text-gray-500">{t('generating')}</span>
                ) : (
                  <span className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> {t('aiGenerateTags')}</span>
                )}
              </Button>
            </div>
            <Input
              placeholder={t('tagsPlaceholder')}
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </div>

          {/* removed: Options + AI Tools moved to cover column */}
        </div>
      </div>}

      {/* Pictures list */}
      <div className="space-y-6" ref={picturesContainerRef}>
        {/* Section header */}
        {pictures.length > 0 && (
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <Label className="text-lg font-semibold text-gray-800">{t('picturesHdr')}</Label>
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm font-medium">
              {pictures.length} {t('images')}
            </span>
          </div>
        )}

        {pictures.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500">{t('noImagesYet2')}</p>
              <p className="text-sm text-gray-400">{t('clickToAddImagesHint')}</p>
            </div>
          </div>
        )}

        {pictures.map((pic, idx) => (
          <div 
            key={(pic as any).id ?? (pic as any).tempId ?? idx} 
            className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            {/* Picture index badge */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {pic.id ? `${t('saved')} #${pic.id}` : t('newItem')}
                </span>
              </div>
            </div>

            {/* Delete button */}
            <div className="absolute top-4 right-4 z-10">
              <Button 
                type="button" 
                variant="destructive" 
                size="sm" 
                onClick={() => handleRemovePicture(idx)}
                className="rounded-full w-8 h-8 p-0 shadow-md hover:shadow-lg"
              >
                ×
              </Button>
            </div>

            <div className={isPortraitLibrary ? "p-4 pt-14" : "p-4 pt-14"}>
              <div className={isPortraitLibrary ? "grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]" : "grid grid-cols-1 md:grid-cols-3 gap-6"}>
                {/* 第一列：表单字段 + 翻译 */}
                {!isPortraitLibrary && <div className="space-y-5 order-1 md:col-span-1">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">{t('title')}</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => generatePictureField(idx, 'title')}
                          disabled={isGenerating.title}
                          title={t('aiGenerateTitle')}
                        >
                          {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin text-blue-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder={t('enterImageTitle')}
                      value={pic.title}
                      onChange={(e) => handlePictureChange(idx, "title", e.target.value)}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">{t('subtitle')}</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => generatePictureField(idx, 'subtitle')}
                          disabled={isGenerating.subtitle}
                          title={t('aiGenerateSubtitle')}
                        >
                          {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin text-green-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder={t('enterImageSubtitle')}
                      value={pic.subtitle}
                      onChange={(e) => handlePictureChange(idx, "subtitle", e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">{t('description')}</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => generatePictureField(idx, 'description')}
                          disabled={isGenerating.description}
                          title={t('aiGenerateDescription')}
                        >
                          {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin text-purple-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Textarea
                      placeholder={t('describeImagePlaceholder')}
                      value={pic.description}
                      onChange={(e) => handlePictureChange(idx, "description", e.target.value)}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 min-h-[80px]"
                    />
                  </div>
                  

                  {/* Picture translation fields (always visible) */}
                  <div className="mt-4 border border-gray-200 rounded-md p-3">
                    <div className="col-span-2 pb-2">
                      <h4 className="text-base font-bold">{t('translations')}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">{t('englishLabel')}</Label>
                        <Input
                          placeholder={t('englishLabel') + ' ' + t('title')}
                          value={pic.en?.title || ''}
                          onChange={(e) => { setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx]||{}), title: true } })); handlePictureChange(idx, 'en.title', e.target.value) }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Input
                          placeholder={t('englishLabel') + ' ' + t('subtitle')}
                          value={pic.en?.subtitle || ''}
                          onChange={(e) => { setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx]||{}), subtitle: true } })); handlePictureChange(idx, 'en.subtitle', e.target.value) }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Textarea
                          placeholder={t('englishLabel') + ' ' + t('description')}
                          value={pic.en?.description || ''}
                          onChange={(e) => { setPicEnTouched(prev => ({ ...prev, [idx]: { ...(prev[idx]||{}), description: true } })); handlePictureChange(idx, 'en.description', e.target.value) }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                        />
                      </div>
                      <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">{t('chineseLabel')}</Label>
                        <Input
                          placeholder={t('chineseLabel') + ' ' + t('title')}
                          value={pic.zh?.title || ''}
                          onChange={(e) => handlePictureChange(idx, 'zh.title', e.target.value)}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Input
                          placeholder={t('chineseLabel') + ' ' + t('subtitle')}
                          value={pic.zh?.subtitle || ''}
                          onChange={(e) => handlePictureChange(idx, 'zh.subtitle', e.target.value)}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                        <Textarea
                          placeholder={t('chineseLabel') + ' ' + t('description')}
                          value={pic.zh?.description || ''}
                          onChange={(e) => handlePictureChange(idx, 'zh.description', e.target.value)}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>}

                {/* 第二列：图片预览（并把 AI 分析放在图片下方） */}
                <div className={isPortraitLibrary ? "space-y-3 order-1 md:col-span-1" : "space-y-4 order-2 md:col-span-1"}>
                  {pic.previewUrl ? (
                    <div className="space-y-3">
                      <Label className="text-base font-bold text-gray-800">{t('preview')}</Label>
                      <div className="relative bg-gray-50 rounded-lg p-3">
                        <div 
                          className="relative w-full overflow-hidden rounded-md border border-gray-200 bg-white cursor-pointer hover:border-blue-400 transition-colors group"
                          onClick={() => document.getElementById(`picture-input-${idx}`)?.click()}
                          title={t('clickToChangeImage')}
                        >
                          <img
                            src={pic.previewUrl || "/placeholder.svg"}
                            alt={`Picture ${idx + 1}`}
                            className={isPortraitLibrary ? "h-72 w-full object-contain group-hover:opacity-90 transition-opacity" : "w-full max-h-80 object-contain group-hover:opacity-90 transition-opacity"}
                            style={{
                              aspectRatio: 'auto'
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 px-3 py-1 rounded-md text-sm font-medium text-gray-700">
                              Click to change image
                            </div>
                          </div>
                        </div>
                        {pic.originalSize! > 0 && (
                          <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">{t('originalSize')}</span> {formatSize(pic.originalSize!)}
                              {pic.compressedSize && (
                                <>
                                  <br />
                                  <span className="font-medium">Display variant:</span> {formatSize(pic.compressedSize)}
                                  <span className="text-green-600 font-medium">
                                    ({((pic.compressedSize / pic.originalSize!) * 100).toFixed(1)}%)
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                      {/* AI 分析（放在图片下方） */}
                    {!isPortraitLibrary && <div className="border-t pt-3">
                      <h4 className="text-base font-bold mb-2">{t('aiToolsPicture')}</h4>
                        <ImageAnalysisComponent
                          imageUrl={pic.previewUrl}
                          onResultUpdate={(field, result) => {
                            handlePictureChange(idx, field, result)
                          }}
                        />
                      </div>}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48">
                      <div 
                        className="flex flex-col items-center justify-center h-full w-full border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                        onClick={() => document.getElementById(`picture-input-${idx}`)?.click()}
                      >
                        <div className="w-12 h-12 bg-gray-200 group-hover:bg-blue-100 rounded-full flex items-center justify-center mb-3 transition-colors">
                          <Camera className="h-6 w-6 text-gray-400 group-hover:text-blue-500" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{t('clickToUploadCover')}</p>
                        <p className="text-gray-400 text-xs mt-1">{t('supportsFormats')}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 隐藏的文件输入 */}
                  <input
                    id={`picture-input-${idx}`}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePictureChange(idx, "cover", e.target.files?.[0] || null)}
                    className="hidden"
                  />

                </div>
                {/* 第三列：标签 + 类型 + 季节/位置 */}
                <div className={isPortraitLibrary ? "space-y-4 order-2 md:col-span-1" : "space-y-4 order-3 md:col-span-1"}>
                  {/* Picture tags */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold">{isPortraitLibrary ? "图片 tag" : t('tags')}</h4>
                      {!isPortraitLibrary && <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generatePictureTags(idx)}
                        disabled={isGenerating.tags || (!pic.previewUrl && !pic.image_url)}
                        className="h-7 px-2"
                        title={(pic.previewUrl || pic.image_url) ? t('aiGenerateTags') : t('pleaseAddCoverOrImages')}
                      >
                        {isGenerating.tags ? <span className="text-xs text-gray-500">{t('generating')}</span> : <span className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> {t('aiGenerateTags')}</span>}
                      </Button>}
                    </div>
                    {isPortraitLibrary ? (
                      <div className="space-y-4 rounded-md border border-[#ded4c6] bg-[#fbfaf7] p-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {PORTRAIT_TAG_FIELDS.map((field) => {
                            const selectedTags = getTagsByPrefix(pic.tags || [], field.prefix)
                            const draftKey = `${idx}:${field.prefix}`
                            const draftValue = customPortraitTagDrafts[draftKey] || ""
                            const fieldOptions = getPortraitFieldOptions(field.prefix, field.options)
                            return (
                              <div key={field.prefix} className="space-y-2 rounded-md border border-[#e5dccf] bg-white p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Label className="text-xs font-semibold text-[#4e493f]">{field.label}</Label>
                                  <span className="text-[11px] text-[#8c8172]">{selectedTags.length} 个</span>
                                </div>
                                {"help" in field && field.help && (
                                  <p className="text-[11px] leading-4 text-[#8c8172]">{field.help}</p>
                                )}
                                <Select value="" onValueChange={(value) => addPictureTag(idx, value)}>
                                  <SelectTrigger className="h-9 bg-white">
                                    <SelectValue placeholder={`添加${field.label}`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fieldOptions.map((option) => {
                                      const alreadySelected = selectedTags.includes(option.value)
                                      return (
                                        <SelectItem key={option.value} value={option.value}>
                                          {alreadySelected ? "✓ " : ""}{option.label}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-1.5">
                                  <Input
                                    value={draftValue}
                                    onChange={(event) => setCustomPortraitTagDraft(idx, field.prefix, event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault()
                                        addCustomPortraitTag(idx, field.prefix)
                                      }
                                    }}
                                    placeholder={`自定义${field.label}`}
                                    className="h-8 bg-white text-xs"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addCustomPortraitTag(idx, field.prefix)}
                                    className="h-8 w-8 shrink-0 px-0"
                                    title={`添加${field.label}`}
                                  >
                                    +
                                  </Button>
                                </div>
                                {selectedTags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {selectedTags.map((tag) => (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => removePictureTag(idx, tag)}
                                        className="rounded-full bg-[#f2eadb] px-2 py-0.5 text-[11px] font-medium text-[#4e493f] hover:bg-[#e4d7c3]"
                                        title="点击移除"
                                      >
                                        {tag.replace(`${field.prefix}:`, "")} ×
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(pic.tags || []).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => removePictureTag(idx, tag)}
                              className="rounded-full border border-[#ded4c6] bg-white px-2.5 py-1 text-xs font-medium text-[#4e493f] hover:border-[#9a8d7b] hover:bg-[#f2eadb]"
                              title="点击移除"
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Input
                        placeholder={t('tagsPlaceholder')}
                        value={(pic.tags || []).join(', ')}
                        onChange={(e) => handlePictureChange(idx, 'tags', e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean))}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* Types (categories) */}
                  {!isPortraitLibrary && <div className="space-y-2 border-t pt-3">
                    <h4 className="text-base font-bold">{t('typesCategories')}</h4>
                    <p className="text-xs text-gray-500">Examples: Portrait, Landscape, Street, Creative, Documentary, Travel, Architecture, Macro, Night</p>
                    <div className="grid grid-cols-2 gap-2">
                      {availableCategories.map(c => {
                        const checked = Array.isArray((pic as any).picture_category_ids) && ((pic as any).picture_category_ids as number[]).includes(c.id)
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e)=>{
                                const cur = Array.isArray((pic as any).picture_category_ids) ? ([...(pic as any).picture_category_ids] as number[]) : []
                                const next = e.target.checked ? Array.from(new Set([...cur, c.id])) : cur.filter(id => id !== c.id)
                                handlePictureChange(idx, 'picture_category_ids', next)
                              }}
                            />
                            <span>{c.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>}

                  {/* Season & Location */}
                  {!isPortraitLibrary && <div className="grid grid-cols-1 gap-3 pt-3 border-t">
                    <div>
                      <h4 className="text-base font-bold mb-1">{t('season')}</h4>
                      <Select
                        value={pic.season_id != null ? String(pic.season_id) : undefined}
                        onValueChange={(v)=>handlePictureChange(idx, 'season_id', v ? Number(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectSeason')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSeasons.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-2 border-t pt-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold">{t('location')}</h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async ()=>{
                            const nm = (pic as any).location_name as string | undefined
                            if (!nm || !nm.trim()) return
                            try {
                              const res = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: nm, limit: 1 }) })
                              const data = await res.json()
                              const g = data?.results?.[0]
                              if (g) {
                                handlePictureChange(idx, 'location_latitude', g.lat)
                                handlePictureChange(idx, 'location_longitude', g.lon)
                              }
                            } catch (e) { console.warn('Geocode failed', e) }
                          }}
                        >{t('geocode')}</Button>
                      </div>
                      <Input placeholder={t('locationNamePlaceholder')} value={(pic as any).location_name || ''} onChange={(e)=>handlePictureChange(idx, 'location_name', e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder={t('latitude')} value={(pic as any).location_latitude ?? ''} onChange={(e)=>handlePictureChange(idx, 'location_latitude', e.target.value ? Number(e.target.value) : null)} />
                        <Input placeholder={t('longitude')} value={(pic as any).location_longitude ?? ''} onChange={(e)=>handlePictureChange(idx, 'location_longitude', e.target.value ? Number(e.target.value) : null)} />
                      </div>
                      
                      {/* Location preview map */}
                      {(pic as any).location_latitude && (pic as any).location_longitude && (
                        <LocationPreviewMap 
                          latitude={(pic as any).location_latitude}
                          longitude={(pic as any).location_longitude}
                          locationName={(pic as any).location_name}
                        />
                      )}
                    </div>
                  </div>}
                </div>
              </div>

              {/* moved AI analysis inside right column */}
            </div>
          </div>
        ))}
      </div>

      {/* Add pictures buttons (single and bulk) */}
      {!isPortraitLibrary && renderAddPictureControls()}

      {/* Submit button */}
      {/* Reorder thumbnails */}
      {pictures.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">{t('reorderPicturesHdr')}</h3>
            <span className="text-xs text-gray-500">{t('dragThumbnails')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pictures.map((pic, idx) => (
              <div
                key={(pic as any).id ?? (pic as any).tempId ?? idx}
                draggable
                onDragStart={() => handleDragStartThumb(idx)}
                onDragEnter={() => handleDragEnterThumb(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEndThumb}
                className={`relative select-none rounded-md overflow-hidden border bg-white transition-shadow ${draggingIndex === idx ? 'ring-2 ring-blue-400 shadow-lg' : 'hover:shadow'} `}
                title={(pic.title || '').trim() || `${t('image')} ${idx + 1}`}
              >
                <div className="absolute top-1 left-1 z-10">
                  <div className="px-2 py-0.5 text-[11px] rounded-full bg-black/70 text-white">#{idx + 1}</div>
                </div>
                {pic.previewUrl || pic.image_url ? (
                  <img
                    src={pic.previewUrl || `${process.env.NEXT_PUBLIC_BUCKET_URL || ''}${pic.image_url}`}
                    alt={`thumb-${idx + 1}`}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-400">{t('noPreview')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-white py-4 border-t z-[9999] space-y-2">
        {submitError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full relative z-[9999]">
          {isSubmitting ? t('submitting') : isPortraitLibrary ? "保存图片标签" : isEditMode ? t('updateSet') : t('submitSet')}
        </Button>
      </div>

      {/* Scroll to top button */}
      {showScrollToTop && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="fixed bottom-8 left-8 z-20 rounded-full shadow-lg"
          onClick={scrollToTop}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </form>
  )
}
