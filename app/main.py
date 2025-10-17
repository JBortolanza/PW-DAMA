from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import users, upload

app = FastAPI(
    title="PW API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(upload.router, prefix="/api", tags=["upload"])


@app.get("/")
def root():
    return {"message": "PW backend is running"}
