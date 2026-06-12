import base64
import asyncio
import uuid
from typing import Dict, List, Any
from playwright.async_api import Browser, BrowserContext, Page
from .dom_extractor import DOM_EXTRACTOR_JS

class Session:
    def __init__(self, session_id: str, browser: Browser, context: BrowserContext, page: Page, solve_cloudflare: bool = True, block_ads: bool = True, disable_resources: bool = False):
        self.session_id = session_id
        self.browser = browser
        self.context = context
        self.page = page
        self.solve_cloudflare = solve_cloudflare
        self.block_ads = block_ads
        self.disable_resources = disable_resources
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

        # Capture full page screenshot so the user can scroll it in the canvas
        screenshot_bytes = await self.page.screenshot(type="jpeg", quality=80, full_page=True)
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
            "history": self.history,
            "scraped_data": await self.get_scraped_data()
        }

    async def get_scraped_data(self) -> List[Dict[str, str]]:
        list_steps = [s for s in self.history if s["action"] == "extract_list"]
        if not list_steps:
            return []
            
        columns = {}
        max_len = 0
        for step in list_steps:
            name = step.get("name", "data")
            selector = step.get("selector", "")
            attr = step.get("attribute", "text")
            escaped_selector = selector.replace("'", "\\'")
            
            js_query = f"""
            () => {{
                try {{
                    const elms = document.querySelectorAll('{escaped_selector}');
                    return Array.from(elms).map(el => {{
                        if ('{attr}' === 'text') return el.textContent ? el.textContent.trim() : '';
                        if ('{attr}' === 'html') return el.innerHTML || '';
                        return el.getAttribute('{attr}') || '';
                    }});
                }} catch (e) {{
                    return [];
                }}
            }}
            """
            try:
                vals = await self.page.evaluate(js_query)
                columns[name] = vals
                max_len = max(max_len, len(vals))
            except Exception as e:
                print(f"Error executing list extraction: {e}")
                columns[name] = []
                
        # Transform columns to rows
        rows = []
        for i in range(max_len):
            row = {}
            for col_name, col_vals in columns.items():
                row[col_name] = col_vals[i] if i < len(col_vals) else ""
            rows.append(row)
            
        return rows

    async def replay_history(self, new_history: List[Dict[str, Any]]):
        self.history = []
        self.network_logs = []
        self._request_map = {}
        
        # Find the navigate action
        start_url = None
        for step in new_history:
            if step["action"] == "navigate":
                start_url = step.get("url")
                break
                
        if not start_url:
            return
            
        try:
            await self.page.goto(start_url, wait_until="load", timeout=30000)
            self.history.append({"action": "navigate", "url": start_url})
        except Exception as e:
            print(f"Failed to navigate during replay: {e}")
            raise Exception(f"Failed to navigate to {start_url}: {e}")
            
        for step in new_history:
            action = step["action"]
            if action == "navigate":
                continue
                
            try:
                if action == "click":
                    selector = step["selector"]
                    await self.page.click(selector, timeout=5000)
                    self.history.append({"action": "click", "selector": selector})
                    
                elif action == "fill":
                    selector = step["selector"]
                    val = step["value"]
                    await self.page.fill(selector, val, timeout=5000)
                    self.history.append({"action": "fill", "selector": selector, "value": val})
                    
                elif action == "scroll":
                    y = step.get("y", 300)
                    await self.page.evaluate(f"window.scrollBy(0, {y})")
                    self.history.append({"action": "scroll", "y": y})
                    await asyncio.sleep(1.0)
                    
                elif action == "extract":
                    self.history.append({
                        "action": "extract",
                        "name": step["name"],
                        "selector": step["selector"],
                        "attribute": step["attribute"]
                    })
                    
                elif action == "extract_list":
                    self.history.append({
                        "action": "extract_list",
                        "name": step["name"],
                        "selector": step["selector"],
                        "attribute": step["attribute"]
                    })
                    
                elif action == "back":
                    try:
                        await self.page.go_back(timeout=5000)
                    except Exception:
                        pass
                    self.history.append({"action": "back"})
                    
                elif action == "forward":
                    try:
                        await self.page.go_forward(timeout=5000)
                    except Exception:
                        pass
                    self.history.append({"action": "forward"})
                    
                elif action == "reload":
                    await self.page.reload(timeout=20000)
                    self.history.append({"action": "reload"})
                    
                elif action == "pagination":
                    selector = step["selector"]
                    max_pages = step["max_pages"]
                    await self.page.click(selector, timeout=5000)
                    self.history.append({
                        "action": "pagination",
                        "selector": selector,
                        "max_pages": max_pages
                    })
            except Exception as e:
                print(f"Replay failed on step {step}: {e}")
                raise Exception(f"Failed to replay step '{action}' on '{step.get('selector', '')}': {str(e)}")

    async def close(self):
        try:
            await self.page.close()
            await self.context.close()
        except Exception as e:
            print(f"Error closing session: {e}")

active_sessions: Dict[str, Session] = {}
