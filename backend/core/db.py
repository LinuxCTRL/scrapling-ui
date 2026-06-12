import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            history TEXT NOT NULL,
            cron_expression TEXT NOT NULL,
            webhook_url TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run TEXT,
            next_run TEXT,
            created_at TEXT NOT NULL
        )
        """)
        conn.commit()

def save_job(job_id: str, name: str, url: str, history: List[Dict[str, Any]], cron_expression: str, webhook_url: str, enabled: bool = True) -> Dict[str, Any]:
    init_db()
    created_at = datetime.utcnow().isoformat()
    history_json = json.dumps(history)
    enabled_val = 1 if enabled else 0
    
    with get_db_connection() as conn:
        conn.execute("""
        INSERT OR REPLACE INTO jobs (id, name, url, history, cron_expression, webhook_url, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (job_id, name, url, history_json, cron_expression, webhook_url, enabled_val, created_at))
        conn.commit()
        
    return get_job(job_id)

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row:
            job = dict(row)
            job["history"] = json.loads(job["history"])
            job["enabled"] = bool(job["enabled"])
            return job
    return None

def get_all_jobs() -> List[Dict[str, Any]]:
    init_db()
    jobs = []
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
        for row in rows:
            job = dict(row)
            job["history"] = json.loads(job["history"])
            job["enabled"] = bool(job["enabled"])
            jobs.append(job)
    return jobs

def delete_job(job_id: str):
    init_db()
    with get_db_connection() as conn:
        conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        conn.commit()

def update_job_enabled(job_id: str, enabled: bool):
    init_db()
    enabled_val = 1 if enabled else 0
    with get_db_connection() as conn:
        conn.execute("UPDATE jobs SET enabled = ? WHERE id = ?", (enabled_val, job_id))
        conn.commit()

def update_job_runs(job_id: str, last_run: str, next_run: Optional[str] = None):
    init_db()
    with get_db_connection() as conn:
        if next_run:
            conn.execute("UPDATE jobs SET last_run = ?, next_run = ? WHERE id = ?", (last_run, next_run, job_id))
        else:
            conn.execute("UPDATE jobs SET last_run = ? WHERE id = ?", (last_run, job_id))
        conn.commit()

# Initialize on import
init_db()
