from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, Enum, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

class FileStatus(Base):
    __tablename__ = "file_statuses"
    
    id = Column(Integer, primary_key=True, index=True) 
    name = Column(String, unique=True, nullable=False)
    
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SIGNED = "signed"
    FAILED = "failed"

# Constants for role and status values
ROLE_ADMIN = "admin"
ROLE_USER = "user"

FILE_STATUS_PENDING = "pending"
FILE_STATUS_IN_PROGRESS = "in_progress"
FILE_STATUS_SIGNED = "signed" 
FILE_STATUS_FAILED = "failed"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = Column(String, default=ROLE_USER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_superuser = Column(Boolean, default=False)
    
    pages = relationship("Page", back_populates="user", cascade="all, delete-orphan")
    files = relationship("File", back_populates="user", cascade="all, delete-orphan")


class Page(Base):
    __tablename__ = "pages"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    page_url = Column(String, unique=True, nullable=False)
    azure_account_uri = Column(String, nullable=False)
    azure_account_key = Column(Text, nullable=False) # Encrypted storage recommended
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    status = Column(String, default="active")
    
    user = relationship("User", back_populates="pages")


class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status_id = Column(Integer, ForeignKey("file_statuses.id"))
    status = Column(String, default=FILE_STATUS_PENDING)
    signed_file_path = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    signed_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="files")