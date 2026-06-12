import os
import uuid
import re
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Local module imports
from models import (
    StartSessionRequest,
    ActionRequest,
    CloseSessionRequest,
    GenerateCodeRequest,
    UpdateHistoryRequest,
    RunCodeRequest,
    TodoListUpdateRequest,
    QuerySelectorRequest,
    SaveJobRequest,
    ToggleJobRequest
)
from core.browser_manager import pw_manager
from core.session import Session, active_sessions
from services.code_generator import generate_scrapling_code
from services.code_runner import execute_run_code
from core.db import get_all_jobs, get_job, save_job, delete_job, update_job_enabled
from services.scheduler import start_scheduler, stop_scheduler, run_crawler_job, sync_db_to_scheduler, scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Playwright browser manager
    await pw_manager.start()
    # Start background scheduler
    start_scheduler()
    yield
    # Stop background scheduler
    stop_scheduler()
    # Clean up active browser sessions
    for session in list(active_sessions.values()):
        await session.close()
    active_sessions.clear()
    # Close browser manager
    await pw_manager.stop()

app = FastAPI(lifespan=lifespan)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/session/start")
async def start_session(req: StartSessionRequest):
    if not pw_manager.browser:
        raise HTTPException(status_code=500, detail="Browser manager not initialized")
    
    session_id = str(uuid.uuid4())
    try:
        # Create a new context and page
        context = await pw_manager.browser.new_context(
            viewport={"width": req.width, "height": req.height},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        session = Session(
            session_id, 
            pw_manager.browser, 
            context, 
            page,
            solve_cloudflare=req.solve_cloudflare,
            block_ads=req.block_ads,
            disable_resources=req.disable_resources
        )
        active_sessions[session_id] = session
        
        # Configure route blocking for Ad Blocking & Speed Mode
        if req.block_ads or req.disable_resources:
            async def route_filter(route, request):
                url = request.url.lower()
                resource_type = request.resource_type
                
                # Speed Mode: block media, fonts, images, stylesheets
                if req.disable_resources and resource_type in ["image", "media", "font", "stylesheet"]:
                    await route.abort()
                # Ad Blocking: check simple ad-blocking patterns
                elif req.block_ads and any(ad_word in url for ad_word in ["googleads", "googlesyndication", "doubleclick", "adservice", "analytics", "telemetry"]):
                    await route.abort()
                else:
                    await route.continue_()
            
            await page.route("**/*", route_filter)
            
        # Add a default navigate step in history
        session.history.append({"action": "navigate", "url": req.url})
        
        await page.goto(req.url, wait_until="load", timeout=30000)
        
        return await session.get_state()
    except Exception as e:
        # Cleanup if failure occurs during start
        if session_id in active_sessions:
            await active_sessions[session_id].close()
            del active_sessions[session_id]
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")

@app.post("/api/session/action")
async def execute_action(req: ActionRequest):
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        if req.action_type == "click":
            if not req.selector:
                raise HTTPException(status_code=400, detail="Selector required for click action")
            # Log action
            session.history.append({"action": "click", "selector": req.selector})
            # Click
            await session.page.click(req.selector, timeout=5000)
            
        elif req.action_type == "fill":
            if not req.selector or req.value is None:
                raise HTTPException(status_code=400, detail="Selector and value required for fill action")
            session.history.append({"action": "fill", "selector": req.selector, "value": req.value})
            await session.page.fill(req.selector, req.value, timeout=5000)
            
        elif req.action_type == "scroll":
            # Scroll relative to the page
            y_scroll = 300
            if req.value:
                try:
                    y_scroll = int(req.value)
                except ValueError:
                    pass
            elif req.y is not None:
                y_scroll = req.y
                
            session.history.append({"action": "scroll", "y": y_scroll})
            await session.page.evaluate(f"window.scrollBy(0, {y_scroll})")
            
        elif req.action_type == "navigate":
            if not req.value:
                raise HTTPException(status_code=400, detail="URL value required for navigate action")
            session.history.append({"action": "navigate", "url": req.value})
            await session.page.goto(req.value, wait_until="load", timeout=30000)
            
        elif req.action_type == "extract":
            if not req.selector or not req.extract_name or not req.extract_attribute:
                raise HTTPException(status_code=400, detail="Selector, extract_name, and extract_attribute required for extract action")
            session.history.append({
                "action": "extract",
                "name": req.extract_name,
                "selector": req.selector,
                "attribute": req.extract_attribute
            })

        elif req.action_type == "extract_list":
            if not req.selector or not req.extract_name or not req.extract_attribute:
                raise HTTPException(status_code=400, detail="Selector, extract_name, and extract_attribute required for extract_list action")
            session.history.append({
                "action": "extract_list",
                "name": req.extract_name,
                "selector": req.selector,
                "attribute": req.extract_attribute
            })
            
        elif req.action_type == "back":
            session.history.append({"action": "back"})
            try:
                await session.page.go_back(timeout=5000)
            except Exception as e:
                print(f"Warning: go_back failed (likely no history): {e}")
            
        elif req.action_type == "forward":
            session.history.append({"action": "forward"})
            try:
                await session.page.go_forward(timeout=5000)
            except Exception as e:
                print(f"Warning: go_forward failed (likely no history): {e}")
            
        elif req.action_type == "reload":
            session.history.append({"action": "reload"})
            await session.page.reload(timeout=20000)
            
        elif req.action_type == "pagination":
            if not req.selector or not req.value:
                raise HTTPException(status_code=400, detail="Selector and max_pages value required for pagination action")
            try:
                max_pages = int(req.value)
            except ValueError:
                raise HTTPException(status_code=400, detail="max_pages must be an integer")
            
            session.history.append({
                "action": "pagination",
                "selector": req.selector,
                "max_pages": max_pages
            })
            await session.page.click(req.selector, timeout=5000)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action type: {req.action_type}")
            
        return await session.get_state()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action failed: {str(e)}")

@app.post("/api/session/update-history")
async def update_history(req: UpdateHistoryRequest):
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        await session.replay_history(req.history)
        return await session.get_state()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/session/close")
async def close_session(req: CloseSessionRequest):
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await session.close()
    del active_sessions[req.session_id]
    return {"success": True}

@app.post("/api/generate-code")
async def generate_code(req: GenerateCodeRequest):
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {"code": generate_scrapling_code(session.history)}

@app.post("/api/run-code")
async def run_code(req: RunCodeRequest):
    try:
        return await execute_run_code(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/session/query-selector")
async def query_selector(req: QuerySelectorRequest):
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    js_eval = """
    (selector) => {
        try {
            let elms = [];
            if (selector.startsWith('/') || selector.startsWith('xpath=')) {
                let xpath = selector.startsWith('xpath=') ? selector.substring(6) : selector;
                let result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < result.snapshotLength; i++) {
                    elms.push(result.snapshotItem(i));
                }
            } else {
                elms = Array.from(document.querySelectorAll(selector));
            }
            return elms.map(el => {
                if (el.nodeType !== Node.ELEMENT_NODE) return null;
                const rect = el.getBoundingClientRect();
                return {
                    tag: el.tagName.toLowerCase(),
                    classes: Array.from(el.classList).join(' '),
                    id: el.id || '',
                    rect: {
                        x: Math.round(rect.left + (window.scrollX || window.pageXOffset || 0)),
                        y: Math.round(rect.top + (window.scrollY || window.pageYOffset || 0)),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    }
                };
            }).filter(e => e && e.rect.width > 0 && e.rect.height > 0);
        } catch (e) {
            return [];
        }
    }
    """
    try:
        matches = await session.page.evaluate(js_eval, req.selector)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

TODO_FILE_PATH = "/home/soufiane/Work/ai-scraper/todo_list.md"
ARTIFACT_TODO_PATH = "/home/soufiane/.gemini/antigravity-cli/brain/9c5acae8-27b0-4ae5-b750-ed8631c345a2/todo_list.md"

@app.get("/api/todo")
async def get_todo_list():
    path = TODO_FILE_PATH
    if not os.path.exists(path):
        path = ARTIFACT_TODO_PATH
        if not os.path.exists(path):
            return {"tasks": []}
            
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    lines = content.split('\n')
    tasks = []
    current_task = None
    
    for line in lines:
        main_match = re.match(r'^\s*-\s*\[([ xX])\]\s*\*\*(.*?)\*\*(?:\s*`\[(.*?)\]`)?', line)
        if main_match:
            checked = main_match.group(1).lower() == 'x'
            title = main_match.group(2).strip()
            status = main_match.group(3) or ("DONE" if checked else "TODO")
            current_task = {
                "title": title,
                "checked": checked,
                "status": status.strip().upper(),
                "subtasks": []
            }
            tasks.append(current_task)
            continue
            
        if current_task is not None:
            sub_match = re.match(r'^\s+-\s*(?:\[([ xX])\]\s*)?(.*)', line)
            if sub_match:
                sub_checked = False
                if sub_match.group(1):
                    sub_checked = sub_match.group(1).lower() == 'x'
                text = sub_match.group(2).strip()
                current_task["subtasks"].append({
                    "text": text,
                    "checked": sub_checked
                })
                
    return {"tasks": tasks}

@app.post("/api/todo")
async def update_todo_list(req: TodoListUpdateRequest):
    lines = [
        "# Scrapling UI - Feature Todo List",
        "",
        "This file tracks the status of major features and enhancements proposed to scale the visual web scraping builder.",
        "",
        "---",
        "",
        "## 📋 Features Checklist",
        ""
    ]
    for task in req.tasks:
        checkbox = "x" if task.checked else " "
        status_str = f" `[{task.status.upper()}]`" if task.status else ""
        lines.append(f"- [{checkbox}] **{task.title}**{status_str}")
        for sub in task.subtasks:
            sub_checkbox = "x" if sub.checked else " "
            lines.append(f"  - [{sub_checkbox}] {sub.text}")
            
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 🛠 Active Work")
    
    active_tasks = [t for t in req.tasks if t.status.upper() == "ACTIVE"]
    if active_tasks:
        lines.append(f"We are active on **{active_tasks[0].title}**.")
    else:
        lines.append("No active task selected. Choose one in the Scrapling UI!")
        
    md_content = "\n".join(lines) + "\n"
    
    for path in [TODO_FILE_PATH, ARTIFACT_TODO_PATH]:
        try:
            dir_name = os.path.dirname(path)
            if dir_name and not os.path.exists(dir_name):
                os.makedirs(dir_name, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(md_content)
        except Exception as e:
            print(f"Failed to write todo list to {path}: {e}")
            
    return {"status": "success", "tasks": req.tasks}

# Add scheduled endpoints
@app.get("/api/scheduler/jobs")
async def list_jobs():
    return {"jobs": get_all_jobs()}

@app.post("/api/scheduler/jobs")
async def create_or_update_job(req: SaveJobRequest):
    job_id = req.id if req.id else str(uuid.uuid4())
    job = save_job(
        job_id=job_id,
        name=req.name,
        url=req.url,
        history=req.history,
        cron_expression=req.cron_expression,
        webhook_url=req.webhook_url,
        enabled=req.enabled
    )
    sync_db_to_scheduler()
    return {"status": "success", "job": job}

@app.post("/api/scheduler/jobs/{job_id}/toggle")
async def toggle_job(job_id: str, req: ToggleJobRequest):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    update_job_enabled(job_id, req.enabled)
    sync_db_to_scheduler()
    return {"status": "success", "enabled": req.enabled}

@app.delete("/api/scheduler/jobs/{job_id}")
async def remove_job(job_id: str):
    delete_job(job_id)
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass
    return {"status": "success"}

@app.post("/api/scheduler/jobs/{job_id}/run")
async def trigger_job_run(job_id: str):
    import asyncio
    asyncio.create_task(run_crawler_job(job_id))
    return {"status": "success", "message": "Job execution triggered headlessly in background"}
