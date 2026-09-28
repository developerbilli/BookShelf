
#!/usr/bin/env python3
"""
Single-command runner script for Whimsicalwhiner's Library application.
Runs both the FastAPI backend (port 8000) and Next.js frontend (port 3000).

Usage:
    python run.py
"""

import os
import sys
import time
import signal
import subprocess
from pathlib import Path

# Base paths
ROOT_DIR = Path(__file__).parent.resolve()
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8000")
FRONTEND_PORT = os.getenv("FRONTEND_PORT", "3000")

processes = []

def cleanup(signum=None, frame=None):
    """Gracefully terminate all running subprocesses."""
    print("\n\033[93m[!] Shutting down Whimsicalwhiner's Library servers...\033[0m")
    for proc in processes:
        if proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
    print("\033[92m[✓] All services stopped successfully.\033[0m")
    sys.exit(0)

def main():
    # Register signal handlers for clean Ctrl+C shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("\033[95m" + "="*60 + "\033[0m")
    print("\033[96m    📚 WHIMSICALWHINER'S LIBRARY - APPS LAUNCHER 📚\033[0m")
    print("\033[95m" + "="*60 + "\033[0m")

    # 1. Start Backend FastAPI Server
    print(f"\n\033[94m[1/2] Starting FastAPI Backend on http://localhost:{BACKEND_PORT}...\033[0m")
    backend_cmd = [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", BACKEND_HOST,
        "--port", BACKEND_PORT,
        "--reload"
    ]
    
    try:
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=BACKEND_DIR,
        )
        processes.append(backend_proc)
    except Exception as e:
        print(f"\033[91m[X] Failed to start backend: {e}\033[0m")
        sys.exit(1)

    # 2. Start Frontend Next.js Server
    print(f"\033[94m[2/2] Starting Next.js Frontend on http://localhost:{FRONTEND_PORT}...\033[0m")
    frontend_cmd = ["npm", "run", "dev", "--", "-p", FRONTEND_PORT]
    
    try:
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=FRONTEND_DIR,
        )
        processes.append(frontend_proc)
    except Exception as e:
        print(f"\033[91m[X] Failed to start frontend: {e}\033[0m")
        cleanup()
        sys.exit(1)

    time.sleep(2)

    print("\n\033[92m" + "✨ SUCCESS! Both servers are running! ✨" + "\033[0m")
    print("\033[97m" + "-"*60 + "\033[0m")
    print(f"  🌐 \033[1mFrontend App:\033[0m  \033[94mhttp://localhost:{FRONTEND_PORT}\033[0m")
    print(f"  ⚙️  \033[1mBackend API:\033[0m   \033[94mhttp://localhost:{BACKEND_PORT}\033[0m")
    print(f"  📖 \033[1mAPI Swagger:\033[0m   \033[94mhttp://localhost:{BACKEND_PORT}/docs\033[0m")
    print("\033[97m" + "-"*60 + "\033[0m")
    print("Press \033[93mCtrl+C\033[0m at any time to stop both servers.\n")

    # Monitor subprocesses
    try:
        while True:
            time.sleep(1)
            for proc in processes:
                if proc.poll() is not None:
                    out, _ = proc.communicate()
                    print(f"\033[91m[!] Process exited unexpectedly (code {proc.returncode}):\033[0m\n{out}")
                    cleanup()
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
