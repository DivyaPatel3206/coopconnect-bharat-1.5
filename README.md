# CoopConnect Bharat

**Learn. Certify. Connect. Grow.**

A digital ecosystem connecting cooperative training, digital learning, skill
certification, career guidance, and employment — built for institutions like
VAMNICOM, RICMs, and ICMs under India's National Council for Cooperative
Training (NCCT).

## What's actually in this build

This is a **working MVP scaffold**, not the full 38-feature spec — it's meant
to be a real, running foundation you extend module by module rather than a
mockup. It currently demonstrates, end to end, with real frontend ↔ backend ↔
database wiring:

- User registration & login (JWT auth, role selection)
- Browsing and registering for training programmes
- A digital LMS: courses, lessons, progress tracking
- **Automatic certificate issuance** when a course hits 100% progress
- Public certificate verification by ID (the QR-code use case, without the
  QR image rendering itself)
- A job board with a transparent, explainable skill-match score
- A national analytics snapshot (trainees, programmes, certificates, jobs)

**Not yet built** (present in the original spec, left for you to add):
QR-code attendance scanning, hostel/logistics ERP, timetable/calendar views,
multilingual UI switching, offline PWA caching, the RAG career chatbot
("Saarthi AI"), map-based analytics, and the employer-side dashboard for
posting jobs and reviewing candidates. The database models and API structure
are laid out so each of these is an additive module, not a rewrite.

## Tech stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** FastAPI + SQLAlchemy
- **Database:** SQLite by default (zero setup) — swap in Postgres via
  `DATABASE_URL` when you're ready (see `docker-compose.yml`)
- **Auth:** JWT bearer tokens, bcrypt password hashing

## Run it in VS Code

### 1. Open the project
```
code coopconnect-bharat
```
Install the **Python** and **ES7+ React/Redux/React-Native snippets**
extensions if you don't already have them — optional, but nice to have.

### 2. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
This starts the API at **http://localhost:8000** (interactive docs at
`/docs`) and seeds demo data on first run — including a demo login:
`priya@example.com` / `password123`.

### 3. Frontend
Open a second terminal:
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
This starts the app at **http://localhost:3000**.

### 4. Or run both with Docker
```bash
docker compose up --build
```

## Project structure

```
coopconnect-bharat/
├── backend/
│   └── app/
│       ├── main.py          # FastAPI app, CORS, router registration
│       ├── models.py        # SQLAlchemy models (users, programmes, courses, jobs, certs…)
│       ├── schemas.py       # Pydantic request/response shapes
│       ├── security.py      # JWT + password hashing
│       ├── seed.py          # Demo data (institutions, programmes, courses, jobs)
│       └── routers/         # auth, programmes, courses, certificates, jobs, analytics
├── frontend/
│   ├── app/                 # Next.js pages: landing, login, dashboard, programmes…
│   ├── components/          # Navbar, Card, JourneyPath
│   └── lib/                 # API client, auth context
└── docker-compose.yml
```

## API reference

Once the backend is running, full interactive API docs (request/response
shapes, try-it-out) are at **http://localhost:8000/docs**.

Key endpoints:
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Log in, returns JWT |
| GET | `/api/programmes` | List training programmes |
| POST | `/api/programmes/{id}/register` | Register for a programme |
| GET | `/api/courses` | List LMS courses |
| POST | `/api/courses/progress` | Update lesson progress (auto-issues certificate at 100%) |
| GET | `/api/certificates/verify/{id}` | Public certificate verification |
| GET | `/api/jobs` | List jobs with match score |
| POST | `/api/jobs/{id}/apply` | Apply to a job |
| GET | `/api/analytics/national` | Platform-wide summary numbers |

## Extending toward the full vision

Suggested build order for the remaining modules, roughly by how self-contained
each one is:
1. **Multilingual UI** — add an `i18n` dictionary + language switcher; the
   `Course.language` field already exists on the backend.
2. **QR attendance** — add an `attendance` table + a trainer-side "generate
   QR" screen and a participant-side scan screen (e.g. `html5-qrcode`).
3. **Employer dashboard** — job posting + candidate search screens against
   the existing `Job` / `JobApplication` models.
4. **Saarthi AI chatbot** — a `/api/ai/career-chat` endpoint calling an LLM
   with the trainee's skill profile as grounding context.
5. **PWA/offline** — add a service worker + manifest to the Next.js app for
   installability and cached course content.
6. **Map analytics & hostel/logistics ERP** — larger modules; best tackled
   once the above are stable.
