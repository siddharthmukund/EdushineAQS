from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID

class AnalysisRequest(BaseModel):
    cv_text: str = Field(..., min_length=100, description="Full text extracted from CV")
    job_description: Optional[str] = Field(None, description="Optional job description for fitment context")
    
class ScoresModel(BaseModel):
    overall_aqs: float
    research: float
    education: float
    teaching: float

    model_config = ConfigDict(extra="allow")

class AnalysisData(BaseModel):
    scores: ScoresModel
    fitment: Dict[str, Any] = Field(default_factory=dict)
    validation: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = ConfigDict(extra="allow")

class AnalysisResponseData(BaseModel):
    id: UUID
    candidate_name: Optional[str] = None
    scores: ScoresModel
    fitment: Dict[str, Any] = Field(default_factory=dict)
    validation: Dict[str, Any] = Field(default_factory=dict)
    recommendation: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    
    model_config = ConfigDict(extra="allow")

class AnalysisResponse(BaseModel):
    status: str
    data: AnalysisResponseData
    error: Optional[Dict[str, Any]] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
