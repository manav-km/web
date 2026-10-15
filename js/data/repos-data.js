/**
 * repos-data.js — complete local dataset for all 16 GitHub repositories of manav-km.
 * Contains file counts, language breakdowns & percentages, creation dates,
 * and latest update timestamps. Ensures the portfolio displays all 16 repos
 * immediately with full details even if GitHub unauthenticated API rate limits are hit.
 */
export const ALL_REPOSITORIES = [
  {
    repo_name: "aerovent",
    name: "aerovent",
    source: "manav-km",
    description: "Self-powered ventilated footwear platform that converts natural walking motion into continuous airflow and cooling.",
    github_url: "https://github.com/manav-km/aerovent",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 44 },
      { name: "CSS", percent: 42 },
      { name: "JavaScript", percent: 14 }
    ],
    file_count: 8,
    created_at: "2026-06-13T19:56:34Z",
    pushed_at: "2026-06-14T04:25:13Z",
    updated_at: "2026-10-15T18:51:34Z"
  },
  {
    repo_name: "ailifecycle",
    name: "ailifecycle",
    source: "manav-km",
    description: "Interactive educational web guide demonstrating the stages and core principles of the AI project lifecycle.",
    github_url: "https://github.com/manav-km/ailifecycle",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 79 },
      { name: "CSS", percent: 21 }
    ],
    file_count: 3,
    created_at: "2026-07-02T13:49:47Z",
    pushed_at: "2026-07-02T13:57:10Z",
    updated_at: "2026-10-15T18:51:37Z"
  },
  {
    repo_name: "aiuniverse",
    name: "aiuniverse",
    source: "manav-km",
    description: "Curated discovery directory and comparison portal for state-of-the-art artificial intelligence tools and models.",
    github_url: "https://github.com/manav-km/aiuniverse",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 40 },
      { name: "CSS", percent: 32 },
      { name: "JavaScript", percent: 28 }
    ],
    file_count: 10,
    created_at: "2026-06-13T19:51:41Z",
    pushed_at: "2026-06-13T19:53:22Z",
    updated_at: "2026-10-15T18:51:39Z"
  },
  {
    repo_name: "artigianoscarpa",
    name: "artigianoscarpa",
    source: "manav-km",
    description: "Luxury bespoke Italian footwear showcase and artisan custom shoe customization concept.",
    github_url: "https://github.com/manav-km/artigianoscarpa",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 100 }
    ],
    file_count: 2,
    created_at: "2026-06-14T05:00:47Z",
    pushed_at: "2026-06-14T05:07:58Z",
    updated_at: "2026-10-15T18:51:41Z"
  },
  {
    repo_name: "butterandbloom",
    name: "butterandbloom",
    source: "manav-km",
    description: "Premium artisanal bakery & Parisian pâtisserie web platform with online ordering and custom cake requests.",
    github_url: "https://github.com/manav-km/butterandbloom",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 69 },
      { name: "CSS", percent: 19 },
      { name: "JavaScript", percent: 12 }
    ],
    file_count: 40,
    created_at: "2026-06-13T19:43:49Z",
    pushed_at: "2026-06-13T19:45:48Z",
    updated_at: "2026-10-15T18:51:43Z"
  },
  {
    repo_name: "canvaslife",
    name: "canvaslife",
    source: "manav-km",
    description: "Futuristic career exploration and simulation platform letting students test-drive career paths before deciding.",
    github_url: "https://github.com/manav-km/canvaslife",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "JavaScript",
    languages: [
      { name: "JavaScript", percent: 60 },
      { name: "CSS", percent: 25 },
      { name: "HTML", percent: 15 }
    ],
    file_count: 15,
    created_at: "2026-06-14T04:14:57Z",
    pushed_at: "2026-06-14T04:19:40Z",
    updated_at: "2026-10-15T18:51:45Z"
  },
  {
    repo_name: "cosmic-citadel",
    name: "cosmic-citadel",
    source: "manav-km",
    description: "Interactive space encyclopedia and celestial exploration portal featuring star maps, cosmic data, and quizzes.",
    github_url: "https://github.com/manav-km/cosmic-citadel",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 94 },
      { name: "CSS", percent: 5 },
      { name: "JavaScript", percent: 1 }
    ],
    file_count: 11,
    created_at: "2026-06-14T14:57:06Z",
    pushed_at: "2026-06-14T14:59:14Z",
    updated_at: "2026-10-15T18:51:46Z"
  },
  {
    repo_name: "fintrack",
    name: "fintrack",
    source: "manav-km",
    description: "Modern personal finance web app with expense tracking, income analytics, budget goals, and Firebase sync.",
    github_url: "https://github.com/manav-km/fintrack",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 48 },
      { name: "JavaScript", percent: 39 },
      { name: "CSS", percent: 13 }
    ],
    file_count: 42,
    created_at: "2026-07-25T13:07:50Z",
    pushed_at: "2026-07-25T13:24:32Z",
    updated_at: "2026-10-15T18:51:49Z"
  },
  {
    repo_name: "fontforgeai",
    name: "fontforgeai",
    source: "manav-km",
    description: "Generative AI typography platform enabling users to describe typeface concepts and generate custom font families.",
    github_url: "https://github.com/manav-km/fontforgeai",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 70 },
      { name: "JavaScript", percent: 17 },
      { name: "CSS", percent: 12 }
    ],
    file_count: 6,
    created_at: "2026-06-14T14:52:11Z",
    pushed_at: "2026-06-14T14:55:58Z",
    updated_at: "2026-10-15T18:51:51Z"
  },
  {
    repo_name: "fontforgeaitest",
    name: "fontforgeaitest",
    source: "manav-km",
    description: "Experimental React & Vite studio for the FontForge AI typeface engine with live vector glyph rendering.",
    github_url: "https://github.com/manav-km/fontforgeaitest",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "JavaScript",
    languages: [
      { name: "JavaScript", percent: 42 },
      { name: "HTML", percent: 32 },
      { name: "CSS", percent: 26 }
    ],
    file_count: 9,
    created_at: "2026-06-14T17:50:46Z",
    pushed_at: "2026-06-14T17:53:31Z",
    updated_at: "2026-10-15T18:51:53Z"
  },
  {
    repo_name: "kairos",
    name: "kairos",
    source: "manav-km",
    description: "Deep-learning knowledge mastery platform turning curiosities into visual knowledge maps and companion audio briefings.",
    github_url: "https://github.com/manav-km/kairos",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "JavaScript",
    languages: [
      { name: "JavaScript", percent: 54 },
      { name: "CSS", percent: 29 },
      { name: "HTML", percent: 17 }
    ],
    file_count: 10,
    created_at: "2026-06-14T03:53:34Z",
    pushed_at: "2026-06-14T19:04:37Z",
    updated_at: "2026-10-15T18:51:56Z"
  },
  {
    repo_name: "lib.docs",
    name: "lib.docs",
    source: "manav-km",
    description: "Developer documentation hub and architecture specifications for the Seth Anandram Jaipuria School Library system.",
    github_url: "https://github.com/manav-km/lib.docs",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 65 },
      { name: "CSS", percent: 35 }
    ],
    file_count: 4,
    created_at: "2026-08-12T17:35:06Z",
    pushed_at: "2026-08-13T19:21:03Z",
    updated_at: "2026-10-15T18:51:58Z"
  },
  {
    repo_name: "library",
    name: "library",
    source: "manav-km",
    description: "Comprehensive school library management platform with book discovery, student/teacher dashboards, and community discussions.",
    github_url: "https://github.com/manav-km/library",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "JavaScript",
    languages: [
      { name: "JavaScript", percent: 61 },
      { name: "HTML", percent: 29 },
      { name: "CSS", percent: 9 },
      { name: "Python", percent: 1 }
    ],
    file_count: 64,
    created_at: "2026-08-05T18:55:23Z",
    pushed_at: "2026-08-13T19:19:02Z",
    updated_at: "2026-10-15T18:52:00Z"
  },
  {
    repo_name: "nexboard",
    name: "nexboard",
    source: "manav-km",
    description: "Interactive digital whiteboard application built for intuitive classroom teaching, sketch-noting, and real-time collaboration.",
    github_url: "https://github.com/manav-km/nexboard",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 100 }
    ],
    file_count: 5,
    created_at: "2026-09-04T17:09:07Z",
    pushed_at: "2026-09-04T17:51:21Z",
    updated_at: "2026-10-15T18:52:03Z"
  },
  {
    repo_name: "velvetbites",
    name: "velvetbites",
    source: "manav-km",
    description: "Editorial culinary discovery and reservation platform for award-winning luxury restaurants and fine-dining experiences.",
    github_url: "https://github.com/manav-km/velvetbites",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "HTML",
    languages: [
      { name: "HTML", percent: 100 }
    ],
    file_count: 5,
    created_at: "2026-06-12T05:28:24Z",
    pushed_at: "2026-06-14T08:38:48Z",
    updated_at: "2026-10-15T18:52:05Z"
  },
  {
    repo_name: "web",
    name: "web",
    source: "manav-km",
    description: "Personal developer portfolio and client portal with Firebase Auth, Realtime Database, and FastAPI backend.",
    github_url: "https://github.com/manav-km/web",
    stars: 0,
    forks: 0,
    open_issues: 0,
    primary_language: "Python",
    languages: [
      { name: "Python", percent: 30 },
      { name: "HTML", percent: 29 },
      { name: "JavaScript", percent: 26 },
      { name: "CSS", percent: 10 },
      { name: "PLpgSQL", percent: 6 }
    ],
    file_count: 143,
    created_at: "2026-06-11T15:00:08Z",
    pushed_at: "2026-10-15T19:01:44Z",
    updated_at: "2026-10-15T19:01:50Z"
  }
];
