export type ImageVariantMap = Record<string, string>;

export interface PictureSet {
  id: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  cover_image_url: string;
  cover_image_variants?: ImageVariantMap;
  description: string;
  title: string;
  subtitle: string;
  pictures: Picture[];
  position: string;
  // new optional fields matching DB extensions
  is_published?: boolean;
  primary_category_id?: number | null;
  season_id?: number | null;
  // derived/editor-only helpers
  sections?: string[]; // section identifiers/slugs for quick display and placement (e.g., 'top','bottom','portrait')
  // editor-facing multi-selects (stored via tags or join tables)
  category_ids?: number[]
  season_ids?: number[]
  primary_location?: {
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  // optional translated texts and tags for editing convenience
  en?: { title?: string; subtitle?: string; description?: string };
  zh?: { title?: string; subtitle?: string; description?: string };
  tags?: string[];
}

export interface Picture {
  id: number;
  picture_set_id: number;
  order_index: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  raw_image_url?: string;
  image_url: string;
  image_variants?: ImageVariantMap;
  title: string;
  subtitle: string;
  description: string;
  // photography style tag (single select)
  style?: string | null;
  // new optional fields matching DB extensions
  is_published?: boolean;
  primary_category_id?: number | null;
  season_id?: number | null;
  // optional per-picture fields (not fully wired)
  en?: { title?: string; subtitle?: string; description?: string };
  zh?: { title?: string; subtitle?: string; description?: string };
  tags?: string[];
}
