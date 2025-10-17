# app/models.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# -----------------------------
# USER MODELS
# -----------------------------

# Input from frontend for login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Input from frontend for registration
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

# Internal DB model (hashed password)
class UserInDB(BaseModel):
    name: str
    email: EmailStr
    password: str  # must be hashed
    role: Optional[str] = "user"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

# Public user info (sent to frontend)
class UserPublic(BaseModel):
    name: str
    email: EmailStr
    role: str

# Response after login (with JWT token)
class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    #user: UserPublic


