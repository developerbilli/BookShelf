import os
import json
# pyrefly: ignore [missing-import]
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]

def get_drive_service():
    """Retrieve Google Drive API v3 service handle using refresh token or token file."""
    base_dir = os.path.dirname(__file__)
    token_path = os.path.join(base_dir, "token.json")
    
    creds = None

    # 1. Try loading from Environment Variable GDRIVE_TOKEN_JSON (Cloud Production)
    gdrive_env = os.getenv("GDRIVE_TOKEN_JSON")
    if gdrive_env:
        try:
            info = json.loads(gdrive_env)
            creds = Credentials.from_authorized_user_info(info, SCOPES)
        except Exception as e:
            print(f"[!] Failed to parse GDRIVE_TOKEN_JSON env: {e}")
            creds = None

    # 2. Try loading from local token.json file
    if not creds and os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            print(f"[!] Failed to load token.json file: {e}")
            creds = None

    # 3. Refresh expired token automatically using refresh_token
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception as e:
            print(f"[!] Error refreshing Google Drive token: {e}")
            creds = None

    if not creds or not creds.valid:
        print("[!] Google Drive credentials unavailable or invalid.")
        return None

    return build("drive", "v3", credentials=creds)
