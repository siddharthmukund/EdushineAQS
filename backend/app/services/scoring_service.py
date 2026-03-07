from typing import Dict, Any

class ScoringService:
    @staticmethod
    def calculate_percentile(overall_aqs: float) -> int:
        """
        Mock percentile calculation based on AQS score.
        In a real system, this would query a distribution table.
        """
        if overall_aqs >= 95: return 99
        if overall_aqs >= 90: return 95
        if overall_aqs >= 85: return 85
        if overall_aqs >= 80: return 75
        if overall_aqs >= 70: return 60
        if overall_aqs >= 60: return 45
        if overall_aqs >= 50: return 30
        return 10
        
    @staticmethod
    def enrich_scores(analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add any computed fields like percentiles to the analysis."""
        try:
            aqs = analysis_data["scores"]["overall_aqs"]
            percentile = ScoringService.calculate_percentile(aqs)
            analysis_data["scores"]["percentile"] = percentile
        except KeyError:
            pass
            
        return analysis_data
