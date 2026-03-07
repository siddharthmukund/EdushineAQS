from fastapi import HTTPException
from fastapi.requests import Request
from fastapi.responses import JSONResponse

class CVAnalyzerException(Exception):
    def __init__(self, message: str, code: str = "INTERNAL_ERROR", status_code: int = 500):
        self.message = message
        self.code = code
        self.status_code = status_code

class ValidationError(CVAnalyzerException):
    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR", status_code=400)

async def cvanalyzer_exception_handler(request: Request, exc: CVAnalyzerException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )
