@echo off
cd /d "%~dp0backend"
if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
    .venv\Scripts\pip install -r requirements.txt
)
echo Starting WeatherGPT on http://localhost:8000  (Ctrl+C to stop)
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload