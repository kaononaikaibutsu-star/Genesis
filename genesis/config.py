import os
import json
import sqlite3
import urllib.request
from dataclasses import dataclass, field
from typing import List, Dict, Any

CONFIG_FILE = os.path.expanduser("~/.genesis/config.json")
DB_FILE = os.path.expanduser("~/.genesis/memory.db")
WORKSPACE_DIR = os.path.expanduser("~/Genesis")

@dataclass
class GenesisConfig:
    auto_start: bool = True
    online_mode: bool = True
    ai_provider: str = "gemini"  # "gemini" or "local_ollama"
    ollama_endpoint: str = "http://localhost:11434"
    observed_directories: List[str] = field(default_factory=lambda: [
        os.path.expanduser("~/Documents"),
        os.path.expanduser("~/Projects")
    ])
    raw_data_retention_days: int = 30
    track_applications: bool = True
    track_browser: bool = True
    track_media: bool = True

    @classmethod
    def load(cls) -> "GenesisConfig":
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    data = json.load(f)
                    return cls(**data)
            except Exception:
                pass
        config = cls()
        config.save()
        return config

    def save(self):
        with open(CONFIG_FILE, "w") as f:
            json.dump(self.__dict__, f, indent=2)

def check_internet_connectivity() -> bool:
    """Checks if an active internet connection is available."""
    try:
        urllib.request.urlopen("https://1.1.1.1", timeout=2)
        return True
    except Exception:
        return False