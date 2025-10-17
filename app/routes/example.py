from fastapi import APIRouter
from app.db import db

router = APIRouter()

@router.get("/ping")
def ping():
    return {"message": "pong"}

@router.get("/test-items")
def get_test_items():
    items = list(db["test"].find({}, {"_id": 0}))
    return {"items": items}

@router.post("/test-insert")
def insert_test_data():
    sample_data = [
        {"name": "Apple", "price": 2.5, "category": "fruit"},
        {"name": "Banana", "price": 1.2, "category": "fruit"},
        {"name": "Carrot", "price": 0.8, "category": "vegetable"},
    ]

    result = db["test"].insert_many(sample_data)
    return {"inserted_ids": [str(_id) for _id in result.inserted_ids]}

