from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from ..db.database import get_db
from ..db.models import User, Page, Role, File
from ..core.security import get_admin_user, get_password_hash

router = APIRouter()

# Schema models
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = Role

class PageCreate(BaseModel):
    username: str
    user_id: int
    page_url: str
    azure_account_name: str
    azure_certificate_name: str
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: str

class PageUpdate(BaseModel):
    page_url: str = None
    azure_account_name: str = None
    azure_certificate_name: str = None
    azure_tenant_id: str = None
    azure_client_id: str = None
    azure_client_secret: str = None

class PageResponse(BaseModel):
    id: int
    page_url: str
    azure_account_name: str
    azure_certificate_name: str = None
    azure_tenant_id: str
    azure_client_id: str
    created_at: datetime
    user_id: int
    username: str
    status: str

    class Config:
        orm_mode = True

# User management endpoints
@router.post("/users", response_model=dict)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    # Check if user already exists
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.username,
        password_hash=hashed_password,
        role=user_data.role,
        role_id=1
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"id": new_user.id, "message": "User created successfully"}

# Page management endpoints
@router.post("/pages", response_model=PageResponse)
def create_page(
    page_data: PageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    # Check if user exists
    user = db.query(User).filter(User.id == page_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if page_url is already used
    existing_page = db.query(Page).filter(Page.page_url == page_data.page_url).first()
    if existing_page:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page URL already in use"
        )
    
    # Check if user_id is already associated with another page
    user_page = db.query(Page).filter(Page.user_id == page_data.user_id).first()
    if user_page:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is already associated with another page"
        )
    
    # Create new page with Azure credentials
    new_page = Page(
        user_id=page_data.user_id,
        username=page_data.username,
        page_url=page_data.page_url,
        azure_account_name=page_data.azure_account_name,
        azure_certificate_name=page_data.azure_certificate_name,
        azure_tenant_id=page_data.azure_tenant_id,
        azure_client_id=page_data.azure_client_id,
        azure_client_secret=page_data.azure_client_secret,
        status="active"
    )
    
    db.add(new_page)
    db.commit()
    db.refresh(new_page)
    
    return new_page

@router.get("/pages", response_model=List[PageResponse])
def get_pages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 100
):
    pages = db.query(Page).offset(skip).limit(limit).all()
    print(f"Pages: {pages}")
    return pages

@router.get("/pages/{page_id}", response_model=PageResponse)
def get_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found"
        )
    return page

@router.put("/pages/{page_id}", response_model=PageResponse)
def update_page(
    page_id: int,
    page_data: PageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found"
        )
    
    # Update fields if provided
    if page_data.page_url:
        # Check if new URL is already in use by another page
        existing_page = db.query(Page).filter(
            Page.page_url == page_data.page_url, 
            Page.id != page_id
        ).first()
        if existing_page:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page URL already in use"
            )
        page.page_url = page_data.page_url
        
    if page_data.azure_account_name:
        page.azure_account_name = page_data.azure_account_name
        
    if page_data.azure_certificate_name:
        page.azure_certificate_name = page_data.azure_certificate_name
    
    # Add updates for new Azure credential fields
    if page_data.azure_tenant_id:
        page.azure_tenant_id = page_data.azure_tenant_id
        
    if page_data.azure_client_id:
        page.azure_client_id = page_data.azure_client_id
        
    if page_data.azure_client_secret:
        page.azure_client_secret = page_data.azure_client_secret
    
    db.commit()
    db.refresh(page)
    return page


@router.delete("/pages/{page_id}", response_model=dict)
def delete_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page not found"
        )

    user = db.query(User).filter(User.id == page.user_id).first()

    db.delete(page)
    db.commit()

    # Check if the user has no more pages or files, then delete the user
    if user and not user.pages and not user.files:
        db.delete(user)
        db.commit()

    return {"message": "Page and associated user deleted successfully" if not user.pages and not user.files else "Page deleted successfully"}


@router.post("/pages/count", response_model=dict)
def get_page_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    count = db.query(Page).count()
    print(f"Page count: {count}, type {type(count)}")
    return {"count": count}


@router.post("/files_signed/count", response_model=dict)
def get_signed_files_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    count = db.query(File).filter(File.status == "signed").count()
    return {"count": count}
