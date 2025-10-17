# app/auth.py
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.db import db
import os
from dotenv import load_dotenv

# -----------------------------
# Load environment variables
# -----------------------------
load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "supersecretkey")  # Replace with a random jwt key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

# -----------------------------
# Password hashing setup (Argon2)
# -----------------------------
pwd_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    """Hash a plain text password with Argon2"""
    return pwd_hasher.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed one"""
    try:
        return pwd_hasher.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False

# -----------------------------
# JWT token functions
# -----------------------------
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT token and return the payload, or None if invalid"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# -----------------------------
# FastAPI OAuth2 dependency
# -----------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    """Verify JWT token and return the user from MongoDB"""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Token payload invalid")

    user = db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
