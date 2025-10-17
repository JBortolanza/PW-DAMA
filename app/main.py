from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import users, example

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

app.include_router(example.router, prefix="/api", tags=["example"])
app.include_router(users.router, prefix="/api", tags=["users"])


@app.get("/")
def root():
    return {"message": "PW backend is running"}
