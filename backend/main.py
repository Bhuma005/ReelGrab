import os
import time
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
import yt_dlp
import uuid
import glob
import re
import urllib.request
import tempfile
from backend.automate import router as automate_router
from backend.youtube_auth import router as yt_auth_router
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cloud", ".env"))
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")

app = FastAPI(title="ReelGrab")

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(automate_router)
app.include_router(yt_auth_router)

DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

class URLRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_id: str

class AnalyzeRequest(BaseModel):
    title: Optional[str] = ''
    description: Optional[str] = ''

RATE_LIMIT_STORE: Dict[str, float] = {}
RATE_LIMIT_SECONDS = 5.0

def check_rate_limit(client_id: str):
    now = time.time()
    last_request = RATE_LIMIT_STORE.get(client_id, 0)
    if now - last_request < RATE_LIMIT_SECONDS:
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Try again in {RATE_LIMIT_SECONDS - (now - last_request):.1f} seconds."
        )
    RATE_LIMIT_STORE[client_id] = now

def validate_url(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
        
    is_valid = "instagram.com" in url or "youtube.com" in url or "youtu.be" in url
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid Instagram or YouTube link.")

@app.post("/formats")
async def get_formats(req: URLRequest, request: Request):
    
    validate_url(req.url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Fetching info for {req.url}")
            info = ydl.extract_info(req.url, download=False)
            
            if not info:
                raise HTTPException(status_code=400, detail="Could not extract info. Video might be private or unavailable.")
            
            formats = info.get('formats', [])
            resolutions = []
            
            for f in formats:
                if f.get('vcodec') != 'none':
                    width = f.get('width')
                    height = f.get('height')
                    resolution_text = f"{width}x{height}" if width and height else f.get('format_note', 'Unknown')
                    
                    actual_filesize = f.get('filesize') or f.get('filesize_approx')
                    if not actual_filesize and f.get('url'):
                        try:
                            async with httpx.AsyncClient() as client:
                                res_head = await client.head(f.get('url'), timeout=2.0)
                                cl = res_head.headers.get('Content-Length')
                                if cl and cl.isdigit():
                                    actual_filesize = int(cl)
                        except httpx.RequestError:
                            pass
                            
                    resolutions.append({
                        "format_id": f.get('format_id'),
                        "resolution": resolution_text,
                        "ext": f.get('ext'),
                        "filesize": actual_filesize,
                        "width": width or 0,
                        "height": height or 0
                    })
            
            # Sort by resolution (width*height) descending
            resolutions.sort(key=lambda x: (x['width'] * x['height']), reverse=True)
            
            # Remove duplicates based on resolution and ext
            unique_resolutions = []
            seen = set()
            for r in resolutions:
                key = f"{r['resolution']}_{r['ext']}"
                if key not in seen:
                    seen.add(key)
                    unique_resolutions.append(r)
            
            return unique_resolutions
            
    except yt_dlp.utils.DownloadError as e:
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=400, detail=f"Download error: {str(e)}")
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while fetching formats.")


def cleanup_partial_downloads(temp_id: str):
    """Deletes any partial files for a given id"""
    for file in glob.glob(os.path.join(DOWNLOAD_DIR, f"{temp_id}*")):
        try:
            os.remove(file)
            print(f"Cleaned up {file}")
        except Exception as e:
            print(f"Failed to clean up {file}: {e}")

@app.post("/download")
async def download_video(req: DownloadRequest, request: Request):
    validate_url(req.url)
    
    temp_id = str(uuid.uuid4())
    ydl_opts = {
        'format': req.format_id,
        'outtmpl': os.path.join(DOWNLOAD_DIR, f"{temp_id}.%(ext)s"),
        'quiet': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading format {req.format_id} for {req.url}")
            info = ydl.extract_info(req.url, download=True)
            
            ext = info.get('ext', 'mp4')
            filepath = os.path.join(DOWNLOAD_DIR, f"{temp_id}.{ext}")
            
            if not os.path.exists(filepath):
                downloaded_files = glob.glob(os.path.join(DOWNLOAD_DIR, f"{temp_id}*"))
                if downloaded_files:
                    filepath = downloaded_files[0]
                else:
                    raise FileNotFoundError("Download failed, file not found.")
            
            video_id = info.get('id', temp_id)
            final_filename = f"{video_id}.{filepath.split('.')[-1]}"
            final_filepath = os.path.join(DOWNLOAD_DIR, final_filename)
            
            if os.path.exists(final_filepath):
                try:
                    os.remove(final_filepath)
                except:
                    final_filepath = os.path.join(DOWNLOAD_DIR, f"{video_id}_{temp_id}.{filepath.split('.')[-1]}")
                    
            os.rename(filepath, final_filepath)
            
            return FileResponse(
                path=final_filepath, 
                media_type=f"video/{final_filepath.split('.')[-1]}", 
                filename=final_filename
            )
            
    except yt_dlp.utils.DownloadError as e:
        cleanup_partial_downloads(temp_id)
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=400, detail=f"Download error: {str(e)}")
    except Exception as e:
        cleanup_partial_downloads(temp_id)
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during download.")

@app.post("/metadata")
async def get_metadata(req: URLRequest, request: Request):
    # validate_url handles invalid urls with HTTPException 400, but for metadata we want 200 with nulls on failure.
    try:
        validate_url(req.url)
    except HTTPException:
        return {"title": None, "description": None, "description_clean": None, "hashtags": [], "thumbnail_url": None}

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            if not info:
                return {"title": None, "description": None, "description_clean": None, "hashtags": [], "thumbnail_url": None}
            title = info.get('title')
            description = info.get('description') or ''
            thumbnail_url = info.get('thumbnail')
            
            hashtags = []
            seen = set()
            for match in re.finditer(r'#\w+', description):
                tag = match.group()
                if tag not in seen:
                    seen.add(tag)
                    hashtags.append(tag)
            
            description_clean = re.sub(r'#\w+', '', description)
            description_clean = re.sub(r'[ \t]+', ' ', description_clean)
            description_clean = re.sub(r'\n\s*\n', '\n', description_clean).strip()
            
            return {
                "title": title,
                "description": description,
                "description_clean": description_clean,
                "hashtags": hashtags,
                "thumbnail_url": thumbnail_url,
                "view_count": info.get('view_count'),
                "like_count": info.get('like_count'),
                "comment_count": info.get('comment_count')
            }
    except Exception as e:
        print(f"Metadata error: {e}")
        return {"title": None, "description": None, "description_clean": None, "hashtags": [], "thumbnail_url": None}

@app.post("/metadata/comments")
async def get_metadata_comments(req: URLRequest, request: Request):
    try:
        validate_url(req.url)
    except HTTPException:
        return {"hashtags": [], "available": False}

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'getcomments': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            if not info:
                return {"hashtags": [], "available": False}
            
            uploader = info.get('uploader') or info.get('uploader_id')
            comments = info.get('comments', [])
            
            hashtags = []
            seen = set()
            for comment in comments:
                author = comment.get('author') or comment.get('author_id')
                if author and uploader and author == uploader:
                    text = comment.get('text', '')
                    for match in re.finditer(r'#\w+', text):
                        tag = match.group()
                        if tag not in seen:
                            seen.add(tag)
                            hashtags.append(tag)
                            
            return {"hashtags": hashtags, "available": True}
    except Exception as e:
        print(f"Comments metadata error: {e}")
        return {"hashtags": [], "available": False}

@app.post("/download-thumbnail")
async def download_thumbnail(req: URLRequest, request: Request):
    validate_url(req.url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            if not info:
                raise HTTPException(status_code=400, detail="Could not extract info.")
            thumbnail_url = info.get('thumbnail')
            if not thumbnail_url:
                raise HTTPException(status_code=404, detail="Thumbnail not found.")
                
            temp_id = str(uuid.uuid4())
            ext = thumbnail_url.split('?')[0].split('.')[-1]
            if not ext or len(ext) > 4:
                ext = 'jpg'
                
            filepath = os.path.join(DOWNLOAD_DIR, f"{temp_id}_thumb.{ext}")
            
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(thumbnail_url, timeout=5.0)
                    resp.raise_for_status()
                    with open(filepath, 'wb') as f:
                        f.write(resp.content)
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch thumbnail: {e.response.status_code}")
            except httpx.RequestError as e:
                raise HTTPException(status_code=504, detail="Timeout or network error while fetching thumbnail.")
            
            return FileResponse(
                path=filepath, 
                media_type=f"image/{ext if ext != 'jpg' else 'jpeg'}", 
                filename=f"thumbnail_{info.get('id', temp_id)}.{ext}"
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Thumbnail error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching thumbnail.")
        
@app.post("/metadata/analyze")
async def analyze_metadata(req: AnalyzeRequest):
    import json
    from backend.ai_pipeline import generate_shorts_content
    text = f"{req.title or ''}\n{req.description or ''}".strip()
    if not text:
        return {"viral_title": "", "optimized_description": "", "youtube": [], "instagram": [], "analysis": ""}
        
    # ── Fetch real-time trending tags for extra context ──────────────────────
    trending_context = ""
    if YOUTUBE_API_KEY:
        try:
            yt_url = (
                f"https://youtube.googleapis.com/youtube/v3/videos"
                f"?part=snippet&chart=mostPopular&regionCode=IN&maxResults=20&key={YOUTUBE_API_KEY}"
            )
            async with httpx.AsyncClient() as client:
                yt_res = await client.get(yt_url, timeout=3.0)
                yt_res.raise_for_status()
                yt_data = yt_res.json()
                tags = []
                for item in yt_data.get('items', []):
                    tags.extend(item.get('snippet', {}).get('tags', []))
                from collections import Counter
                top_tags = [t[0] for t in Counter(tags).most_common(10) if len(t[0]) < 20]
                if top_tags:
                    trending_context = "Live trending tags: " + ", ".join(top_tags)
        except httpx.RequestError as e:
            print(f"YT API Request Error: {e}")
        except httpx.HTTPStatusError as e:
            print(f"YT API HTTP Error: {e.response.status_code}")

    # ── Delegate to the professional AI pipeline ─────────────────────────────
    result = generate_shorts_content(
        video_title=req.title or "",
        video_description=req.description or "",
        hashtags=[],
        transcript=(req.description or "")[:600] + ("\n" + trending_context if trending_context else ""),
        target_region="India",
        temperature=0.8,
    )

    # Map new output format to what the frontend expects
    all_hashtags = result.get("hashtags", [])
    # Split hashtags evenly between youtube/instagram chips
    mid = max(3, len(all_hashtags) // 2)
    youtube_tags  = all_hashtags[:mid]
    instagram_tags = all_hashtags[mid:] or all_hashtags[:3]

    sched_time = result.get("optimal_schedule_time", "07:30 PM")
    
    import dateutil.parser
    from datetime import datetime, date, timedelta
    try:
        parsed_time = dateutil.parser.parse(sched_time).time()
        now = datetime.now()
        target_dt = datetime.combine(now.date(), parsed_time)
        if target_dt < now:
            target_dt += timedelta(days=1)
        human_readable_time = target_dt.strftime("%B %d, %I:%M %p")
    except Exception:
        human_readable_time = sched_time # fallback to raw string

    return {
        "viral_title":           result.get("title", ""),
        "optimized_description": result.get("description", ""),
        "youtube":               youtube_tags,
        "instagram":             instagram_tags,
        "analysis":              result.get("schedule_reasoning", ""),
        "confidence_notes":      result.get("confidence_notes", ""),
        "scheduled_time":        human_readable_time,
    }
