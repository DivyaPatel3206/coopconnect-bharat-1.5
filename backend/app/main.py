from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, programmes, courses, certificates, jobs, analytics
from app.routers import profiles, attendance, logistics, chatbot, employer, learning, calendar_sync, dashboard, public, insights, ai
from app import models_ext  # noqa: F401  (registers new tables before create_all)
from app.seed import run_seed_if_empty
from app.seed_demo import run_demo_seed
from app.seed_extra import run_extra_seed
from app import notify
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CoopConnect Bharat API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(programmes.router)
app.include_router(courses.router)
app.include_router(certificates.router)
app.include_router(jobs.router)
app.include_router(analytics.router)
for _r in (profiles, attendance, logistics, chatbot, employer, learning, calendar_sync, dashboard, public, insights, ai):
    app.include_router(_r.router)


@app.on_event("startup")
def seed_on_startup():
    run_seed_if_empty()
    if os.getenv("SEED_DEMO", "1") != "0":
        run_demo_seed()
        run_extra_seed()
    notify.start_reminder_loop()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "coopconnect-bharat-api"}
