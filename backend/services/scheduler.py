import sys
import tempfile
import asyncio
import os
import requests
import ast
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from core.db import get_job, get_all_jobs, update_job_runs, update_job_enabled

# Initialize scheduler
scheduler = AsyncIOScheduler()

async def run_crawler_job(job_id: str):
    job = get_job(job_id)
    if not job or not job.get("enabled"):
        return
        
    print(f"⏰ [Scheduler] Triggered crawler run for job '{job['name']}' ({job_id})")
    
    # Imports code generator dynamically to avoid circular dependencies
    from services.code_generator import generate_scrapling_code
    
    # 1. Compile history into Python Scrapling recipe
    code = generate_scrapling_code(
        job["history"], 
        solve_cloudflare=True, 
        block_ads=True, 
        disable_resources=False
    )
    
    temp_file_path = None
    try:
        # 2. Write code to temp file
        with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w") as f:
            f.write(code)
            temp_file_path = f.name
            
        # 3. Launch subprocess headless run
        process = await asyncio.create_subprocess_exec(
            sys.executable, temp_file_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        stdout_str = stdout.decode("utf-8", errors="ignore")
        stderr_str = stderr.decode("utf-8", errors="ignore")
        
        # 4. Extract printed dictionary objects
        scraped_data = []
        for line in stdout_str.split("\n"):
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    item = ast.literal_eval(line)
                    if isinstance(item, dict):
                        scraped_data.append(item)
                except Exception:
                    pass
                    
        print(f"📊 [Scheduler] Job '{job['name']}' completed. Crawled {len(scraped_data)} items.")
        if stderr_str.strip():
            print(f"⚠️ [Scheduler] Warnings/Errors for '{job['name']}':\n{stderr_str}")
            
        # 5. Dispatch webhook POST
        if job.get("webhook_url") and scraped_data:
            webhook_url = job["webhook_url"]
            print(f"🌐 [Scheduler] POSTing payload to webhook: {webhook_url}")
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: requests.post(
                        webhook_url, 
                        json={
                            "job_id": job_id,
                            "job_name": job["name"],
                            "url": job["url"],
                            "timestamp": datetime.utcnow().isoformat(),
                            "count": len(scraped_data),
                            "data": scraped_data
                        }, 
                        headers={"Content-Type": "application/json"},
                        timeout=15
                    )
                )
                print(f"✅ [Scheduler] Webhook sent successfully for job '{job['name']}'")
            except Exception as wh_err:
                print(f"❌ [Scheduler] Webhook dispatch failed for job '{job['name']}': {wh_err}")
                
        # 6. Update database record with execution details
        last_run_str = datetime.utcnow().isoformat()
        
        # Calculate next run time
        aps_job = scheduler.get_job(job_id)
        next_run_str = None
        if aps_job and aps_job.next_run_time:
            next_run_str = aps_job.next_run_time.isoformat()
            
        update_job_runs(job_id, last_run_str, next_run_str)
        
    except Exception as e:
        print(f"❌ [Scheduler] Execution error running job '{job['name']}': {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass

def sync_db_to_scheduler():
    """Sync enabled SQLite db jobs into active APScheduler instance."""
    # 1. Clear existing jobs to reload
    for active_job in scheduler.get_jobs():
        scheduler.remove_job(active_job.id)
        
    jobs = get_all_jobs()
    for job in jobs:
        if job["enabled"]:
            try:
                scheduler.add_job(
                    run_crawler_job,
                    trigger=CronTrigger.from_crontab(job["cron_expression"]),
                    id=job["id"],
                    args=[job["id"]],
                    replace_existing=True
                )
                print(f"📅 [Scheduler] Scheduled job '{job['name']}' (Cron: {job['cron_expression']})")
                
                # Fetch next run time to save in db
                aps_job = scheduler.get_job(job["id"])
                if aps_job and aps_job.next_run_time:
                    update_job_runs(job["id"], job.get("last_run"), aps_job.next_run_time.isoformat())
            except Exception as e:
                print(f"❌ [Scheduler] Failed to schedule job '{job['name']}': {e}")

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("🚀 [Scheduler] APScheduler Background Service Started.")
        sync_db_to_scheduler()

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("🛑 [Scheduler] APScheduler Background Service Stopped.")
