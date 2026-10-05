# CoopConnect Bharat: module update

## Steps in VS Code
1. Copy every file from this zip over your local repo (same folder structure). Nothing existing is deleted.
2. Backend: `cd backend && pip install -r requirements.txt` (adds httpx, email-validator).
3. Frontend: `cd frontend && npm install` (adds qrcode.react).
4. Run locally: backend `uvicorn app.main:app --reload`, frontend `npm run dev`.
5. `git add . && git commit -m "Add 6 modules" && git push` (Render auto-deploys).

## Render environment variables (optional)
- ANTHROPIC_API_KEY : enables the AI chatbot (without it, a built-in rule-based counsellor answers)
- CHATBOT_MODEL     : default claude-sonnet-5-5
- SEED_DEMO=0       : stop demo data from being created
- UPLOAD_DIR        : folder for uploaded documents (Render free disk is temporary; use a persistent disk or links)

## Database
Only NEW tables are added (backend/app/models_ext.py); created automatically on startup. No existing table is altered.

## Demo logins (password: Demo@1234)
admin@coopconnect.demo, inst@coopconnect.demo, trainer@coopconnect.demo, employer@coopconnect.demo,
rahul@ / meena@ / arjun@ / sneha@coopconnect.demo (trainees). Demo programme: "Digital Cooperative Entrepreneurship Bootcamp (Demo)".

## New / changed files
Backend new: deps.py, models_ext.py, seed_demo.py, routers/{profiles,attendance,logistics,chatbot,employer,learning}.py
Backend edited: main.py (routers + demo seed), routers/auth.py (blocks admin self-signup, suspended login), routers/jobs.py (closed jobs hidden), requirements.txt
Frontend new: lib/{http,roles}.ts, components/ui.tsx, components/profile/, components/learning/, app/{profile,people,institutions,attendance,logistics,career-chat,employer,learning}
Frontend edited: components/Navbar.tsx (role-based module strip), app/dashboard/page.tsx (quick links), package.json

## Not tested
Written without network access, so it was compile-checked (Python) but not run. Run `npm run build` and test each page after installing.

## Self-check (run before deploying)
cd backend && python smoke_test.py
Prints PASS/FAIL for profiles, attendance and logistics (and quick checks of the other modules) using a temporary database.

## Update 2: Google Calendar, e-mail alerts, new UI, dashboard history, logo
- Timetable changes (add / edit / delete) now: sync to Google Calendar, and e-mail participants + trainer with a calendar (.ics) attachment.
  A reminder digest for tomorrow's sessions is e-mailed every evening (IST). Both are optional and off until configured.
- Anyone can use "Add to my calendar (.ics)" on the Timetable tab (works with Google, Outlook, Apple) with no setup.
- New app layout: left sidebar (role-based, grouped), account menu, mobile drawer. Dashboard rewritten with past-records timeline.
- Logo: frontend/components/Logo.tsx, app/icon.svg (favicon), public/logo.svg, public/logo-mark.svg.

### Google Calendar setup (one time)
1. console.cloud.google.com -> create/select a project -> enable "Google Calendar API".
2. IAM & Admin -> Service Accounts -> create one -> Keys -> Add key -> JSON (download).
3. In Google Calendar create a calendar (e.g. "CoopConnect Timetable") -> Settings -> "Share with specific people" ->
   add the service account e-mail with permission "Make changes to events". Copy its "Calendar ID" from Integrate calendar.
4. On Render set:  GOOGLE_SERVICE_ACCOUNT_JSON = (paste the whole JSON)   GOOGLE_CALENDAR_ID = (the calendar id)
5. Share/subscribe participants to that calendar if you want them to see it inside Google Calendar.
   (Service accounts cannot send Google invitations, so participants get the e-mail + .ics instead.)

### E-mail setup (Gmail example)
Turn on 2-step verification -> create an App Password, then set on Render:
SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=you@gmail.com  SMTP_PASSWORD=<app password>  SMTP_FROM=you@gmail.com
Optional: REMINDERS=0 turns off the evening reminder job.
Test from Timetable tab -> "Send test email" (admin accounts).

## Update 3: UI/UX redesign + 4 sample courses
Design: solid navy + warm off-white, thin borders, small radius, Fraunces (headings) + Inter, no gradients/glass. Tokens in tailwind.config.ts and globals.css.
- Navigation: Home, Training, Learning, Employment, Cooperatives, Analytics, Resources + search (Ctrl/Cmd+K) + account menu.
  Signed-in users also get a "My workspace" bar (Dashboard, Attendance, Timetable, People, Institutions, Career Chat, Employer Hub, Profile). Mobile uses a slide-out menu.
- New/redesigned pages: / (home), /dashboard (role-based), /programmes, /courses, /jobs, /analytics, /cooperatives, /resources.
- Interactions: skeleton loading, toast notifications, animated progress bars, expand/collapse (announcements, FAQ, job details, filters).
- New data (all real, from the database): /api/public/overview|jobs|courses|programmes|announcements, /api/analytics/insights, dashboard notifications and recommendations.
- Sample courses (auto-created on startup, only if missing): Digital Literacy for Cooperative Members, Dairy Cooperative Operations & Quality,
  Financial Management for PACS, Women-led Enterprise & SHG Linkages. Each has lessons (text, interactive steps, flashcards, video/PDF placeholders), a quiz and an assignment.
- Placeholders to replace before launch: video/PDF links in the sample courses (edit from the lesson editor) and the illustrative learner stories in frontend/lib/content.ts.
- "Opportunities" is covered under Employment (jobs, internships, apprenticeships) to avoid two menu items for the same thing.
