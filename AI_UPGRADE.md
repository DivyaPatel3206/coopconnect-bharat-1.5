# CoopConnect Bharat: AI-first upgrade

Nothing existing was removed. The AI layer is additive (new files + small hooks in dashboard, jobs, search, nav).

## Run in VS Code (Windows / Mac / Linux)
1. Install Python 3.10+ and Node.js 18+. File > Open Folder > the project folder.
2. Terminal 1 (backend): Terminal > New Terminal
   ```
   cd backend
   python -m venv .venv
   .venv\Scripts\activate          (Mac/Linux: source .venv/bin/activate)
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
   API: http://localhost:8000  (docs at /docs). Demo data is seeded on first start.
3. Terminal 2 (frontend): click the + in the terminal panel
   ```
   cd frontend
   copy .env.local.example .env.local     (Mac/Linux: cp ...)
   npm install
   npm run dev
   ```
   App: http://localhost:3000
4. Log in. Learner: priya@example.com / password123. Admin: admin@coopconnect.demo / Demo@1234.
5. Optional, for full LLM answers, Hindi/Gujarati translation and generated quizzes:
   copy backend/.env.example to backend/.env and paste your ANTHROPIC_API_KEY, then restart uvicorn.
   Without a key everything still works using built-in retrieval and rules.

## Where to see each AI feature
| Feature | Where |
|---|---|
| AI Copilot (RAG, sources, confidence, voice, simplify, translate) | floating "Ask CoopConnect AI" button on every page |
| AI insights, next step, smart recommendations | Dashboard (learner) |
| AI job matching: reasons, missing skill, Improve match | Jobs page |
| AI Profile: skill map, readiness score | /ai-profile |
| Career path roadmap | /career-path |
| Resume analyzer, document intelligence, simplify/translate, study plan, adaptive quiz | /ai-studio |
| Semantic AI search | search box > "Ask AI in natural language" or /ai-search |
| Admin Copilot, early warning, architecture view | /ai-admin (admin accounts) |

## Add your own knowledge (RAG)
Drop .md or .txt files into backend/knowledge/ (first line = title, optional "kind: Scheme"). Restart the backend.
The bundled files are demo content: replace them with official NCCT / scheme documents before real use.

## Honest limits
- Retrieval uses TF-IDF with synonym expansion and reranking (no extra dependencies). `app/ai/retrieval.py` is the single place to swap in sentence-transformers or pgvector.
- Gujarati/Hindi translation and fresh quiz generation need the API key. Voice uses the browser's Web Speech API (Chrome/Edge best; Gujarati recognition quality varies).
- Scanned PDFs / images need OCR: `pip install pytesseract pillow` plus the Tesseract program.
- Recommendations, readiness and dropout risk are explainable heuristics, labelled as estimates, not trained ML models.
