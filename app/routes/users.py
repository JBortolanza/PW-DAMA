# app/routes/users.py
import os
from fastapi import APIRouter, HTTPException, Depends, status, Response, UploadFile, File
from datetime import datetime
from app.models import UserCreate, UserLogin, LoginResponse, UserPublic, UserUpdate
from app.db import db
from app.auth import hash_password, verify_password, create_access_token
from app.auth import get_current_user
from typing import List

# Caminho onde os avatares serão salvos no servidor
AVATAR_FOLDER = "/var/www/html/images/avatars/custom"

# Garantir que a pasta exista
os.makedirs(AVATAR_FOLDER, exist_ok=True)

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
        "avatar": "https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png",
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
# User Update Routes
# -----------------------------

@router.put("/update-profile")
def update_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update user profile
    """
    try:
        update_data = {}
        
        if user_update.name is not None:
            update_data["name"] = user_update.name
            
        if user_update.email is not None and user_update.email != current_user["email"]:
            # Verificar se email já existe
            existing_user = db["users"].find_one({"email": user_update.email})
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already exists")
            update_data["email"] = user_update.email
            
        if user_update.location is not None:
            update_data["location"] = user_update.location
            
        if user_update.bio is not None:
            update_data["bio"] = user_update.bio
        
        if not update_data:
            return {"message": "No changes made"}
        
        update_data["updated_at"] = datetime.utcnow()
        
        # Usar email para buscar (mais seguro)
        result = db["users"].update_one(
            {"email": current_user["email"]},
            {"$set": update_data}
        )
        
        return {"message": "Profile updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"UPDATE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating profile")

@router.put("/update-avatar")
def update_avatar(avatar_url: str, current_user: dict = Depends(get_current_user)):
    """
    Update user avatar URL
    Returns: HTTP 200
    """
    # Atualizar avatar
    db["users"].update_one(
        {"email": current_user["email"]},
        {
            "$set": {
                "avatar": avatar_url,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return Response(status_code=200)

# -----------------------------
# Upload Avatar (Upload File)
# -----------------------------

@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Verificar tipo de arquivo
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG or WEBP images are allowed"
        )

    # Gerar nome único baseado no email do usuário
    file_extension = file.filename.split(".")[-1]
    safe_email = current_user["email"].replace("@", "_").replace(".", "_")

    filename = f"{safe_email}_{datetime.utcnow().timestamp()}.{file_extension}"
    file_path = os.path.join(AVATAR_FOLDER, filename)

    # Salvar arquivo no servidor
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

    # URL pública do avatar
    avatar_url = f"https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/custom/{filename}"

    # Atualizar o avatar do usuário no banco
    db["users"].update_one(
        {"email": current_user["email"]},
        {
            "$set": {
                "avatar": avatar_url,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {"message": "Avatar uploaded successfully", "avatar_url": avatar_url}


# -----------------------------
# Protected Route Test
# -----------------------------

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current user profile data
    """
    try:
        # Já temos o usuário completo do get_current_user
        # Não precisamos buscar novamente no banco!
        
        print(f"DEBUG - User from auth: {current_user}")
        
        # Retornar diretamente os dados do current_user
        return {
            "name": current_user.get("name", ""),
            "email": current_user.get("email", ""),
            "avatar": current_user.get("avatar", "https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png"),
            "location": current_user.get("location", ""),
            "bio": current_user.get("bio", ""),
            "totalGames": current_user.get("totalGames", 0),
            "wins": current_user.get("wins", 0),
            "losses": current_user.get("losses", 0),
            "draws": current_user.get("draws", 0),
        }
        
    except Exception as e:
        print(f"ERROR in /me: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/ranking")
def get_ranking(current_user: dict = Depends(get_current_user)):
    """
    Retorna os top 5 usuários com mais vitórias.
    """
    try:
        # Busca usuários ordenados por vitórias (descendente), limitados a 5
        # Projetamos apenas os campos necessários para segurança e performance
        top_users_cursor = db["users"].find(
            {}, 
            {
                "_id": 0,           # Não expor o ID interno
                "name": 1, 
                "avatar": 1, 
                "wins": 1, 
                "totalGames": 1
            }
        ).sort("wins", -1).limit(5)

        ranking_list = list(top_users_cursor)
        
        # Garante que campos vazios tenham valores padrão
        cleaned_ranking = []
        for user in ranking_list:
            cleaned_ranking.append({
                "name": user.get("name", "Jogador"),
                "avatar": user.get("avatar", "https://pw.jan.bortolanza.vms.ufsc.br/images/avatars/default/default_avatar.png"),
                "wins": user.get("wins", 0),
                "totalGames": user.get("totalGames", 0)
            })

        return cleaned_ranking

    except Exception as e:
        print(f"ERROR in /ranking: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching ranking")