import secrets

def new_session_id() -> str:
    return secrets.token_urlsafe(12)


