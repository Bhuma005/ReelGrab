"""
automate.py  —  YouTube Shorts Automation endpoint.
Delegates AI generation to the professional ai_pipeline module.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from backend.ai_pipeline import generate_shorts_content

router = APIRouter()


class AutomateRequest(BaseModel):
    title: str
    description: str
    hashtags: List[str] = []
    thumbnail_url: Optional[str] = None
    url: str
    opus_mode: Optional[bool] = False
    # Optional enrichment fields (sent from frontend if available)
    duration_seconds: Optional[int] = None
    transcript: Optional[str] = None
    detected_genre: Optional[str] = None
    detected_language: Optional[str] = "English"
    target_region: Optional[str] = "India"


@router.post("/automate")
async def automate_pipeline(req: AutomateRequest):
    result = generate_shorts_content(
        video_title=req.title,
        video_description=req.description,
        hashtags=req.hashtags,
        duration_seconds=req.duration_seconds,
        transcript=req.transcript,
        detected_genre=req.detected_genre,
        detected_language=req.detected_language or "English",
        target_region=req.target_region or "India",
        temperature=0.8,
    )

    return {
        "status": "success",
        "message": "Automation pipeline triggered successfully",
        "automation_details": {
            "title":              result.get("title", req.title),
            "description":        result.get("description", req.description),
            "hashtags":           result.get("hashtags", req.hashtags),
            "scheduled_time":     result.get("optimal_schedule_time", "07:00 PM"),
            "reasoning":          result.get("schedule_reasoning", "Peak engagement window."),
            "confidence_notes":   result.get("confidence_notes", ""),
            "post_status":        "Scheduled 🚀",
            "model_used":         "See confidence_notes"
        }
    }
