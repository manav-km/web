-- 0002_storage_buckets.sql — Supabase Storage buckets.
--
-- All four buckets are PUBLIC-READ (the images are shown on the public site anyway:
-- logos, certificates, thumbnails, cover images) but nobody can write to them
-- directly: no INSERT/UPDATE/DELETE policies exist for anon/authenticated roles, so
-- only the backend (service-role key -> signed upload URLs, validated for type and
-- size in /api/v1/admin/media/upload-url) can add or remove files.
-- File-size and MIME limits are also enforced by Supabase itself as a second layer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('project-logos',      'project-logos',      true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('achievement-images', 'achievement-images', true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('upload-thumbnails',  'upload-thumbnails',  true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('blog-images',        'blog-images',        true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('profile-pictures',   'profile-pictures',   true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

alter table media_assets enable row level security;  -- backend-only metadata table (no policies = deny all)
