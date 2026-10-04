import type { ImageVariantMap, PictureSet } from "./pictureSet.types"

// Define shared form data types to be used across components
export interface PictureFormData {
  id?: number
  tempId?: string
  title: string
  subtitle: string
  description: string
  cover?: File | null
  image_url?: string
  raw_image_url?: string
  image_variants?: ImageVariantMap
  previewUrl?: string
  originalSize?: number
  compressedSize?: number
  compressedFile?: File | null
  // single photography style selection
  style?: string | null
  // per-picture season & location
  season_id?: number | null
  location_name?: string
  location_latitude?: number | null
  location_longitude?: number | null
  // per-picture categories (editor convenience; stored as typed tags)
  picture_category_ids?: number[]
  // optional per-picture extensions (not yet wired end-to-end)
  en?: LocaleTexts
  zh?: LocaleTexts
  tags?: string[]
}

export interface PictureSetFormData {
  title: string
  subtitle: string
  description: string
  cover_image_url: string
  cover_image_variants?: ImageVariantMap
  position: string
  pictures: PictureFormData[]
  // new editable fields
  is_published?: boolean
  primary_category_id?: number | null
  season_id?: number | null
  // multi-select (editor-facing)
  category_ids?: number[]
  season_ids?: number[]
  section_ids?: number[]
  // simple primary location editor values
  primary_location_name?: string
  primary_location_latitude?: number | null
  primary_location_longitude?: number | null
  // translations and tags
  en?: LocaleTexts
  zh?: LocaleTexts
  tags?: string[]
  // propagation flags
  apply_set_props_to_pictures?: boolean
  override_existing_picture_props?: boolean
  propagate_categories_to_pictures?: boolean
  // simplified flags
  fill_missing_from_set?: boolean
  autogen_titles_subtitles?: boolean
  async_enrich?: boolean
  auto_generate_tags_untagged?: boolean
  auto_fill_locales_all?: boolean
}

export interface PictureSetSubmitData extends Omit<PictureSet, "id" | "created_at" | "updated_at" | "pictures"> {
  pictures: Omit<PictureFormData, "cover" | "previewUrl" | "originalSize" | "compressedSize" | "compressedFile">[]
  en?: LocaleTexts
  zh?: LocaleTexts
  tags?: string[]
  section_ids?: number[]
  primary_location_name?: string
  primary_location_latitude?: number | null
  primary_location_longitude?: number | null
  apply_set_props_to_pictures?: boolean
  override_existing_picture_props?: boolean
  propagate_categories_to_pictures?: boolean
  fill_missing_from_set?: boolean
  autogen_titles_subtitles?: boolean
  async_enrich?: boolean
  auto_generate_tags_untagged?: boolean
  auto_fill_locales_all?: boolean
}

export interface LocaleTexts {
  title?: string
  subtitle?: string
  description?: string
}
