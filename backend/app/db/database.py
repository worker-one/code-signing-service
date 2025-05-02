from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..core.config import settings
from sqlalchemy import event
from sqlalchemy.engine import Engine

# @event.listens_for(Engine, "connect")
# def set_sqlite_pragma(dbapi_connection, connection_record):
#     cursor = dbapi_connection.cursor()
#     cursor.execute("PRAGMA foreign_keys=ON")
#     cursor.close()
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

print(f"SQLALCHEMY_DATABASE_URL={SQLALCHEMY_DATABASE_URL}")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
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
