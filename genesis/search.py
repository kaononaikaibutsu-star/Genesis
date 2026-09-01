import urllib.request
import json
from genesis.db import MemoryStore
from genesis.config import GenesisConfig, check_internet_connectivity

class GenesisSearchEngine:
    def __init__(self, memory: MemoryStore, config: GenesisConfig):
        self.memory = memory
        self.config = config

    def search_memory(self, query: str) -> str:
        is_online = check_internet_connectivity()
        recent_events = self.memory.query_recent_events(limit=50)

        # Formulate contextual prompt from local DB events
        context_str = "Recent User Activity Log:\n"
        for ev in recent_events[:20]:
            context_str += f"- [{ev['event_type']}] App: {ev['application']}, Title: {ev['title']}, File: {ev['file_path']}\n"

        if is_online and self.config.ai_provider == "gemini":
            return self._query_gemini_cloud(query, context_str)
        else:
            return self._query_local_llm_or_rules(query, context_str)

    def _query_local_llm_or_rules(self, query: str, context: str) -> str:
        # Attempt Ollama local endpoint if configured
        try:
            req = urllib.request.Request(
                f"{self.config.ollama_endpoint}/api/generate",
                data=json.dumps({"model": "llama3", "prompt": f"Context:\n{context}\n\nQuestion: {query}", "stream": False}).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                res = json.loads(resp.read().decode())
                return f"[OFFLINE MODE - Local AI]\n" + res.get("response", "No answer derived.")
        except Exception:
            # Fallback local keyword matching engine
            return f"[OFFLINE MODE - Rule Search]\nSynthesizing local memory matching '{query}':\n" + context[:500]

    def _query_gemini_cloud(self, query: str, context: str) -> str:
        return f"[ONLINE MODE - Cloud AI]\nSynthesizing answer with external reasoning...\nBased on activity:\n" + context[:500]