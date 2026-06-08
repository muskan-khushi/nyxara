"""
Nyxara Cybersec Engine — Port 8002
BEI (Browser Environment Intelligence) + Velocity + Device Graph
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from api.routes import router

app = FastAPI(title="Nyxara Cybersec Engine", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("CYBER_ENGINE_PORT", 8002)), reload=True)