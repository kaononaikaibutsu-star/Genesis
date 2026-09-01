import time
import ctypes
import threading
from typing import Optional
from watchdog.observers import Observer as FSObserver
from watchdog.events import FileSystemEventHandler
from genesis.db import MemoryStore
from genesis.config import GenesisConfig

class FileWatchHandler(FileSystemEventHandler):
    def __init__(self, memory: MemoryStore):
        self.memory = memory
        self._last_event = {}

    def _debounce(self, path: str, event_type: str) -> bool:
        now = time.time()
        key = f"{path}:{event_type}"
        if key in self._last_event and (now - self._last_event[key]) < 2.0:
            return True
        self._last_event[key] = now
        return False

    def on_created(self, event):
        if not event.is_directory and not self._debounce(event.src_path, "create"):
            self.memory.log_event("file_change", "filesystem", file_path=event.src_path, metadata={"action": "created"})

    def on_modified(self, event):
        if not event.is_directory and not self._debounce(event.src_path, "modify"):
            self.memory.log_event("file_change", "filesystem", file_path=event.src_path, metadata={"action": "modified"})

class ActivityObserver:
    def __init__(self, memory: MemoryStore, config: GenesisConfig):
        self.memory = memory
        self.config = config
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._fs_observer: Optional[FSObserver] = None
        
        # Track current focus
        self._last_app = ""
        self._last_title = ""
        self._last_change_time = time.time()

    def _get_active_window_info(self):
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        pid = ctypes.c_ulong()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        
        # Get Window Title
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value

        # Get Process Name
        process_name = "Unknown"
        PROCESS_QUERY_INFORMATION = 0x0400
        PROCESS_VM_READ = 0x0100
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
        if handle:
            buff_proc = ctypes.create_unicode_buffer(260)
            ctypes.windll.psapi.GetModuleBaseNameW(handle, 0, buff_proc, 260)
            process_name = buff_proc.value
            ctypes.windll.kernel32.CloseHandle(handle)

        return process_name, title

    def _loop(self):
        while self.running:
            try:
                if self.config.track_applications:
                    app, title = self._get_active_window_info()
                    now = time.time()
                    if app != self._last_app or title != self._last_title:
                        duration = now - self._last_change_time
                        if self._last_app and duration > 1.0:
                            self.memory.log_event(
                                event_type="app_focus",
                                source="win32",
                                application=self._last_app,
                                title=self._last_title,
                                duration=duration
                            )
                        self._last_app = app
                        self._last_title = title
                        self._last_change_time = now
            except Exception:
                pass
            time.sleep(1.0) # Event loop tick

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

        # Start File System Observers
        if self.config.observed_directories:
            self._fs_observer = FSObserver()
            handler = FileWatchHandler(self.memory)
            for path in self.config.observed_directories:
                if os.path.exists(path):
                    self._fs_observer.schedule(handler, path, recursive=True)
            self._fs_observer.start()

    def stop(self):
        self.running = False
        if self._fs_observer:
            self._fs_observer.stop()
            self._fs_observer.join()