from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, admin, user
from .db.database import create_tables, init_roles, create_superuser
from .db import models
from .core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with specific origins
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


create_tables()
init_roles()
create_superuser()