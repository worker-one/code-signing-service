from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from datetime import datetime

from ..db.database import get_db
from ..db.models import User, Page, File as FileModel, FileStatus
from ..core.security import get_current_user
from ..services.azure_signing import AzureSigner
from ..core.config import settings
from pydantic import BaseModel

router = APIRouter()

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
async def mock_sign_text_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if file is a text file
    if not file.filename.endswith('.txt'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt files are supported for this mock signing endpoint"
        )
    
    # Ensure the upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    
    # Generate a unique filename
    unique_filename = f"{uuid.uuid4()}.txt"
    file_location = os.path.join(user_dir, unique_filename)
    
    # Read the file content
    content = await file.read()
    
    # Save the original file
    with open(file_location, "wb+") as file_object:
        file_object.write(content)
    
    # Create file record in database
    db_file = FileModel(
        user_id=current_user.id,
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
        
        # Create a "signed" version by inserting "signed by authority" at the beginning
        signed_path = os.path.join(user_dir, f"signed_{unique_filename}")
        
        with open(signed_path, "w") as signed_file:
            # Write our "signature" as the first line
            signed_file.write("signed by authority\n")
            # Append the original content
            signed_file.write(content.decode('utf-8'))
        
        # Update the file record with signed information
        db_file.status = FileStatus.SIGNED
        db_file.signed_file_path = signed_path
        db_file.signed_at = datetime.now()
        db.commit()
        db.refresh(db_file)
        
    except Exception as e:
        # Update status to failed if our mock signing fails
        db_file.status = FileStatus.FAILED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mock signing failed: {str(e)}"
        )
    
    return db_file

# # File upload and signing
# @router.post("/files/upload", response_model=FileResponse)
# async def upload_file(
#     file: UploadFile = File(...),
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     # Ensure the upload directory exists
#     os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
#     user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
#     os.makedirs(user_dir, exist_ok=True)
    
#     # Generate a unique filename
#     file_ext = os.path.splitext(file.filename)[1]
#     unique_filename = f"{uuid.uuid4()}{file_ext}"
#     file_location = os.path.join(user_dir, unique_filename)
    
#     # Save the file
#     with open(file_location, "wb+") as file_object:
#         file_object.write(await file.read())
    
#     # Create file record in database
#     db_file = FileModel(
#         user_id=current_user.id,
#         file_name=file.filename,
#         file_path=file_location,
#         status=FileStatus.PENDING
#     )
    
#     db.add(db_file)
#     db.commit()
#     db.refresh(db_file)
    
#     # Get the user's Azure signing credentials
#     page = db.query(Page).filter(Page.user_id == current_user.id).first()
#     if not page:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="No signing page found for user"
#         )
    
#     # Initialize the Azure signer
#     signer = AzureSigner(
#         account_uri=page.azure_account_uri,
#         account_key=page.azure_account_key
#     )
    
#     try:
#         # Update status to in progress
#         db_file.status = FileStatus.IN_PROGRESS
#         db.commit()
        
#         # Sign the file
#         signed_path = os.path.join(user_dir, f"signed_{unique_filename}")
#         signer.sign_file(file_location, signed_path)
        
#         # Update the file record with signed information
#         db_file.status = FileStatus.SIGNED
#         db_file.signed_file_path = signed_path
#         db_file.signed_at = datetime.now()
#         db.commit()
#         db.refresh(db_file)
        
#     except Exception as e:
#         # Update status to failed if signing fails
#         db_file.status = FileStatus.FAILED
#         db.commit()
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"File signing failed: {str(e)}"
#         )
    
#     return db_file

@router.get("/files/history", response_model=List[FileResponse])
def get_file_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    files = db.query(FileModel).filter(
        FileModel.user_id == current_user.id
    ).order_by(FileModel.uploaded_at.desc()).offset(skip).limit(limit).all()
    
    return files


@router.get("/files/download/{file_id}")
def download_file(
    file_id: int,
    db: Session = Depends(get_db)
):
    file = db.query(FileModel).filter(
        FileModel.id == file_id
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    if file.status != FileStatus.SIGNED or not file.signed_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not ready for download"
        )
    
    if not os.path.exists(file.signed_file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signed file not found on server"
        )

    return FastAPIFileResponse(
        path=file.signed_file_path,
        filename=f"signed_{file.file_name}",
        media_type='application/octet-stream'
    )