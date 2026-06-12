import sys
import tempfile
import io
import traceback
import asyncio
import os
from typing import Optional, Dict, Any
from contextlib import redirect_stdout, redirect_stderr
from session import Session, active_sessions
from models import RunCodeRequest

def make_code_async(code: str) -> str:
    normalized = code
    methods = ["click", "fill", "wait_for_load_state", "evaluate", "wait_for_timeout", "go_back", "go_forward", "reload"]
    for method in methods:
        normalized = normalized.replace(f"await page.{method}(", f"page.{method}(")
    # Safely handle perform_actions signature conversion, preventing async doubling
    normalized = normalized.replace("async def perform_actions(page):", "def perform_actions(page):")
    normalized = normalized.replace("def perform_actions(page):", "async def perform_actions(page):")
    for method in methods:
        normalized = normalized.replace(f"page.{method}(", f"await page.{method}(")
    return normalized

async def execute_run_code(req: RunCodeRequest):
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
            raise Exception(f"Failed to run code: {str(e)}")
