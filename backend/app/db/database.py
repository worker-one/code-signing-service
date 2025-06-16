from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

SQLALCHEMY_DATABASE_URL = 'postgresql://code_sign_usr:KUyhgvuhisidijkm!=@31.59.58.9:5432/code_sign_db' #settings.DATABASE_URL

print(f"SQLALCHEMY_DATABASE_URL={SQLALCHEMY_DATABASE_URL}")
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_size=100, max_overflow=0)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()
        

def init_roles():
    from ..db.models import Role
    db = get_db()
    try:
        db.add(Role(id=0, name="admin"))
        db.add(Role(id=1, name="user"))
        db.commit()
    except:
        db.rollback()
    finally:
        db.close()


def create_superuser():
    from ..db.models import User
    from ..core.security import get_password_hash
    db = get_db()
    try:
        db.add(User(
            username=settings.SUPERUSER_USERNAME,
            email=settings.SUPERUSER_USERNAME,
            role_id=0,
            role="admin",
            password_hash=get_password_hash(settings.SUPERUSER_PASSWORD),
            is_superuser=True
        ))
        db.commit()
    except Exception as e:
        print(e)
        db.rollback()
    finally:
        db.close()
        

def create_tables():
    from ..db import models
    print("Creating tables")
    models.Base.metadata.create_all(bind=engine)
