-- 0003_seed_initial_content.sql — the six repos/projects from the spec.
-- Projects are seeded as DRAFTS with placeholder descriptions (nothing invented):
-- open /portfolio/admin -> Projects, write the real description, pick the right
-- category, and publish. Repositories fill in stars/forks/languages on first GitHub sync.

insert into projects (name, description, category, github_url, website_url, status, sort_order) values
  ('Library',    'Description coming soon.', 'websites', 'https://github.com/manav-km/library',    'https://manav-km.github.io/library',    'draft', 1),
  ('NexBoard',   'Description coming soon.', 'websites', 'https://github.com/manav-km/nexboard',   'https://manav-km.github.io/nexboard',   'draft', 2),
  ('VelvetBites','Description coming soon.', 'websites', 'https://github.com/manav-km/velvetbites','https://manav-km.github.io/velvetbites','draft', 3),
  ('AeroVent',   'Description coming soon.', 'websites', 'https://github.com/manav-km/aerovent',   'https://manav-km.github.io/aerovent',   'draft', 4);

insert into repositories (source, repo_name, github_url) values
  ('manav-km', 'library',     'https://github.com/manav-km/library'),
  ('manav-km', 'nexboard',    'https://github.com/manav-km/nexboard'),
  ('manav-km', 'velvetbites', 'https://github.com/manav-km/velvetbites'),
  ('manav-km', 'aerovent',    'https://github.com/manav-km/aerovent')
on conflict (source, repo_name) do nothing;
