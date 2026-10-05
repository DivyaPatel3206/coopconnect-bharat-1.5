# Load backend/.env (optional) before any module reads environment variables.
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass
