-- Add multilingual name fields to locations table
-- This allows location names to be displayed in different languages

-- Add name_en and name_zh columns to locations table
ALTER TABLE public.locations 
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_zh TEXT;

-- Optional: Update existing records
-- If you have existing location names in Chinese, you might want to copy them to name_zh
-- UPDATE public.locations SET name_zh = name WHERE name_zh IS NULL AND name IS NOT NULL;

-- Optional: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_locations_name_en ON public.locations(name_en);
CREATE INDEX IF NOT EXISTS idx_locations_name_zh ON public.locations(name_zh);

-- Comments to document the columns
COMMENT ON COLUMN public.locations.name IS 'Default/fallback location name';
COMMENT ON COLUMN public.locations.name_en IS 'English location name';
COMMENT ON COLUMN public.locations.name_zh IS 'Chinese location name';
