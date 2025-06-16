import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session
from typing import List, Tuple
from pydantic import BaseModel

from ..db.database import get_db
from ..db.models import User, File as FileModel, FileStatus, Page # Added Page
from ..core.security import get_current_user
from ..core.config import settings
from ..core.azure import sign_file

router = APIRouter()


# Helper function to determine the context of the operation
def get_effective_user_and_page(
    db: Session, current_user: User, page_id: int | None = None
) -> Tuple[User, Page]:
    if page_id is not None and current_user.role == "admin":
        # Admin is impersonating a user via page_id
        page_config = db.query(Page).filter(Page.id == page_id).first()
        if not page_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Page configuration not found for page_id {page_id}.",
            )
        
        effective_user = db.query(User).filter(User.id == page_config.user_id).first()
        if not effective_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User associated with page_id {page_id} not found.",
            )
        
        # The specific page_config found is the one to use.
        # Ensure this user actually has this page associated (covered by page_config.user_id == effective_user.id)
        return effective_user, page_config
    else:
        # Regular user or admin acting as themselves
        if not current_user.pages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User '{current_user.username}' does not have an associated signing page configuration.",
            )
        # For a regular user, or admin acting as self, use their own first page config
        return current_user, current_user.pages[0]


# Schema models
class FileResponse(BaseModel):
    id: int
    file_name: str
    status: str
    uploaded_at: datetime
    signed_at: datetime | None = None

    class Config:
        orm_mode = True


@router.post("/files/upload", response_model=FileResponse)
async def upload_and_sign_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page_id: int = Query(None, description="Optional Page ID for admin impersonation")
):
    effective_user, page_config = get_effective_user_and_page(db, current_user, page_id)

    # Ensure the upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    user_dir = os.path.join(settings.UPLOAD_DIR, str(effective_user.id))
    os.makedirs(user_dir, exist_ok=True)
    
    # Azure credentials come from the determined page_config
    # page_config is already validated by get_effective_user_and_page
    
    # Generate a unique filename with the original extension
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_location = os.path.join(user_dir, unique_filename)

    # Read the file content
    content = await file.read()

    # Save the original file
    with open(file_location, "wb+") as file_object:
        file_object.write(content)

    # Create file record in database
    db_file = FileModel(
        user_id=effective_user.id, # Use effective_user's ID
        file_name=file.filename,
        file_path=file_location,
        status=FileStatus.PENDING
    )

    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    try:
        # Update status to in progress
        db_file.status = FileStatus.IN_PROGRESS
        db.commit()

        # Sign the file (in-place)
        sign_file(
            input_file_path=file_location, 
            tenant_id = page_config.azure_tenant_id,
            client_id = page_config.azure_client_id,
            client_secret = page_config.azure_client_secret,
            account_name = page_config.azure_account_name, 
            certificate_name = page_config.azure_certificate_name,
            account_uri = page_config.account_uri
        )

        # Update the file record with signed information
        db_file.status = FileStatus.SIGNED
        db_file.signed_file_path = file_location
        db_file.signed_at = datetime.now()
        db.commit()
        db.refresh(db_file)

    except Exception as e:
        # Update status to failed if signing fails
        db_file.status = FileStatus.FAILED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signing failed: {str(e)}"
        )

    return db_file


@router.get("/files/history", response_model=List[FileResponse])
def get_file_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    page_id: int = Query(None, description="Optional Page ID for admin impersonation")
):
    effective_user, _ = get_effective_user_and_page(db, current_user, page_id)

    files = db.query(FileModel).filter(
        FileModel.user_id == effective_user.id # Use effective_user's ID
    ).order_by(FileModel.uploaded_at.desc()).offset(skip).limit(limit).all()
    
    return files


@router.get("/files/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page_id: int = Query(None, description="Optional Page ID for admin impersonation")
):
    effective_user, _ = get_effective_user_and_page(db, current_user, page_id)
    
    file_record = db.query(FileModel).filter(
        FileModel.id == file_id
    ).first()
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Ensure the file belongs to the effective user (either self or impersonated user)
    if file_record.user_id != effective_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this file"
        )
    
    if file_record.status != FileStatus.SIGNED or not file_record.signed_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not ready for download"
        )
    
    if not os.path.exists(file_record.signed_file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signed file not found on server"
        )

    return FastAPIFileResponse(
        path=file_record.signed_file_path,
        filename=f"signed_{file_record.file_name}",
        media_type='application/octet-stream'
    )