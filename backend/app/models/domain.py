from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
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

    @field_validator('overall_aqs', 'research', 'education', 'teaching', mode='before')
    @classmethod
    def coerce_score(cls, v: Any) -> float:
        """Accept either a plain number OR a dict with a 'total' key.
        Gemini (and some other LLMs) return rich breakdown objects instead of
        a bare float, e.g. {"total": 38.0, "breakdown": {...}}.
        """
        if isinstance(v, dict):
            return float(v.get('total', v.get('score', 0.0)))
        return v

class AnalysisData(BaseModel):
    scores: ScoresModel
    fitment: Dict[str, Any] = Field(default_factory=dict)
    validation: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = ConfigDict(extra="allow")

class AnalysisResponseData(BaseModel):
    id: UUID
    candidate_name: Optional[str] = None
    # Use Dict so the full breakdown structure (research.total, research.breakdown, …)
    # is preserved for the frontend ScoreCard component.
    scores: Dict[str, Any] = Field(default_factory=dict)
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
