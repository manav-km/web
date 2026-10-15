-- 0003_seed_initial_content.sql — initial projects and repositories.
-- Projects are seeded as DRAFTS with placeholder descriptions (nothing invented):
-- open /portfolio/admin -> Projects, write the real description, pick the right
-- category, and publish. Repositories fill in stars/forks/languages on GitHub sync.

insert into projects (name, description, category, github_url, website_url, status, sort_order) values
  ('Library',    'Comprehensive school library management platform with book discovery, student/teacher dashboards, and community discussions.', 'websites', 'https://github.com/manav-km/library',    'https://manav-km.github.io/library',    'draft', 1),
  ('NexBoard',   'Interactive digital whiteboard application built for intuitive classroom teaching, sketch-noting, and real-time collaboration.', 'websites', 'https://github.com/manav-km/nexboard',   'https://manav-km.github.io/nexboard',   'draft', 2),
  ('VelvetBites','Editorial culinary discovery and reservation platform for award-winning luxury restaurants and fine-dining experiences.', 'websites', 'https://github.com/manav-km/velvetbites','https://manav-km.github.io/velvetbites','draft', 3),
  ('AeroVent',   'Self-powered ventilated footwear platform that converts natural walking motion into continuous airflow and cooling.', 'websites', 'https://github.com/manav-km/aerovent',   'https://manav-km.github.io/aerovent',   'draft', 4);

insert into repositories (source, repo_name, github_url) values
  ('manav-km', 'aerovent',        'https://github.com/manav-km/aerovent'),
  ('manav-km', 'ailifecycle',     'https://github.com/manav-km/ailifecycle'),
  ('manav-km', 'aiuniverse',      'https://github.com/manav-km/aiuniverse'),
  ('manav-km', 'artigianoscarpa', 'https://github.com/manav-km/artigianoscarpa'),
  ('manav-km', 'butterandbloom',  'https://github.com/manav-km/butterandbloom'),
  ('manav-km', 'canvaslife',      'https://github.com/manav-km/canvaslife'),
  ('manav-km', 'cosmic-citadel',  'https://github.com/manav-km/cosmic-citadel'),
  ('manav-km', 'fintrack',        'https://github.com/manav-km/fintrack'),
  ('manav-km', 'fontforgeai',     'https://github.com/manav-km/fontforgeai'),
  ('manav-km', 'fontforgeaitest', 'https://github.com/manav-km/fontforgeaitest'),
  ('manav-km', 'kairos',          'https://github.com/manav-km/kairos'),
  ('manav-km', 'lib.docs',        'https://github.com/manav-km/lib.docs'),
  ('manav-km', 'library',         'https://github.com/manav-km/library'),
  ('manav-km', 'nexboard',        'https://github.com/manav-km/nexboard'),
  ('manav-km', 'velvetbites',     'https://github.com/manav-km/velvetbites'),
  ('manav-km', 'web',             'https://github.com/manav-km/web')
on conflict (source, repo_name) do nothing;
