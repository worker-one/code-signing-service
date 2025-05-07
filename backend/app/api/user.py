import subprocess
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from ..db.database import get_db
from ..db.models import User, File as FileModel, FileStatus
from ..core.security import get_current_user
from ..core.config import settings

router = APIRouter()

import time
from datetime import datetime
import os


# Schema models
class FileResponse(BaseModel):
    id: int
    file_name: str
    status: str
    uploaded_at: datetime
    signed_at: datetime | None = None

    class Config:
        orm_mode = True

import subprocess
from azure.identity import ClientSecretCredential

def get_access_token(tenant_id, client_id, client_secret):
    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret
    )
    token = credential.get_token("https://codesigning.azure.net/.default")
    return token.token

def run_command(command):
    try:
        subprocess.run(command, check=True, shell=True)
    except subprocess.CalledProcessError as e:
        print(f"An error occurred: {e}")


from typing import Optional, List

def sign_file(
    input_file_path: str, 
    tenant_id: str,
    client_id: str,
    client_secret: str,
    account_uri: str = "neu.codesigning.azure.net",
    account_name: str = "AccountName1", 
    certificate_name: str = "Certificate1"
) -> None:
    """
    Sign a file using jsign with Azure credentials.
    The input file is signed in-place.
    
    Args:
        input_file_path: Path to the file to be signed
        tenant_id: Azure tenant ID
        client_id: Azure client ID
        client_secret: Azure client secret
        account_name: Azure account name, defaults to "AccountName1"
        certificate_name: Certificate name, defaults to "Certificate1"
    
    Returns:
        None
    """
    token = get_access_token(tenant_id, client_id, client_secret)
    command = (
        f"jsign --storetype TRUSTEDSIGNING "
        f"--keystore {account_uri} "
        f"--storepass {token} "
        f"--alias {account_name}/{certificate_name} "
        f"{input_file_path}"
    )
    run_command(command)


@router.post("/files/upload", response_model=FileResponse)
async def upload_and_sign_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure the upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    
    # Read user's page from database to get Azure credentials
    if not current_user.pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an associated signing page configuration."
        )
    page = current_user.pages[0] # Assumes one page per user as per admin logic
    
    print(page)

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

        # Sign the file (in-place)
        sign_file(
            input_file_path=file_location, 
            tenant_id = page.azure_tenant_id,
            client_id = page.azure_client_id,
            client_secret = page.azure_client_secret,
            account_name = page.azure_account_name, 
            certificate_name = page.azure_certificate_name,
            account_uri = page.account_uri
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