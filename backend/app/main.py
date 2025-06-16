from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, admin, user
from .core.config import settings
import schedule
import os
import time
from datetime import datetime, timedelta
import threading

app = FastAPI(title=settings.PROJECT_NAME, documentation_url="/api/v1/docs", redoc_url="/api/v1/redoc")

def cleanup_old_files(upload_dir: str, days: int = 1):  # Changed to 1 day to match frontend message
    """
    Deletes files older than a specified number of days from the upload directory.
    """
    print(f"Running scheduled cleanup: removing files older than {days} day(s)")
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

def run_scheduler():
    """
    Runs the scheduler in a separate thread.
    """
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

# Schedule the cleanup task to run once every 24 hours
schedule.every(24).hours.do(cleanup_old_files, upload_dir=settings.UPLOAD_DIR, days=1)

# Start the scheduler in a background thread
scheduler_thread = threading.Thread(target=run_scheduler)
scheduler_thread.daemon = True
scheduler_thread.start()

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://31.59.58.9:8002", "http://31.59.58.9:8100", "http://31.59.58.9", "https://31.59.58.9","https://singspace.cloud"],  # Allow specific origin for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1", tags=["authentication"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(user.router, prefix="/api/v1/user", tags=["user"])

# Uncomment these lines if you need to initialize the database
# create_tables()
# init_roles()
# create_superuser()

# To serve with SSL, run uvicorn with:
# uvicorn app.main:app --host 0.0.0.0 --port 8000 \
#   --ssl-keyfile /etc/letsencrypt/live/signspace.cloud/privkey.pem \
#   --ssl-certfile /etc/letsencrypt/live/signspace.cloud/fullchain.pem
