# Scrapling UI - Feature Todo List

This file tracks the status of major features and enhancements proposed to scale the visual web scraping builder.

---

## 📋 Features Checklist

- [x] **Visual List Extraction (Multi-Item Scraper)** `[DONE]`
  - [x] Add "Extract List Column" option to the element context menu.
  - [x] Implement pattern matching in the UI to highlight all sibling elements matching the CSS class.
  - [x] Render a "Data Preview Table" at the bottom showing columns and aligned rows.
  - [x] Update the Python generator to output loop-based extraction scripts (e.g. zipped lists).
- [ ] **Interactive Recipe Editor (Rearrange & Rollback)** `[TODO]`
  - Make recipe cards draggable/deletable.
  - Implement backend session re-indexing to replay modified steps on a new page load.
- [ ] **Anti-Bot & Stealth UI Toggles** `[TODO]`
  - Add switches in the URL header bar for Cloudflare Solving, Ad Blocking, and Speed Mode.
  - Sync UI toggles to update the generated python `StealthyFetcher` parameters.
- [ ] **Multi-Framework Exporters** `[TODO]`
  - Add dropdown to export scripts as Async Scrapling, raw Playwright (Python/Node), or Scrapy spiders.
- [ ] **Save & Load Recipes** `[TODO]`
  - Add buttons to export the visual history as a local `.json` configuration file.
  - Allow uploading a JSON recipe to restore the session timeline.

---

## 🛠 Active Work
We are starting **Visual List Extraction**. This will allow you to define multiple columns (e.g. Product Title, Link, Score), highlight all matching elements, preview the parsed table directly in the browser console, and compile loops in the final Python recipe.
