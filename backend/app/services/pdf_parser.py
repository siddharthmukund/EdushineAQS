import io
import pdfplumber
from pypdf import PdfReader
from fastapi import UploadFile

class PDFParserError(Exception):
    pass

class PDFParser:
    @staticmethod
    async def extract_text(file: UploadFile) -> str:
        """
        Extract text from a PDF file. If it's a .txt file (pre-parsed client-side),
        it returns the text directly. Otherwise, it tries pypdf for speed,
        falls back to pdfplumber if needed.
        """
        content = await file.read()
        
        filename = getattr(file, "filename", "") or ""
        if filename.endswith(".txt"):
            return content.decode("utf-8").strip()

        await file.seek(0)
        
        pdf_file = io.BytesIO(content)
        
        text = ""
        try:
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        except Exception as e:
            # Fallback to pdfplumber
            pdf_file.seek(0)
            try:
                with pdfplumber.open(pdf_file) as pdf:
                    for page in pdf.pages:
                        extracted = page.extract_text()
                        if extracted:
                            text += extracted + "\n"
            except Exception as e2:
                raise PDFParserError(f"Failed to parse PDF: {e2}")
        
        if not text.strip():
            raise PDFParserError("Extracted text is empty or PDF is unreadable")
            
        return text.strip()
