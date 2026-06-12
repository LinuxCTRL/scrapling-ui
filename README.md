# Scrapling UI 🕵️‍♂️✨

An interactive, visual web scraping studio built on top of **Scrapling** and **Playwright**. It lets you load pages inside a headless browser canvas, inspect network API calls, hover and select page elements (with automatic CSS Selector & XPath generation), record browser interactions, and generate clean Python Scrapling scripts in real time.

---

## 🚀 Key Features

1. **Interactive Headless Canvas**: Enter any URL and interact with the page (click, fill forms, scroll) using screenshots captured from a headless Chromium instance.
2. **Full-Page Scrollable Viewport**: Captures full-page screenshots dynamically, aligning coordinates using document-relative offsets, enabling smooth local scrolling of long target pages.
3. **Canvas Navigation & Scroll Controls**: Toolbar buttons for **Go Back**, **Go Forward**, **Reload Page**, **Scroll Up**, and **Scroll Down** to navigate and control the remote browser easily.
4. **Smart Element Selection & CSS Selectors**: Hover and select elements with automatic CSS Selector and XPath generation. Includes **digit-safe ID selectors** (e.g. `[id="48509143"]` instead of hex-escaped `#\34 ...`) to prevent Playwright locator timeouts on numeric IDs.
5. **Visual List Extraction (Multi-Item Scraper)**: Click a list item, choose "Extract List Column", generalize the CSS selector, and preview the parsed column data aligned in a real-time table at the bottom of your workspace.
6. **Network Log Sniffer**: Monitor all requests and API endpoints (Fetch/XHR, scripts, styles, images) called by the site, with a full payload and response inspector.
7. **Interactive Recipe Editor (Rearrange & Rollback)**: Make timeline cards draggable to reorder them, or delete cards. The backend automatically replays the timeline context to match the new history.
8. **Anti-Bot & Stealth UI Toggles**: Sync settings for Cloudflare Bypassing, Ad Blocking, and Speed Mode (disabling images/stylesheets) directly to the generated code.
9. **Multi-Framework Exporters**: Dropdown menu to export your visual recipes into **Async Scrapling**, **Raw Playwright (Python/Node.js)**, or **Scrapy Spiders**.
10. **Save & Load Recipes**: Export and import your visual timelines as local `.json` configuration templates.
11. **Syntax Highlighting**: Real-time syntax highlighting in the Python editor panel.
12. **Automatic Zombie State Protection**: The frontend automatically resets its state when backend sessions expire or when Uvicorn restarts during development, preventing locked or unresponsive UI states.

---

## 🛠 Tech Stack

- **Backend**: Python 3.14 (FastAPI + Playwright) managed by `uv`
- **Frontend**: React + TypeScript (Vite + Lucide Icons) managed by `bun`
- **Styling**: Modern, premium dark-mode developer console using Vanilla CSS variables

---

## ⚙️ Running Locally

First, ensure you have `uv` and `bun` installed on your machine.

### Run both servers (recommended)
Execute the unified startup script in the root directory:
```bash
./start.sh
```
This script concurrently starts:
- The FastAPI backend on `http://127.0.0.1:8000`
- The React Vite dev server on `http://localhost:5173`

Open **[http://localhost:5173](http://localhost:5173)** in your browser to start scraping!

---

## 📁 Project Structure

The backend is organized as modular Python packages following clean architecture principles:

- `backend/`
  - `main.py`: Entrypoint coordinate script registering FastAPI endpoints and middleware.
  - `models.py`: Pydantic request/response validation models.
  - `core/`
    - `browser_manager.py`: Playwright Chromium launcher lifespan manager.
    - `session.py`: Browser context, event listener handlers, DOM serializer, and history replayer.
    - `dom_extractor.py`: JavaScript DOM parser client script executed inside Chromium.
  - `services/`
    - `code_generator.py`: Visual recipe compiler compiling history into python files.
    - `code_runner.py`: Execution code runner preprocesses and executes python code.
- `frontend/`
  - `src/App.tsx`: Central state sync, workspace panels, and API communication.
  - `src/components/`: Modular React components for the split-pane DevTools (CanvasView, WorkflowBuilder, CodeRunner, TodoList, etc.).
  - `src/index.css`: Elegant developer design system with custom scrollbars and hover indicators.
