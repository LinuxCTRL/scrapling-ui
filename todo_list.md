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

## 🎉 Status: All Milestones Completed!
All proposed features on the Scrapling Visual Builder roadmap have been successfully engineered and are fully integrated into the live developer environment. The studio is now a production-grade visual scraping workbench.
