# app/database.py
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# MongoDB connection URI (e.g., mongodb://localhost:27017)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# Database name
DB_NAME = os.getenv("DB_NAME", "pw")  # Default to "pw" if not set

# Create a single MongoClient instance
client = MongoClient(MONGO_URI)

# Access the database only once
db = client[DB_NAME]

