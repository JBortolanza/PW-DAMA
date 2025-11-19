# app/routes/users.py
from fastapi import APIRouter, HTTPException, Depends, status, Response
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
# Login and Logout Routes
# -----------------------------
@router.post("/login")
def login(user: UserLogin, response: Response):
    db_user = db["users"].find_one({"email": user.email})

    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": db_user["email"]})

    # Store JWT in HTTP-only cookie
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,        # set False if in localhost without HTTPS
        samesite="lax",
        max_age=60 * 60,    # 1 hour
        path="/"
    )

    return {"message": "Logged in successfully"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}

# -----------------------------
# Protected Route Test
# -----------------------------
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Return info about the currently logged-in user"""
    return {
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user.get("role", "user")
    }
