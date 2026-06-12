import os
import uuid
import base64
import asyncio
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from dom_extractor import DOM_EXTRACTOR_JS

class StartSessionRequest(BaseModel):
    url: str
    width: int = 1280
    height: int = 800

class ActionRequest(BaseModel):
    session_id: str
    action_type: str  # "click", "fill", "scroll", "navigate", "extract"
    selector: Optional[str] = None
    value: Optional[str] = None  # Text to type, or extractor details
    x: Optional[int] = None
    y: Optional[int] = None
    extract_name: Optional[str] = None
    extract_attribute: Optional[str] = None  # "text", "html", or specific attribute like "href"

class CloseSessionRequest(BaseModel):
    session_id: str

class GenerateCodeRequest(BaseModel):
    session_id: str

class Session:
    def __init__(self, session_id: str, browser: Browser, context: BrowserContext, page: Page):
        self.session_id = session_id
        self.browser = browser
        self.context = context
        self.page = page
        self.network_logs: List[Dict[str, Any]] = []
        self.history: List[Dict[str, Any]] = []
        self._request_map = {}

        # Set up listeners
        self.page.on("request", self._handle_request)
        self.page.on("response", self._handle_response)

    async def _handle_request(self, request):
        req_id = str(uuid.uuid4())
        self._request_map[request] = req_id
        
        post_data = None
        try:
            post_data = request.post_data
        except Exception:
            pass

        self.network_logs.append({
            "id": req_id,
            "url": request.url,
            "method": request.method,
            "resource_type": request.resource_type,
            "request_headers": dict(request.headers),
            "post_data": post_data,
            "status": None,
            "response_headers": None,
            "response_body": None,
            "size": 0,
        })

    async def _handle_response(self, response):
        request = response.request
        req_id = self._request_map.get(request)
        
        entry = None
        if req_id:
            for log in self.network_logs:
                if log["id"] == req_id:
                    entry = log
                    break
        else:
            for log in reversed(self.network_logs):
                if log["url"] == response.url and log["method"] == request.method and log["status"] is None:
                    entry = log
                    break

        if not entry:
            return

        entry["status"] = response.status
        try:
            entry["response_headers"] = dict(response.headers)
        except Exception:
            pass
        
        try:
            sizes = await response.sizes()
            entry["size"] = sizes.get("responseHeadersSize", 0) + sizes.get("responseBodySize", 0)
        except Exception:
            pass

        try:
            content_type = response.headers.get("content-type", "").lower()
            if any(t in content_type for t in ["json", "text", "xml", "javascript", "html"]):
                body = await response.text()
                if len(body) > 50000:
                    entry["response_body"] = body[:50000] + "\n... [TRUNCATED]"
                else:
                    entry["response_body"] = body
            else:
                entry["response_body"] = "[Non-text response]"
        except Exception:
            entry["response_body"] = "[Body reading failed/aborted]"

    async def get_state(self):
        # Wait a small bit for any rendering/animations to settle
        await asyncio.sleep(0.5)

        # Viewport screenshot
        screenshot_bytes = await self.page.screenshot(type="jpeg", quality=80)
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
        screenshot_data_uri = f"data:image/jpeg;base64,{screenshot_b64}"
        
        # DOM Tree
        try:
            dom_tree = await self.page.evaluate(DOM_EXTRACTOR_JS)
        except Exception as e:
            print(f"Error evaluating DOM Extractor JS: {e}")
            dom_tree = None

        return {
            "session_id": self.session_id,
            "screenshot": screenshot_data_uri,
            "dom_tree": dom_tree,
            "network_logs": self.network_logs,
            "history": self.history
        }

    async def close(self):
        try:
            await self.page.close()
            await self.context.close()
        except Exception as e:
            print(f"Error closing session: {e}")

