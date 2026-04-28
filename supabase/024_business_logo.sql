-- Migration 024: Business logo
-- logo_url already exists in Business type; ensure column + storage bucket

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Storage bucket for business logos (public, 1MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Business owners upload logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: logos are publicly readable
CREATE POLICY "Logos are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'business-logos');

-- RLS: owners can delete their own logo
CREATE POLICY "Business owners delete logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
