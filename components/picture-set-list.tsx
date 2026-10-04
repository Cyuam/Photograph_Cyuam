"use client"

import Image from "next/image"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import type { PictureSet } from "@/lib/pictureSet.types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { useI18n } from "@/lib/i18n"

interface PictureSetListProps {
  pictureSets: PictureSet[]
  onEdit: (pictureSet: PictureSet) => void
  onDelete: (id: number) => void
}

export function PictureSetList({ pictureSets, onEdit, onDelete }: PictureSetListProps) {
  const { t, locale } = useI18n()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pictureSetToDelete, setPictureSetToDelete] = useState<number | null>(null)

  const getLocalizedText = (set: PictureSet, field: 'title' | 'subtitle' | 'description') => {
    const localized = locale === 'zh' ? set.zh?.[field] : set.en?.[field]
    if (localized && localized.trim()) return localized
    if (field === 'title') {
      const alternate = locale === 'zh' ? set.en?.title : set.zh?.title
      if (alternate && alternate.trim()) return alternate
      return set.title || ''
    }
    const fallback = set[field] || ''
    if (locale === 'zh') {
      return /[\u4e00-\u9fff]/.test(fallback) ? fallback : ''
    }
    return /[\u4e00-\u9fff]/.test(fallback) ? '' : fallback
  }

  const handleDeleteClick = (id: number) => {
    setPictureSetToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (pictureSetToDelete !== null) {
      onDelete(pictureSetToDelete)
      setPictureSetToDelete(null)
    }
    setDeleteDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t('uploadedPictureSets')}</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pictureSets.map((set, index) => {
          const count = (set.pictures?.length || 0) + (set.cover_image_url ? 1 : 0)
          const title = getLocalizedText(set, 'title') || (locale === 'zh' ? '未命名' : 'Untitled')
          const subtitle = getLocalizedText(set, 'subtitle')
          const description = getLocalizedText(set, 'description')
          return (
            <Card key={set.id} className="group smooth-hover gpu-accelerated" style={{ animationDelay: `${index * 100}ms` }}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center gap-3">
                  <span className="smooth-transition group-hover:text-blue-600">{title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${set.is_published === false ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}`}>
                    {set.is_published === false ? t('unpublished') : t('publishedLabel')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {set.cover_image_url && (
                  <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg">
                    <Image
                      src={process.env.NEXT_PUBLIC_BUCKET_URL+set.cover_image_url || "/placeholder.svg"}
                      alt={title}
                      fill
                      className="object-cover rounded smooth-transition group-hover:scale-105"
                    />
                  </div>
                )}
                {subtitle && (
                  <p className="text-sm text-gray-500 smooth-transition group-hover:text-gray-700">{subtitle}</p>
                )}
                {description && (
                  <p className="mt-2 line-clamp-2 smooth-transition group-hover:text-gray-800">{description}</p>
                )}
                <p className="mt-2 text-sm text-gray-500">{count > 0 ? `${count} ${t('pictures')}` : t('noPictures')}</p>
              </CardContent>
              <CardFooter className="opacity-0 group-hover:opacity-100 smooth-transition transform translate-y-2 group-hover:translate-y-0">
                <div className="flex justify-end w-full gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(set)} className="smooth-hover">
                    <Edit className="h-4 w-4 mr-1" /> {t('edit')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(set.id)} className="smooth-hover">
                    <Trash2 className="h-4 w-4 mr-1" /> {t('delete')}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('areYouSureDeleteSet')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              {t('deleteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
