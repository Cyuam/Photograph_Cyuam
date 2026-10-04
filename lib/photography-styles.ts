export type PhotographyStyleId = 'landscape' | 'portrait' | 'street' | 'travel'

export interface PhotographyStyleConfig {
  id: PhotographyStyleId
  /** Human readable name stored in the tags table */
  tagName: string
  /** Key in the translation dictionary */
  i18nKey: string
  labels: {
    en: string
    zh: string
  }
  /** Optional helper text shown in UI contexts */
  tagline?: {
    en: string
    zh: string
  }
}

export const PHOTOGRAPHY_STYLES: PhotographyStyleConfig[] = [
  {
    id: 'landscape',
    tagName: 'Landscape',
    i18nKey: 'styleLandscape',
    labels: { en: 'Landscape', zh: '风光' },
    tagline: {
      en: 'Light-drenched vistas & sweeping nature frames',
      zh: '光影中的天地与自然色调',
    },
  },
  {
    id: 'portrait',
    tagName: 'Portrait',
    i18nKey: 'stylePortrait',
    labels: { en: 'Portrait', zh: '人像' },
    tagline: {
      en: 'Character-driven portraits with delicate storytelling',
      zh: '细腻光线下的人物故事',
    },
  },
  {
    id: 'street',
    tagName: 'Street',
    i18nKey: 'styleStreet',
    labels: { en: 'Street', zh: '街拍' },
    tagline: {
      en: 'Candid city poetry & fleeting urban moments',
      zh: '街头光影中的瞬间与故事',
    },
  },
  {
    id: 'travel',
    tagName: 'Travel',
    i18nKey: 'styleTravel',
    labels: { en: 'Recent', zh: '最近' },
    tagline: {
      en: 'Latest uploads curated from recent work',
      zh: '最近上传的作品精选',
    },
  },
]

export const PHOTOGRAPHY_STYLE_BY_ID: Record<PhotographyStyleId, PhotographyStyleConfig> = PHOTOGRAPHY_STYLES.reduce(
  (acc, cfg) => {
    acc[cfg.id] = cfg
    return acc
  },
  {} as Record<PhotographyStyleId, PhotographyStyleConfig>,
)

export const PHOTOGRAPHY_TAG_NAME_TO_ID: Record<string, PhotographyStyleId> = PHOTOGRAPHY_STYLES.reduce(
  (acc, cfg) => {
    acc[cfg.tagName.toLowerCase()] = cfg.id
    return acc
  },
  {} as Record<string, PhotographyStyleId>,
)

export const PHOTOGRAPHY_STYLE_IDS = PHOTOGRAPHY_STYLES.map((cfg) => cfg.id)
