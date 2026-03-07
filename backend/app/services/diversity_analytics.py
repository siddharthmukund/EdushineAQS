from typing import List, Dict, Any

class DiversityAnalytics:
    """
    Analyzes hiring demographics to identify potential systemic biases.
    In a real application, this would rely on self-reported EEO data.
    For demonstration purposes, this simulates diversity metrics based on batch statistics.
    """
    
    @staticmethod
    def analyze_batch(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generates simulated diversity and inclusion analytics for a candidate pool.
        """
        total_candidates = len(results)
        if total_candidates == 0:
            return {"error": "No candidates available for analytics."}
            
        # Simulate geographic/institutional diversity based on parsed data
        institutions = set()
        for res in results:
            inst = res.get("metadata", {}).get("institution")
            if inst:
                institutions.add(inst)
                
        institutional_diversity_score = min(100, (len(institutions) / total_candidates) * 100 * 1.5) if total_candidates > 0 else 0
        
        # Simulate gender/ethnic diversity (Mock data for demo purposes)
        # In a real app, this must ONLY use self-reported, anonymized data.
        mock_demographics = {
            "gender": {
                "female": max(0, int(total_candidates * 0.4)),
                "male": max(0, int(total_candidates * 0.55)),
                "non_binary_or_undisclosed": max(0, int(total_candidates * 0.05))
            },
            "ethnicity": {
                "underrepresented": max(0, int(total_candidates * 0.3)),
                "majority": max(0, int(total_candidates * 0.6)),
                "undisclosed": max(0, int(total_candidates * 0.1))
            }
        }
        
        # Calculate inclusivity index based on score distribution vs demographics
        # (Simulating that minority candidates have fair score distributions)
        inclusivity_index = 85.5 # Simulated fair distribution index
        
        bias_warnings = []
        if institutional_diversity_score < 30:
            bias_warnings.append("Low institutional diversity: Candidates predominantly from the same historically established universities.")
            
        return {
            "total_candidates_analyzed": total_candidates,
            "institutional_diversity": {
                "unique_institutions": len(institutions),
                "score": round(institutional_diversity_score, 1),
            },
            "simulated_demographics": mock_demographics,
            "inclusivity_index": inclusivity_index,
            "systemic_bias_warnings": bias_warnings,
            "recommendation": "Expand sourcing channels to broader institutional networks." if institutional_diversity_score < 30 else "Current pool shows healthy structural diversity."
        }
