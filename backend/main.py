from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import models
from app.database import engine
from app.routers import expenses
from app.routers import ledger
from app.routers import finance
from app.routers import users
from app.routers import auth
from app.routers import daily

from fastapi.middleware.cors import CORSMiddleware
# This generates the tables in Neon!
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CampusFlow API")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your React app to talk to it
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(expenses.router)
app.include_router(ledger.router)
app.include_router(finance.router)
app.include_router(auth.router)
app.include_router(daily.router)



@app.get("/")
def read_root():
    return {"status": "success", "message": "CampusFlow Backend is LIVE!"}