class PlaywrightManager:
    def __init__(self):
        self.playwright = None
        self.browser = None

    async def start(self):
        if not self.playwright:
            self.playwright = await async_playwright().start()
            # Launch Chromium with args to disable CORS and allow mixed content
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-web-security",
                    "--allow-running-insecure-content",
                    "--disable-site-isolation-trials"
                ]
            )

    async def stop(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

pw_manager = PlaywrightManager()
active_sessions: Dict[str, Session] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    await pw_manager.start()
    yield
    # Clean up sessions
    for session in list(active_sessions.values()):
        await session.close()
    active_sessions.clear()
    await pw_manager.stop()

app = FastAPI(lifespan=lifespan)

# Add CORS Middleware
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
        
        session = Session(session_id, pw_manager.browser, context, page)
        active_sessions[session_id] = session
        
        # Navigate to target URL
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
            y_scroll = req.y if req.y is not None else 300
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
            # Visual extract doesn't change page state, just appends to history log for code gen
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action type: {req.action_type}")
            
        return await session.get_state()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action failed: {str(e)}")

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

class RunCodeRequest(BaseModel):
    code: str
    session_id: Optional[str] = None

def make_code_async(code: str) -> str:
    normalized = code
    methods = ["click", "fill", "wait_for_load_state", "evaluate", "wait_for_timeout"]
    for method in methods:
        normalized = normalized.replace(f"await page.{method}(", f"page.{method}(")
    normalized = normalized.replace("def perform_actions(page):", "async def perform_actions(page):")
    for method in methods:
        normalized = normalized.replace(f"page.{method}(", f"await page.{method}(")
    return normalized

@app.post("/api/run-code")
async def run_code(req: RunCodeRequest):
    import sys
    import tempfile
    import io
    import traceback
    from contextlib import redirect_stdout, redirect_stderr
    
    session = active_sessions.get(req.session_id) if req.session_id else None
    
    if session:
        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        async_code = make_code_async(req.code)
        
        try:
            with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
                local_vars = {}
                exec(async_code, globals(), local_vars)
                perform_actions = local_vars.get("perform_actions")
                if perform_actions:
                    await perform_actions(session.page)
            
            exit_code = 1 if stderr_buf.getvalue() else 0
            state = await session.get_state()
            return {
                "stdout": stdout_buf.getvalue() or "Script executed successfully on the active browser page.",
                "stderr": stderr_buf.getvalue(),
                "exit_code": exit_code,
                "state": state
            }
        except Exception as e:
            err_msg = traceback.format_exc()
            return {
                "stdout": stdout_buf.getvalue(),
                "stderr": err_msg,
                "exit_code": 1,
                "state": await session.get_state()
            }
    else:
        try:
            with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as f:
                f.write(req.code)
                temp_file_path = f.name
                
            process = await asyncio.create_subprocess_exec(
                sys.executable, temp_file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                
            return {
                "stdout": stdout.decode("utf-8", errors="ignore"),
                "stderr": stderr.decode("utf-8", errors="ignore"),
                "exit_code": process.returncode,
                "state": None
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to run code: {str(e)}")

def generate_scrapling_code(history: List[Dict[str, Any]]) -> str:
    lines = []
    lines.append("# Generated by Scrapling Visual Builder")
    lines.append("from scrapling.fetchers import StealthyFetcher")
    lines.append("")
    
    start_url = "https://example.com"
    for step in history:
        if step["action"] == "navigate":
            start_url = step["url"]
            break

    interactions = [step for step in history if step["action"] in ["click", "fill", "scroll"]]
    extractions = [step for step in history if step["action"] == "extract"]
    
    if interactions:
        lines.append("def perform_actions(page):")
        for step in interactions:
            action = step["action"]
            selector = step.get("selector", "").replace('\\', '\\\\')
            
            if action == "click":
                lines.append(f"    # Click element")
                lines.append(f"    page.click('{selector}')")
                lines.append("    page.wait_for_load_state('load')")
                lines.append("")
            elif action == "fill":
                lines.append(f"    # Fill input field")
                lines.append(f"    page.fill('{selector}', '{step['value']}')")
                lines.append("")
            elif action == "scroll":
                lines.append(f"    # Scroll page")
                lines.append(f"    page.evaluate('window.scrollBy(0, {step['y']})')")
                lines.append("    page.wait_for_timeout(1000)")
                lines.append("")
        
        lines.append("def run_scraper():")
        lines.append(f"    # Fetch the page stealthily and run automation actions")
        lines.append(f"    response = StealthyFetcher.fetch('{start_url}', headless=True, page_action=perform_actions)")
        lines.append("")
    else:
        lines.append("def run_scraper():")
        lines.append(f"    # Fetch page stealthily")
        lines.append(f"    response = StealthyFetcher.fetch('{start_url}', headless=True)")
        lines.append("")

    if extractions:
        lines.append("    # Extract data")
        for step in extractions:
            var_name = step.get("name", "data").lower().replace(" ", "_")
            selector = step["selector"].replace('\\', '\\\\')
            attr = step["attribute"]
            
            if attr == "text":
                lines.append(f"    # Get text from '{selector}'")
                lines.append(f"    {var_name} = response.css('{selector}::text').get_all()")
            elif attr == "html":
                lines.append(f"    # Get HTML content")
                lines.append(f"    {var_name} = response.css('{selector}').get_all()")
            else:
                lines.append(f"    # Get '{attr}' attribute")
                lines.append(f"    {var_name} = response.css('{selector}::attr({attr})').get_all()")
                
            lines.append(f"    print('{step['name']}:', {var_name})")
            lines.append("")
            
    lines.append("if __name__ == '__main__':")
    lines.append("    run_scraper()")
    
    return "\n".join(lines)
