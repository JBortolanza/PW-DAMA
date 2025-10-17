from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# -----------------------------
# USER MODELS
# -----------------------------

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserInDB(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "user"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

class UserPublic(BaseModel):
    name: str
    email: EmailStr
    role: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# -----------------------------
# RECORDING UPLOAD MODELS
# -----------------------------

class PlayerInfo(BaseModel):
    email: str
    name: str
    role: Optional[str] = None
    result: Optional[str] = None

class UploadRequest(BaseModel):
    filename: str
    file_size: int
    title: str
    duration: int
    players: List[PlayerInfo] = []
    game_type: str = "screen_recording"

class UploadResponse(BaseModel):
    upload_url: str
    recording_id: str
    file_key: str
    public_url: str
    expires_in: int