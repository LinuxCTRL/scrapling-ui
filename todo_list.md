# Scrapling UI - Feature Todo List

This file tracks the status of major features and enhancements proposed to scale the visual web scraping builder.

---

## 📋 Features Checklist

- [x] **Visual List Extraction (Multi-Item Scraper)** `[DONE]`
  - [x] Add "Extract List Column" option to the element context menu.
  - [x] Implement pattern matching in the UI to highlight all sibling elements matching the CSS class.
  - [x] Render a "Data Preview Table" at the bottom showing columns and aligned rows.
  - [x] Update the Python generator to output loop-based extraction scripts (e.g. zipped lists).
- [x] **Interactive Recipe Editor (Rearrange & Rollback)** `[DONE]`
  - [x] Make recipe cards draggable/deletable.
  - [x] Implement backend session re-indexing to replay modified steps on a new page load.
- [x] **Anti-Bot & Stealth UI Toggles** `[DONE]`
  - [x] Add switches in the URL header bar for Cloudflare Solving, Ad Blocking, and Speed Mode.
  - [x] Sync UI toggles to update the generated python `StealthyFetcher` parameters.
- [x] **Multi-Framework Exporters** `[DONE]`
  - [x] Add dropdown to export scripts as Async Scrapling, raw Playwright (Python/Node), or Scrapy spiders.
- [x] **Save & Load Recipes** `[DONE]`
  - [x] Add buttons to export the visual history as a local `.json` configuration file.
  - [x] Allow uploading a JSON recipe to restore the session timeline.

---

## 🚀 Advanced Features Checklist

- [x] **Milestone 1: Pagination Loop Wizard (Multi-Page Scraping)** `[DONE]`
  - [x] Add "Define Pagination Link" option and configuration form to the canvas context menu.
  - [x] Add pagination action handler in FastAPI backend and support session replay.
  - [x] Update Python code generator to compile nested page-by-page loops.
  - [x] Update frontend CodeRunner exporters for all frameworks.
- [x] **Milestone 2: Live Custom Selector Tester & Highlighter** `[DONE]`
  - [x] Add custom CSS/XPath selector search bar in DOM Elements tree sidebar.
  - [x] Implement backend endpoint `/api/session/query-selector` to evaluate selector matches.
  - [x] Add real-time highlight overlays on the interactive canvas.
- [ ] **Milestone 3: Scheduled Jobs & Webhook Exporters** `[ACTIVE]`
  - [ ] Set up local SQLite database `jobs.db` to save scraping templates (recipes).
  - [ ] Set up APScheduler in FastAPI to run background crawl jobs.
  - [ ] Create schedule configuration form and webhook exporter settings in frontend.
- [ ] **Milestone 4: Selector Self-Healing using DeepSeek LLM** `[TODO]`
  - [ ] Add AI Settings panel in frontend for DeepSeek API Key.
  - [ ] Implement DeepSeek API integration in backend.
  - [ ] Auto-heal broken selectors in Code Runner using LLM sibling/parent matching.

---

## 🎉 Status: Core Milestones Completed, Advanced Upgrades Underway!
All core features are finished. Currently implementing Milestone 2 of the advanced upgrades suite.
