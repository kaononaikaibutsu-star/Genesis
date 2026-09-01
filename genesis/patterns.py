import os
import json
import time
from collections import Counter
from typing import List, Dict, Any
from genesis.db import MemoryStore
from genesis.config import GenesisConfig, WORKSPACE_DIR

class PatternEngine:
    def __init__(self, memory: MemoryStore, config: GenesisConfig):
        self.memory = memory
        self.config = config

    def analyze_recent_activity(self):
        events = self.memory.query_recent_events(limit=500)
        if not events:
            return

        app_durations = Counter()
        media_titles = []
        project_files = []

        for ev in events:
            if ev["event_type"] == "app_focus" and ev["application"]:
                app_durations[ev["application"]] += ev["duration"]
            elif ev["event_type"] == "media_play" or "YouTube" in ev.get("title", ""):
                media_titles.append(ev["title"])
            elif ev["event_type"] == "file_change" and ev["file_path"]:
                project_files.append(ev["file_path"])

        # Detect top app habit pattern
        if app_durations:
            top_app, top_time = app_durations.most_common(1)[0]
            hours = round(top_time / 3600.0, 2)
            if hours >= 0.5:
                self.memory.add_pattern(
                    pattern_type="app_habit",
                    description=f"Spent significant time using {top_app} (~{hours} hrs recent usage).",
                    confidence=0.85,
                    evidence=[f"Aggregated {top_time}s across last 500 events."]
                )

        # Build Virtual Workspace Structure safely without destroying user files
        self._build_workspace_files(app_durations, media_titles)

    def _build_workspace_files(self, apps: Counter, media: List[str]):
        subdirs = ["Memory", "Patterns", "Projects", "Music", "Downloads", "Reports"]
        for sd in subdirs:
            os.makedirs(os.path.join(WORKSPACE_DIR, sd), exist_ok=True)

        # Write dynamic virtual reports
        summary_path = os.path.join(WORKSPACE_DIR, "Reports", "latest_summary.md")
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write("# Genesis Digital Activity Summary\n\n")
            f.write(f"**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("## Most Used Applications\n")
            for app, dur in apps.most_common(5):
                f.write(f"- **{app}**: {round(dur/60.0, 1)} minutes\n")
            
            if media:
                f.write("\n## Recent Media Activity\n")
                for item in set(media[:5]):
                    f.write(f"- {item}\n")