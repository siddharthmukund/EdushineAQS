import os
import shutil
from pathlib import Path
from fastapi import UploadFile
from typing import List
import uuid
import logging

logger = logging.getLogger(__name__)

# In production this would be S3. For now, local temp storage.
TEMP_STORAGE_DIR = Path("/tmp/cv-analyzer-uploads")
TEMP_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

class StorageService:
    @staticmethod
    async def save_uploads(batch_id: str, files: List[UploadFile]) -> List[dict]:
        """
        Saves uploaded files to disk and returns a list of dictionaries 
        containing the original filename and the absolute path on disk.
        """
        saved_files = []
        batch_dir = TEMP_STORAGE_DIR / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            file_extension = Path(file.filename).suffix
            safe_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = batch_dir / safe_filename
            
            try:
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                
                saved_files.append({
                    "original_filename": file.filename,
                    "file_path": str(file_path.absolute())
                })
            except Exception as e:
                logger.error(f"Failed to save file {file.filename}: {e}")
                
        return saved_files
    
    @staticmethod
    def cleanup_batch(batch_id: str):
        """Removes the temporary directory for a batch."""
        batch_dir = TEMP_STORAGE_DIR / batch_id
        if batch_dir.exists():
            shutil.rmtree(batch_dir, ignore_errors=True)
