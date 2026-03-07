import hashlib
from fastapi import UploadFile
from typing import Optional

def validate_cv_file(file: UploadFile, max_size_mb: int) -> bool:
    if not file.filename.lower().endswith('.pdf'):
        return False
    # Size validation would typically happen via middleware or by checking content-length,
    # as reading the whole file here consumes stream.
    return True

def hash_text(text: str) -> str:
    """Generate SHA-256 hash of text for deduplication/caching."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()
