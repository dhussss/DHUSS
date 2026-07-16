-- Create the private logo bucket used by authenticated profile editing.
-- Object access remains restricted to the signed-in user's own top-level folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  false,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'trade_tracker_read_own_business_logos'
  ) THEN
    CREATE POLICY "trade_tracker_read_own_business_logos"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'business-logos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'trade_tracker_upload_own_business_logos'
  ) THEN
    CREATE POLICY "trade_tracker_upload_own_business_logos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'business-logos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'trade_tracker_update_own_business_logos'
  ) THEN
    CREATE POLICY "trade_tracker_update_own_business_logos"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'business-logos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      )
      WITH CHECK (
        bucket_id = 'business-logos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'trade_tracker_delete_own_business_logos'
  ) THEN
    CREATE POLICY "trade_tracker_delete_own_business_logos"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'business-logos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;
END
$$;
