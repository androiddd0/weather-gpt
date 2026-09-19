"""Portable launcher: creates the venv if needed, then runs WeatherGPT."""
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent / "backend"
PYTHON = BACKEND / ".venv" / "Scripts" / "python.exe"

if not PYTHON.exists():
    print("Creating virtual environment…")
    subprocess.check_call([sys.executable, "-m", "venv", str(BACKEND / ".venv")])
    subprocess.check_call([str(PYTHON), "-m", "pip", "install", "-q", "-r", str(BACKEND / "requirements.txt")])

print("WeatherGPT → http://localhost:8000   (Ctrl+C to stop)")
subprocess.check_call([str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"], cwd=BACKEND)