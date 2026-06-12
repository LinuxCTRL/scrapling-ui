# Scrapling UI 🕵️‍♂️✨

An interactive, visual web scraping studio built on top of **Scrapling** and **Playwright**. It lets you load pages inside a headless browser canvas, inspect network API calls, hover and select page elements (with automatic CSS Selector & XPath generation), record browser interactions, and generate clean Python Scrapling scripts in real time.

---

## 🚀 Key Features

1. **Interactive Headless Canvas**: Enter any URL and interact with the page (click, fill forms, scroll) using screenshots captured from a headless Chromium instance.
2. **Network Log Sniffer**: Monitor all requests and API endpoints (Fetch/XHR, scripts, styles, images) called by the site, with a full payload and response inspector.
3. **DOM Elements Inspector**: Navigate the page's HTML tree (DevTools style) or hover over elements on the screenshot to instantly get their unique CSS selector, XPath, text, and properties.
4. **Visual Scrapling Recipe Builder**: Perform steps like clicks, inputs, or visual extractions, and see the steps documented on a linear timeline.
5. **Real-time Python Code Generator**: Automatically compiles your visual recipe into stealthy, executable Python code utilizing Scrapling's `StealthyFetcher`.

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

- `backend/`
  - `main.py`: FastAPI server handling Playwright context, actions, network tracking, and code generation.
  - `dom_extractor.py`: Client-side JavaScript DOM crawler executed inside Playwright.
- `frontend/`
  - `src/App.tsx`: Layout container, state sync, and HTTP communications.
  - `src/components/`: Modular React components for the split-pane DevTools.
  - `src/index.css`: Elegant developers design system with custom scrollbars and hover indicators.
