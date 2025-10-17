# app/routes/users.py
from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime
from app.models import UserCreate, UserLogin, LoginResponse, UserPublic
from app.db import db
from app.auth import hash_password, verify_password, create_access_token
from app.auth import get_current_user

router = APIRouter()

# -----------------------------
# Registration Route
# -----------------------------
@router.post("/register", status_code=201)
def register(user: UserCreate):
    # Check if user already exists

    if db["users"].find_one({"email": user.email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )
    
    # Hash the password
    #return {"user": len(user.password.encode()), "message": "User registered successfully"}
    hashed_pwd = hash_password(user.password)


    # Insert user into database
    db["users"].insert_one({
        "name": user.name,
        "email": user.email,
        "password": hashed_pwd,
        "role": "user",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })

    return {"message": "User registered successfully"}

# -----------------------------
# Login Route
# -----------------------------
@router.post("/login", response_model=LoginResponse)
def login(user: UserLogin):
    db_user = db["users"].find_one({"email": user.email})
    
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create JWT token
    token = create_access_token({"sub": db_user["email"]})

    # Prepare user info for response
    user_public = UserPublic(
        name=db_user["name"],
        email=db_user["email"],
        role=db_user.get("role", "user")
    )

    return LoginResponse(access_token=token)

# -----------------------------
# Example Protected Route
# -----------------------------
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Return info about the currently logged-in user"""
    return {
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user.get("role", "user")
    }
