-- Migration 045: Add missing UPDATE policy for business logo uploads
-- Without this, upsert:true fails on second upload because Supabase
-- Storage requires an explicit UPDATE policy when overwriting an object.

CREATE POLICY "Business owners update logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'business-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
