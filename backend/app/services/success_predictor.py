import math
from typing import Dict, Any

class SuccessPredictor:
    """
    Simulates a machine learning model forecasting candidate success 
    based on Academic Quality Score (AQS) metrics and other factors.
    """
    
    @staticmethod
    def predict_success_probability(scores: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates probability of success (tenure > 3 years, high impact)
        based on AQS component scores.
        """
        overall_aqs = scores.get("overall_aqs", 0)
        research = scores.get("research", {}).get("total", 0) if isinstance(scores.get("research"), dict) else scores.get("research_score", 0)
        education = scores.get("education", {}).get("total", 0) if isinstance(scores.get("education"), dict) else scores.get("education_score", 0)
        teaching = scores.get("teaching", {}).get("total", 0) if isinstance(scores.get("teaching"), dict) else scores.get("teaching_score", 0)
        
        # Simple logistic regression simulation
        # Weights (simulated from historical data)
        w_research = 0.4
        w_teaching = 0.35
        w_education = 0.25
        bias = -40 # Baseline offset
        
        linear_combination = (research * w_research) + (teaching * w_teaching) + (education * w_education) + bias
        
        # Sigmoid function for probability
        probability = 1 / (1 + math.exp(-0.1 * linear_combination))
        
        # Calculate expected tenure (in years) - simulated
        expected_tenure = 2.0 + (overall_aqs / 20.0)
        
        # Determine risk factors
        risk_factors = []
        if research < 60:
            risk_factors.append("Low research output may impact tenure timeline")
        if teaching < 65:
            risk_factors.append("Below average teaching scores could affect student evaluations")
        if education < 70:
            risk_factors.append("Educational pedigree slightly below institutional average")
            
        success_drivers = []
        if research >= 85:
            success_drivers.append("Exceptional research potential indicates high grant acquisition likelihood")
        if teaching >= 85:
            success_drivers.append("Strong teaching background aligns well with student-centric goals")
            
        return {
            "success_probability_percent": round(probability * 100, 1),
            "expected_tenure_years": round(expected_tenure, 1),
            "risk_factors": risk_factors,
            "success_drivers": success_drivers,
            "model_confidence": "High" if overall_aqs > 80 else ("Medium" if overall_aqs > 60 else "Low")
        }
