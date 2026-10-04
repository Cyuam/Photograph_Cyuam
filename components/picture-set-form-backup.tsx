// components/picture-set-form.tsx
"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ArrowUp, Sparkles, Camera } from "lucide-react"
import imageCompression from "browser-image-compression"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageAnalysisComponent } from "@/components/image-analysis"
import { useImageAnalysis } from "@/hooks/use-image-analysis"

import type { PictureSet } from "@/lib/pictureSet.types"
import type { PictureFormData, PictureSetSubmitData } from "@/lib/form-types"

interface PictureSetFormProps {
  onSubmit: (pictureSet: PictureSetSubmitData, pictureSetId?: number) => void
  editingPictureSet?: PictureSet | null
  onCancel?: () => void
}

// 压缩图片的函数（不变）
async function compressImage(file: File, quality = 0.9): Promise<File> {
  const options = {
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: quality,
    fileType: "image/webp",
  }
  const compressedFile = await imageCompression(file, options)
  return new File([compressedFile], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" })
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

export function PictureSetForm({ onSubmit, editingPictureSet, onCancel }: PictureSetFormProps) {
  const { analyzeImage } = useImageAnalysis()
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverOriginalSize, setCoverOriginalSize] = useState<number>(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string>("")
  const [pictures, setPictures] = useState<PictureFormData[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [position, setPosition] = useState<string>("up")
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>(undefined)
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [isGenerating, setIsGenerating] = useState({
    title: false,
    subtitle: false,
    description: false
  })
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [showPictureAIAnalysis, setShowPictureAIAnalysis] = useState<{[key: number]: boolean}>({})
  const formRef = useRef<HTMLFormElement>(null)
  const picturesContainerRef = useRef<HTMLDivElement>(null)

  // AI生成函数
  const generateField = async (field: 'title' | 'subtitle' | 'description') => {
    if (!coverPreview) return
    
    setIsGenerating(prev => ({ ...prev, [field]: true }))
    try {
      const result = await analyzeImage(coverPreview, field)
      if (result.success) {
        if (field === 'title') setTitle(result.result)
        if (field === 'subtitle') setSubtitle(result.result)
        if (field === 'description') setDescription(result.result)
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
        handlePictureChange(pictureIndex, field, result.result)
      }
    } catch (error) {
      console.error(`生成图片${pictureIndex + 1}的${field}失败:`, error)
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }))
    }
  }

  // 如果在编辑模式，初始化表单数据
  useEffect(() => {
    if (editingPictureSet) {
      console.log("Initializing form with editing picture set:", editingPictureSet.id)
      setIsEditMode(true)
      setEditingId(editingPictureSet.id)
      setTitle(editingPictureSet.title || "")
      setSubtitle(editingPictureSet.subtitle || "")
      setDescription(editingPictureSet.description || "")
      setCoverImageUrl(editingPictureSet.cover_image_url || "")
      setCoverPreview(editingPictureSet.cover_image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${editingPictureSet.cover_image_url}` : null)
      setPosition(editingPictureSet.position || "up")

      // Log the pictures we're loading
      console.log(`Loading ${editingPictureSet.pictures?.length || 0} pictures for editing`)

      const formatted = (editingPictureSet.pictures || []).map((pic) => ({
        id: pic.id,
        title: pic.title || "",
        subtitle: pic.subtitle || "",
        description: pic.description || "",
        cover: null,
        image_url: pic.image_url || "",
        raw_image_url: pic.raw_image_url || "",
        previewUrl: pic.image_url ? `${process.env.NEXT_PUBLIC_BUCKET_URL}${pic.image_url}` : undefined,
      }))
      setPictures(formatted)
    } else {
      setIsEditMode(false)
      setEditingId(undefined)
      resetForm()
    }
  }, [editingPictureSet])

  // Monitor scroll position to show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      if (formRef.current) {
        const scrollTop = formRef.current.scrollTop || document.documentElement.scrollTop
        setShowScrollToTop(scrollTop > 300)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 获取 R2 签名后上传
  const uploadFile = async (file: File, objectName: string): Promise<string> => {
    const res = await fetch("/api/upload-to-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectName, contentType: file.type }),
    })
    if (!res.ok) throw new Error("Failed to get signed URL")
    const { uploadUrl } = await res.json()
    const buf = await file.arrayBuffer()
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: buf,
    })
    if (!uploadRes.ok) throw new Error("File upload failed")
    return `/${objectName}`
  }

  // 提交表单：上传封面 + 各张图片 (原图 + 压缩图)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      let cover_image_url = coverImageUrl
      if (cover) {
        const compressed = await compressImage(cover, 0.9)
        cover_image_url = await uploadFile(compressed, `picture/cover-${Date.now()}-${compressed.name}`)
      }

      const processed = await Promise.all(
        pictures.map(async (pic, idx) => {
          let image_url = pic.image_url || ""
          let raw_image_url = pic.raw_image_url || ""
          if (pic.cover instanceof File) {
            raw_image_url = await uploadFile(pic.cover, `picture/original-${Date.now()}-${idx}-${pic.cover.name}`)
            const comp = await compressImage(pic.cover, 0.9)
            image_url = await uploadFile(comp, `picture/compressed-${Date.now()}-${idx}-${comp.name}`)
          }
          return {
            id: pic.id,
            title: pic.title,
            subtitle: pic.subtitle,
            description: pic.description,
            image_url,
            raw_image_url,
          }
        }),
      )

      const payload: PictureSetSubmitData = {
        title,
        subtitle,
        description,
        cover_image_url,
        position,
        pictures: processed,
      }

      console.log(`Submitting form with ${processed.length} pictures`)

      onSubmit(payload, editingId)
      if (!isEditMode) resetForm()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 文件选中后生成预览并压缩
  const handlePictureChange = async (i: number, field: keyof PictureFormData, val: string | File | null) => {
    if (field === "cover" && val instanceof File) {
      const { url, size } = await getImagePreview(val)
      const comp = await compressImage(val, 0.9)
      const previewComp = await getImagePreview(comp)
      
      setPictures(prev => {
        const arr = [...prev]
        arr[i] = {
          ...arr[i],
          cover: val,
          previewUrl: url,
          originalSize: size,
          compressedSize: previewComp.size,
          compressedFile: comp,
        }
        return arr
      })
    } else {
      // 使用函数式更新避免竞态条件
      setPictures(prev => {
        const arr = [...prev]
        arr[i] = { ...arr[i], [field]: val }
        console.log(`更新图片 ${i} 的 ${field}:`, val)
        console.log('更新后的图片数据:', arr[i])
        return arr
      })
    }
  }

  const handleAddPicture = () => {
    console.log("Adding new picture to form")
    setPictures((p) => [
      ...p,
      {
        title: "",
        subtitle: "",
        description: "",
        cover: null,
        previewUrl: undefined,
        originalSize: 0,
        compressedSize: 0,
        compressedFile: null,
      },
    ])

    // Scroll to the newly added picture after a short delay
    setTimeout(() => {
      if (picturesContainerRef.current) {
        const pictureElements = picturesContainerRef.current.querySelectorAll(".picture-item")
        if (pictureElements.length > 0) {
          const lastPicture = pictureElements[pictureElements.length - 1]
          lastPicture.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }
    }, 100)
  }

  const handleRemovePicture = (i: number) => {
    console.log(`Removing picture at index ${i}`)
    const arr = [...pictures]
    arr.splice(i, 1)
    setPictures(arr)
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setCover(f)
    if (f) {
      const { url, size } = await getImagePreview(f)
      setCoverPreview(url)
      setCoverOriginalSize(size)
      setCoverImageUrl("")
    } else {
      setCoverPreview(null)
      setCoverOriginalSize(0)
    }
  }

  const resetForm = () => {
    setTitle("")
    setSubtitle("")
    setDescription("")
    setCover(null)
    setCoverPreview(null)
    setCoverOriginalSize(0)
    setCoverImageUrl("")
    setPictures([])
    setPosition("up")
  }

  const scrollToTop = () => {
    if (formRef.current) {
      formRef.current.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const formatSize = (b: number) =>
    b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(2) + " KB" : (b / 1048576).toFixed(2) + " MB"

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{isEditMode ? "Edit Picture Set" : "Create New Picture Set"}</h2>
        {isEditMode && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel Edit
          </Button>
        )}
      </div>
      {/* 标题/副标题/描述/位置 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 左侧：表单字段 */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="title">Title</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => generateField('title')}
                  disabled={isGenerating.title}
                  title="AI生成标题"
                >
                  {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => generateField('subtitle')}
                  disabled={isGenerating.subtitle}
                  title="AI生成副标题"
                >
                  {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="description">Description</Label>
              {coverPreview && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => generateField('description')}
                  disabled={isGenerating.description}
                  title="AI生成描述"
                >
                  {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin" /> : "✨"}
                </Button>
              )}
            </div>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          
          <div>
            <Label htmlFor="position">Position</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger id="position">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="up">Top Row</SelectItem>
                <SelectItem value="down">Bottom Row</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 右侧：封面预览 */}
        <div className="space-y-2">
          <Label htmlFor="cover">Cover Image</Label>
          {coverPreview && (
            <div className="mt-2 mb-4">
              <div className="relative w-full overflow-hidden rounded-md border border-gray-200">
                <img
                  src={coverPreview || "/placeholder.svg"}
                  alt="Cover preview"
                  className="w-full h-auto object-contain"
                />
              </div>
              {coverOriginalSize > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Original size: {formatSize(coverOriginalSize)} • Will be compressed to WebP at 90% quality
                </p>
              )}
            </div>
          )}
          <Input id="cover" type="file" accept="image/*" onChange={handleCoverChange} />
        </div>
      </div>

      {/* AI分析功能区域 - 折叠式设计 */}
      {coverPreview && (
        <div className="border border-gray-200 rounded-lg">
          <Button
            type="button"
            variant="ghost"
            className="w-full p-3 flex items-center justify-between text-left"
            onClick={() => setShowAIAnalysis(!showAIAnalysis)}
          >
            <div className="flex items-center gap-2">
              <span>🤖</span>
              <span className="font-medium">AI 智能分析</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                一键生成 & 自定义分析
              </span>
            </div>
            <span className={`transform transition-transform ${showAIAnalysis ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </Button>
          
          {showAIAnalysis && (
            <div className="px-3 pb-3 border-t border-gray-100">
              <ImageAnalysisComponent
                imageUrl={coverPreview}
                onResultUpdate={(field, result) => {
                  if (field === 'title') setTitle(result)
                  if (field === 'subtitle') setSubtitle(result)
                  if (field === 'description') setDescription(result)
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* 多张图片列表 */}
      <div className="space-y-8" ref={picturesContainerRef}>
        <div className="sticky top-4 z-10 bg-white/95 backdrop-blur-sm py-3 px-4 border rounded-lg shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <Label className="text-lg font-semibold text-gray-800">图片集合</Label>
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm font-medium">
              {pictures.length} 张图片
            </span>
          </div>
          <Button 
            type="button" 
            onClick={handleAddPicture} 
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" /> 
            添加图片
          </Button>
        </div>

        {pictures.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-gray-500">还没有添加图片</p>
              <Button 
                type="button" 
                onClick={handleAddPicture}
                variant="outline"
                className="mt-2"
              >
                添加第一张图片
              </Button>
            </div>
          </div>
        )}

        {pictures.map((pic, idx) => (
          <div 
            key={idx} 
            className="relative bg-white border-2 border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
          >
            {/* 图片序号标识 */}
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {pic.id ? `已保存 #${pic.id}` : "新图片"}
                </span>
              </div>
            </div>

            {/* 删除按钮 */}
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

            <div className="p-6 pt-16">{/* 增加顶部padding为标识留空间 */}
            <div className="p-6 pt-16">{/* 增加顶部padding为标识留空间 */}
              <div className="grid grid-cols-2 gap-8">
                {/* 左侧：表单字段 */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">标题</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                          onClick={() => generatePictureField(idx, 'title')}
                          disabled={isGenerating.title}
                          title="AI生成标题"
                        >
                          {isGenerating.title ? <Sparkles className="h-3 w-3 animate-spin text-blue-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="为这张图片输入标题..."
                      value={pic.title}
                      onChange={(e) => handlePictureChange(idx, "title", e.target.value)}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">副标题</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-green-100"
                          onClick={() => generatePictureField(idx, 'subtitle')}
                          disabled={isGenerating.subtitle}
                          title="AI生成副标题"
                        >
                          {isGenerating.subtitle ? <Sparkles className="h-3 w-3 animate-spin text-green-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="为这张图片输入副标题..."
                      value={pic.subtitle}
                      onChange={(e) => handlePictureChange(idx, "subtitle", e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-semibold text-gray-700">描述</Label>
                      {pic.previewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-purple-100"
                          onClick={() => generatePictureField(idx, 'description')}
                          disabled={isGenerating.description}
                          title="AI生成描述"
                        >
                          {isGenerating.description ? <Sparkles className="h-3 w-3 animate-spin text-purple-500" /> : "✨"}
                        </Button>
                      )}
                    </div>
                    <Textarea
                      placeholder="描述这张图片的内容和特点..."
                      value={pic.description}
                      onChange={(e) => handlePictureChange(idx, "description", e.target.value)}
                      className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">上传图片</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePictureChange(idx, "cover", e.target.files?.[0] || null)}
                      className="border-gray-300 focus:border-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
                </div>

                {/* 右侧：图片预览 */}
                <div className="space-y-4">
                  {pic.previewUrl ? (
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">图片预览</Label>
                      <div className="relative bg-gray-50 rounded-lg p-3">
                        <div className="relative w-full overflow-hidden rounded-md border border-gray-200 bg-white">
                          <img
                            src={pic.previewUrl || "/placeholder.svg"}
                            alt={`Picture ${idx + 1}`}
                            className="w-full h-auto object-contain"
                          />
                        </div>
                        {pic.originalSize! > 0 && (
                          <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">原始大小:</span> {formatSize(pic.originalSize!)}
                              {pic.compressedSize && (
                                <>
                                  <br />
                                  <span className="font-medium">压缩后:</span> {formatSize(pic.compressedSize)} 
                                  <span className="text-green-600 font-medium">
                                    ({((pic.compressedSize / pic.originalSize!) * 100).toFixed(1)}%)
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                        <Camera className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">上传图片后即可预览</p>
                    </div>
                  )}
                </div>
              </div>

            {/* AI 分析组件 - 折叠式设计 */}
            {pic.previewUrl && (
              <div className="mt-4 border border-gray-200 rounded-lg">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full p-3 flex items-center justify-between text-left"
                  onClick={() => setShowPictureAIAnalysis(prev => ({
                    ...prev,
                    [idx]: !prev[idx]
                  }))}
                >
                  <div className="flex items-center gap-2">
                    <span>🤖</span>
                    <span className="font-medium">AI 分析 - Picture {idx + 1}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      智能生成
                    </span>
                  </div>
                  <span className={`transform transition-transform ${showPictureAIAnalysis[idx] ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </Button>
                
                {showPictureAIAnalysis[idx] && (
                  <div className="px-3 pb-3 border-t border-gray-100">
                    <ImageAnalysisComponent
                      imageUrl={pic.previewUrl}
                      onResultUpdate={(field, result) => {
                        handlePictureChange(idx, field, result)
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            </div> {/* 关闭p-6 pt-16的div */}
          </div> {/* 关闭整个picture卡片的div */}
        ))}
      </div> {/* 关闭pictures容器的div */}

      {/* Action buttons at the bottom */}
      <div className="sticky bottom-0 bg-white py-4 border-t z-10 space-y-2">
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Submitting..." : isEditMode ? "Update Picture Set" : "Submit Picture Set"}
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
