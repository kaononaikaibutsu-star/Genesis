import sqlite3
import os
import time
import json
from typing import List, Dict, Any, Optional
from genesis.config import DB_FILE

def init_db():
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Raw Activity Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        event_type TEXT, -- app_focus, web_visit, file_change, media_play, download
        source TEXT,
        application TEXT,
        title TEXT,
        url TEXT,
        file_path TEXT,
        duration REAL,
        metadata TEXT -- JSON string for extra properties
    )
    """)

    # Derived Knowledge & Memory Summaries
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS derived_knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        category TEXT, -- project, interest, preference, habit
        summary TEXT,
        evidence TEXT,
        confidence REAL
    )
    """)

    # Detected Patterns
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_detected REAL,
        last_updated REAL,
        pattern_type TEXT,
        description TEXT,
        confidence REAL,
        supporting_evidence TEXT
    )
    """)

    # Daily Summaries
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_summaries (
        date TEXT PRIMARY KEY,
        summary_text TEXT,
        metrics TEXT,
        created_at REAL
    )
    """)

    conn.commit()
    conn.close()

class MemoryStore:
    def __init__(self):
        init_db()

    def _get_connection(self):
        return sqlite3.connect(DB_FILE)

    def log_event(self, event_type: str, source: str, application: str = "", title: str = "",
                  url: str = "", file_path: str = "", duration: float = 0.0, metadata: Dict[str, Any] = None):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO activity_events (timestamp, event_type, source, application, title, url, file_path, duration, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (time.time(), event_type, source, application, title, url, file_path, duration, json.dumps(metadata or {})))
        conn.commit()
        conn.close()

    def query_recent_events(self, limit: int = 100, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        cursor = conn.cursor()
        if event_type:
            cursor.execute("SELECT timestamp, event_type, source, application, title, url, file_path, duration, metadata FROM activity_events WHERE event_type = ? ORDER BY timestamp DESC LIMIT ?", (event_type, limit))
        else:
            cursor.execute("SELECT timestamp, event_type, source, application, title, url, file_path, duration, metadata FROM activity_events ORDER BY timestamp DESC LIMIT ?", (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                "timestamp": r[0], "event_type": r[1], "source": r[2],
                "application": r[3], "title": r[4], "url": r[5],
                "file_path": r[6], "duration": r[7], "metadata": json.loads(r[8])
            }
            for r in rows
        ]

    def add_pattern(self, pattern_type: str, description: str, confidence: float, evidence: List[str]):
        conn = self._get_connection()
        cursor = conn.cursor()
        now = time.time()
        cursor.execute("""
        INSERT INTO patterns (first_detected, last_updated, pattern_type, description, confidence, supporting_evidence)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (now, now, pattern_type, description, confidence, json.dumps(evidence)))
        conn.commit()
        conn.close()

    def prune_raw_events(self, retention_days: int):
        cutoff = time.time() - (retention_days * 86400)
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM activity_events WHERE timestamp < ?", (cutoff,))
        conn.commit()
        conn.close()

    def clear_all_memory(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM activity_events")
        cursor.execute("DELETE FROM derived_knowledge")
        cursor.execute("DELETE FROM patterns")
        cursor.execute("DELETE FROM daily_summaries")
        conn.commit()
        conn.close()