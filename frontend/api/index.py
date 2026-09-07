import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.dirname(current_dir)
if frontend_dir not in sys.path:
    sys.path.insert(0, frontend_dir)

from backend_src.main import app

