import os
from pathlib import Path

def load_iccv_prompt() -> str:
    """Load the ICCV prompt from disk."""
    # Check docker path first
    docker_path = Path("/app/prompts/academic_cv_analyzer_v2.md")
    if docker_path.exists():
        prompt_path = docker_path
    else:
        base_dir = Path(__file__).parent.parent.parent.parent
        prompt_path = base_dir / "prompts" / "academic_cv_analyzer_v2.md"
    
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found at {prompt_path}")
        
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()
