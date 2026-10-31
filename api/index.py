import os
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' can be found
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault("ENV", "production")

from app.main import app

# Export ASGI app instance for Vercel
app = app
