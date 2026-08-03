"""
automate.py  —  YouTube Shorts Automation endpoint.
Delegates AI generation to the professional ai_pipeline module.
"""

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import yt_dlp
from pathlib import Path
import dateutil.parser
from datetime import datetime, date, timedelta

from backend.ai_pipeline import generate_shorts_content
from cloud.enqueue import enqueue_video
from cloud.cloud_auth import get_supabase_client

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
async def automate_pipeline(req: AutomateRequest, background_tasks: BackgroundTasks):
    print(f"🚀 Starting automation pipeline for: {req.url}")
    
    # 1. Generate optimal trending metadata & schedule via AI
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

    opt_title = result.get("title", req.title)
    opt_desc = result.get("description", req.description)
    opt_tags = result.get("hashtags", req.hashtags)
    sched_time = result.get("optimal_schedule_time", "07:30 PM") 
    
    # ── Intelligent Date Scheduling (Max 2 per day) ──
    try:
        parsed_time = dateutil.parser.parse(sched_time).time()
        now = datetime.now()
        target_date = now.date()
        target_dt = datetime.combine(target_date, parsed_time)
        
        # 1. If today's time has already passed, start checking from tomorrow
        if target_dt < now:
            target_date += timedelta(days=1)
            target_dt = datetime.combine(target_date, parsed_time)
            
        # 2. Query Supabase to ensure MAX 2 posts per day!
        sb = get_supabase_client()
        while True:
            # Check how many videos are scheduled between start and end of target_date
            start_of_day = datetime.combine(target_date, datetime.min.time()).astimezone().isoformat()
            end_of_day = datetime.combine(target_date, datetime.max.time()).astimezone().isoformat()
            
            res = sb.table("scheduled_videos").select("id", count="exact") \
                .gte("schedule_time", start_of_day) \
                .lte("schedule_time", end_of_day).execute()
                
            # 'count' attribute contains the total matching rows in Supabase
            daily_count = res.count if res.count is not None else len(res.data)
            
            if daily_count < 2:
                # We have space on this day!
                break
                
            # If 2 or more videos are already scheduled on this day, push exactly 24 hours forward!
            target_date += timedelta(days=1)
            target_dt = datetime.combine(target_date, parsed_time)
            
        final_iso_schedule = target_dt.astimezone().isoformat()
        human_readable_time = target_dt.strftime("%B %d, %I:%M %p")
        
    except Exception as e:
        print(f"Time parsing Error: {e}")
        # Fallback to right now + 2 hours if parse fails entirely
        target_dt = datetime.now() + timedelta(hours=2)
        final_iso_schedule = target_dt.astimezone().isoformat()
        human_readable_time = target_dt.strftime("%B %d, %I:%M %p")

    # 2. Download the video locally to a temporary location
    downloads_dir = Path(__file__).parent.parent / "downloads"
    downloads_dir.mkdir(exist_ok=True)
    temp_id = str(uuid.uuid4())
    temp_filepath = str(downloads_dir / f"auto_{temp_id}.mp4")

    print(f"⬇️ Downloading video to temporary file: {temp_filepath}...")
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': temp_filepath,
        'quiet': True,
        'no_warnings': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([req.url])
    except Exception as e:
        return {"status": "error", "message": f"Download failed: {str(e)}"}

    # 3. Enqueue directly to the Supabase Cloud Storage + Database
    print(f"⬆️ Sending securely to Supabase Cloud...")
    try:
        new_id = enqueue_video(
            file_path=temp_filepath,
            title=opt_title,
            description=opt_desc,
            hashtags=opt_tags,
            schedule_time=final_iso_schedule
        )
        print(f"✅ Video enqueued in cloud with DB ID: {new_id}")
    except Exception as e:
        # Ensure we delete the file if cloud upload fails
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        return {"status": "error", "message": f"Cloud Upload failed: {str(e)}"}

    # 4. Clean up the local hard drive!
    if os.path.exists(temp_filepath):
        print("🧹 Cleaning up local temporary video file...")
        os.remove(temp_filepath)

    return {
        "status": "success",
        "message": "Automation pipeline triggered successfully",
        "automation_details": {
            "title":              opt_title,
            "description":        opt_desc,
            "hashtags":           opt_tags,
            "scheduled_time":     human_readable_time,
            "iso_schedule":       final_iso_schedule,
            "reasoning":          result.get("schedule_reasoning", "Peak engagement window."),
            "confidence_notes":   result.get("confidence_notes", ""),
            "post_status":        "Scheduled 🚀",
            "model_used":         "See confidence_notes"
        }
    }
