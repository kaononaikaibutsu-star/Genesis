import sys
import winreg
from genesis.config import GenesisConfig

REG_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "ProjectGenesisObserver"

def set_autostart(enable: bool):
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH, 0, winreg.KEY_ALL_ACCESS)
        if enable:
            python_exe = sys.executable
            cmd = f'"{python_exe}" -m genesis.main --background'
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, cmd)
        else:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
    except Exception as e:
        print(f"Error updating Windows Registry autostart: {e}")