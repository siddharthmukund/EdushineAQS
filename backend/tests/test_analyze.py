import pytest
from httpx import AsyncClient, ASGITransport
import os
from app.main import app

@pytest.mark.asyncio
async def test_analyze_cv_invalid_input():
    # Setup test file in tmp
    test_pdf_path = "/tmp/test_tiny.pdf"
    with open(test_pdf_path, 'wb') as f:
        f.write(b"Not a real functional PDF but long enough to pass some checks")
    
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with open(test_pdf_path, 'rb') as f:
                response = await client.post(
                    "/api/analyze",
                    files={"cv_file": ("test_tiny.pdf", f, "application/pdf")},
                    data={"job_description": "Data Scientist"},
                    headers={"Authorization": "Bearer test-key"}
                )
            
            # Should fail validation because simple text is not valid PDF (PDF parser will raise PDFParserError)
            assert response.status_code == 400
            data = response.json()
            assert "PDF parser error" in data["detail"] or "PDF parsing error" in data["detail"]
    finally:
        if os.path.exists(test_pdf_path):
            os.remove(test_pdf_path)
