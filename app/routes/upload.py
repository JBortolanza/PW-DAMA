from fastapi import APIRouter, Depends, HTTPException
from app.models import UploadRequest, UploadResponse
import uuid
from datetime import datetime
from app.db import db
from app.auth import get_current_user
from app.cloudfare import r2_service
from bson import ObjectId


router = APIRouter(prefix="/upload", tags=["upload"])

# -----------------------------
# Recording Upload and Retrieval Routes
# -----------------------------

@router.post("/request-url", response_model=UploadResponse)
def request_upload_url(
    request: UploadRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        upload_data = r2_service.generate_upload_url(
            user_email=current_user["email"],
            filename=request.filename,
            file_size=request.file_size
        )
        
        recording_data = {
            "recording_id": str(uuid.uuid4()),
            "user_id": current_user["_id"],
            "user_email": current_user["email"],
            "title": request.title,
            "duration": request.duration,
            "players": [player.dict() for player in request.players],
            "game_type": request.game_type,
            "file_key": upload_data["file_key"],
            "file_size": request.file_size,
            "public_url": upload_data["public_url"],
            "status": "completed",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        db["recordings"].insert_one(recording_data)
        
        return UploadResponse(
            upload_url=upload_data["upload_url"],
            recording_id=recording_data["recording_id"],
            file_key=upload_data["file_key"],
            public_url=upload_data["public_url"],
            expires_in=upload_data["expires_in"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")

@router.get("/my-recordings")
def get_my_recordings(current_user: dict = Depends(get_current_user)):
    """
    Return all recordings for the authenticated user.
    """
    try:
        print("DEBUG - User from auth:", current_user)

        user_id = current_user["_id"]   # THIS is already ObjectId (just like in /me)

        print("DEBUG - Using user_id:", user_id, type(user_id))

        # Query recordings using ObjectId directly
        recordings = list(db["recordings"].find({"user_id": user_id}))

        print("DEBUG - Fetched recordings:", recordings)

        cleaned = []
        for rec in recordings:
            # Convert ObjectId to string
            rec["_id"] = str(rec["_id"])
            rec["user_id"] = str(rec["user_id"])

            # Convert datetimes safely
            if isinstance(rec.get("created_at"), datetime):
                rec["created_at"] = rec["created_at"].isoformat()
            if isinstance(rec.get("updated_at"), datetime):
                rec["updated_at"] = rec["updated_at"].isoformat()

            cleaned.append(rec)

        return cleaned

    except Exception as e:
        print(f"ERROR in /my-recordings: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")