from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, admin, user
from .db.database import create_tables, init_roles, create_superuser
from .db import models
from .core.config import settings
import schedule
import os
import time
from datetime import datetime, timedelta

app = FastAPI(title=settings.PROJECT_NAME)

def cleanup_old_files(upload_dir: str, days: int = 3):
    """
    Deletes files older than a specified number of days from the upload directory.
    """
    cutoff_date = datetime.now() - timedelta(days=days)
    for user_id_dir in os.listdir(upload_dir):
        user_dir_path = os.path.join(upload_dir, user_id_dir)
        if os.path.isdir(user_dir_path):
            for filename in os.listdir(user_dir_path):
                file_path = os.path.join(user_dir_path, filename)
                if os.path.isfile(file_path):
                    try:
                        file_modified_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                        if file_modified_time < cutoff_date:
                            os.remove(file_path)
                            print(f"Deleted old file: {file_path}")
                    except OSError as e:
                        print(f"Error deleting {file_path}: {e}")


def schedule_cleanup(upload_dir: str, days: int = 3):
    """
    Schedules the file cleanup task to run every 2 minutes.
    """
    schedule.every(2).minutes.do(cleanup_old_files, upload_dir=upload_dir, days=days)
    while True:
        schedule.run_pending()
        time.sleep(1)


import threading

# Start the cleanup scheduler in a separate thread
cleanup_thread = threading.Thread(target=schedule_cleanup, args=(settings.UPLOAD_DIR,))
cleanup_thread.daemon = True  # Allow the program to exit even if the thread is running
cleanup_thread.start()

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://78.153.149.221:8001"],  # For production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# # Mount static files
# app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(auth.router, prefix="/api", tags=["authentication"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(user.router, prefix="/api/user", tags=["user"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Code Signing Service API"}


# create_tables()
# init_roles()
# create_superuser()