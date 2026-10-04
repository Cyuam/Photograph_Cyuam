"use client"

import { useI18n } from "@/lib/i18n"

interface LocalizedContent {
  title?: string
  subtitle?: string
  description?: string
}

interface ImageItem {
  translations: {
    en: LocalizedContent
    zh: LocalizedContent
  }
}

interface ImageDetailsProps {
  image: ImageItem
}

export function ImageDetails({ image }: ImageDetailsProps) {
  const { locale } = useI18n()
  const primary = locale === 'zh' ? image.translations.zh : image.translations.en
  const secondary = locale === 'zh' ? image.translations.en : image.translations.zh

  const title = primary.title || secondary.title || ''
  const subtitle = primary.subtitle || secondary.subtitle || ''

  // If there's no title or subtitle to display, return null
  if (!title && !subtitle) {
    return null
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/85 px-4 py-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.35em] text-gray-500">
        {locale === 'zh' ? '当前作品' : 'Current Frame'}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {title && <h2 className="text-xl font-semibold text-gray-900">{title}</h2>}
        {subtitle && <h3 className="text-base text-gray-600">{subtitle}</h3>}
      </div>
    </div>
  )
}
