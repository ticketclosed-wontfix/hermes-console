# Hermes Workspace — Feature Tracker

## Milestone 1: Skeleton + Chat

| # | Feature | Status | Tests | Notes |
|---|---------|--------|-------|-------|
| 1.1 | Project scaffold (Vite + React + TanStack Router + Tailwind) | done | — | |
| 1.2 | Hermes Obsidian theme (Stitch design system) | done | — | |
| 1.3 | Express middleware + auth proxy to gateway | done | unit | |
| 1.4 | Session history API (read state.db) | done | unit | |
| 1.5 | Messages API (read state.db) | done | unit | |
| 1.6 | Sidebar — session list, search, date grouping | done | unit + e2e | |
| 1.7 | Chat message thread — markdown, code blocks, shiki | done | unit + e2e | |
| 1.8 | Tool call accordion component | done | unit + e2e | |
| 1.9 | Thinking/reasoning collapsible block | done | unit | |
| 1.10 | SSE streaming from gateway | done | unit + e2e | |
| 1.11 | Input area — textarea, model selector, send | done | unit + e2e | |
| 1.12 | Right metadata panel — stats, tokens, cost | done | unit | |
| 1.13 | Full integration — session create/switch/chat | done | e2e | |

## Milestone 2: Dashboard + Jobs
| # | Feature | Status | Tests | Notes |
|---|---------|--------|-------|-------|
| 2.1 | Dashboard — health, sessions, activity | done | unit | Stats tiles, activity chart, recent sessions |
| 2.2 | Cron jobs list view | done | unit + e2e | Job cards with expand/collapse details |
| 2.3 | Job actions — pause/resume/run/delete | done | unit | Inline action buttons on each card |
| 2.4 | Create/edit job dialog | done | — | Modal dialogs with form fields |
| 2.5 | Sidebar navigation (Chat/Dashboard/Jobs) | done | — | Tab nav with route-aware active state |
| 2.6 | Vite proxy fix for /v1 route | done | — | |

## Milestone 3: Skills + Memory + Settings
| # | Feature | Status | Tests | Notes |
|---|---------|--------|-------|-------|
| 3.1 | Skills filesystem API | done | unit | Scan ~/.hermes/skills, parse frontmatter |
| 3.2 | Skills browser UI | done | unit | Category tree, search, click-into detail view |
| 3.3 | Memory API + viewer | done | unit | MEMORY.md + USER.md with capacity bars |
| 3.4 | Config API + settings screen | done | unit | config.yaml, SOUL.md, env vars (redacted) |

## Milestone 4: Files + Session History + Terminal
| # | Feature | Status | Tests | Notes |
|---|---------|--------|-------|-------|
| 4.1 | Filesystem API + file browser | done | unit | Tree view of ~/.hermes/, file viewer with line numbers |
| 4.2 | Session history search (FTS5) | done | unit | Full-text search with snippets, grouped by session |
| 4.3 | Embedded terminal (xterm.js) | done | — | node-pty over WebSocket, auto-fit, reconnect |

## Milestone 5: Polish + Deploy
| # | Feature | Status | Tests | Notes |
|---|---------|--------|-------|-------|
| 5.1 | Keyboard shortcuts | pending | e2e | |
| 5.2 | Session fork | pending | e2e | |
| 5.3 | Session export | pending | unit | |
| 5.4 | systemd service | pending | — | |
| 5.5 | Cloudflare tunnel (optional) | pending | — | |

## GLM5.1 Learnings
_Patterns observed during subagent implementation — updated after each review._

| Pattern | Frequency | Mitigation |
|---------|-----------|------------|
| (to be filled during development) | | |
