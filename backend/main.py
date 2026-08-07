import os
import time
import asyncio
import logging
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
from backend.utils import sanitize_url

# Configure Structured Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

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

RATE_LIMIT_STORE: Dict[str, list] = {}
RATE_LIMIT_BURST = 5
RATE_LIMIT_SECONDS = 1.0

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # Get request timestamps for this IP
    history = RATE_LIMIT_STORE.get(client_ip, [])
    # Remove timestamps older than RATE_LIMIT_SECONDS
    history = [t for t in history if now - t < RATE_LIMIT_SECONDS]
    
    if len(history) >= RATE_LIMIT_BURST:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429, 
            content={"detail": "Too many requests. Please slow down."}
        )
    
    history.append(now)
    RATE_LIMIT_STORE[client_ip] = history
    response = await call_next(request)
    return response

def validate_url(url: str):
    url = sanitize_url(url)
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty or invalid.")
        
    is_valid = "instagram.com" in url or "youtube.com" in url or "youtu.be" in url
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid Instagram or YouTube link.")
    return url

@app.post("/formats", summary="Get Video Formats", description="Returns a list of available video formats for a valid URL.")
async def get_formats(req: URLRequest, request: Request):
    
    req.url = validate_url(req.url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Fetching info for {req.url}")
            info = await asyncio.to_thread(ydl.extract_info, req.url, download=False)
            
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
                            req_head = urllib.request.Request(f.get('url'), method='HEAD')
                            with urllib.request.urlopen(req_head, timeout=2.0) as res_head:
                                cl = res_head.headers.get('Content-Length')
                                if cl and cl.isdigit():
                                    actual_filesize = int(cl)
                        except Exception:
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

@app.post("/download", summary="Download specific video format", description="Downloads the video from the provided URL using the requested format ID.")
async def download_video(req: DownloadRequest, request: Request):
    req.url = validate_url(req.url)
    
    temp_id = str(uuid.uuid4())
    ydl_opts = {
        'format': req.format_id,
        'outtmpl': os.path.join(DOWNLOAD_DIR, f"{temp_id}.%(ext)s"),
        'quiet': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Downloading format {req.format_id} for {req.url}")
            info = await asyncio.to_thread(ydl.extract_info, req.url, download=True)
            
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

@app.post("/metadata", summary="Fetch Video Metadata", description="Extracts basic title, description, and hashtags from a video URL.")
async def get_metadata(req: URLRequest, request: Request):
    # validate_url handles invalid urls with HTTPException 400, but for metadata we want 200 with nulls on failure.
    try:
        req.url = validate_url(req.url)
    except HTTPException:
        return {"title": None, "description": None, "description_clean": None, "hashtags": [], "thumbnail_url": None}

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = await asyncio.to_thread(ydl.extract_info, req.url, download=False)
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

@app.post("/metadata/comments", summary="Extract Comments Hashtags", description="Pulls comment sections and parses the author's own hashtags for deep viral tagging.")
async def get_metadata_comments(req: URLRequest, request: Request):
    try:
        req.url = validate_url(req.url)
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
            info = await asyncio.to_thread(ydl.extract_info, req.url, download=False)
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

@app.post("/download-thumbnail", summary="Download Best Thumbnail", description="Retrieves and proxies the max resolution thumbnail for a video URL.")
async def download_thumbnail(req: URLRequest, request: Request):
    req.url = validate_url(req.url)
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = await asyncio.to_thread(ydl.extract_info, req.url, download=False)
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
            urllib.request.urlretrieve(thumbnail_url, filepath)
            
            return FileResponse(
                path=filepath, 
                media_type=f"image/{ext if ext != 'jpg' else 'jpeg'}", 
                filename=f"thumbnail_{info.get('id', temp_id)}.{ext}"
            )
    except Exception as e:
        print(f"Thumbnail error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching thumbnail.")
        
@app.post("/metadata/analyze", summary="Analyze via Local GenAI", description="Delegates metadata to local Ollama instance for intelligent scheduling and descriptions.")
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
            with urllib.request.urlopen(urllib.request.Request(yt_url), timeout=3.0) as yt_res:
                yt_data = json.loads(yt_res.read())
                tags = []
                for item in yt_data.get('items', []):
                    tags.extend(item.get('snippet', {}).get('tags', []))
                from collections import Counter
                top_tags = [t[0] for t in Counter(tags).most_common(10) if len(t[0]) < 20]
                if top_tags:
                    trending_context = "Live trending tags: " + ", ".join(top_tags)
        except Exception as e:
            print(f"YT API Error: {e}")

    # ── Delegate to the professional AI pipeline ─────────────────────────────
    result = await asyncio.to_thread(
        generate_shorts_content,
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

@app.get("/api/dashboard/stats", summary="Get Dashboard Stats", description="Fetch cloud DB statistics for connections and saved/uploaded videos.")
async def get_dashboard_stats():
    from cloud.cloud_auth import get_supabase_client
    try:
        sb = get_supabase_client()
        # We can do aggregate counts or just fetch them if small.
        # Supabase Python client can give counts
        res_pending = sb.table("scheduled_videos").select("id", count="exact").eq("upload_status", "pending").execute()
        res_uploaded = sb.table("scheduled_videos").select("id", count="exact").eq("upload_status", "uploaded").execute()
        res_failed = sb.table("scheduled_videos").select("id", count="exact").eq("upload_status", "failed").execute()
        
        return {
            "pending": res_pending.count if getattr(res_pending, "count", None) is not None else len(res_pending.data),
            "uploaded": res_uploaded.count if getattr(res_uploaded, "count", None) is not None else len(res_uploaded.data),
            "failed": res_failed.count if getattr(res_failed, "count", None) is not None else len(res_failed.data)
        }
    except Exception as e:
        logger.error(f"Dashboard Stats error: {e}")
        return {"pending": 0, "uploaded": 0, "failed": 0, "error": str(e)}

@app.get("/api/dashboard/videos", summary="Get Video Queue", description="Fetch recently scheduled videos for preview in the dashboard ui.")
async def get_dashboard_videos():
    from cloud.cloud_auth import get_supabase_client
    try:
        sb = get_supabase_client()
        res = sb.table("scheduled_videos").select("*").order("schedule_time", desc=True).limit(20).execute()
        videos = res.data
        for v in videos:
            if v.get("storage_path"):
                try:
                    signed = sb.storage.from_("reelgrab-videos").create_signed_url(v["storage_path"], 3600*24)
                    v["public_url"] = signed.get("signedURL") or signed.get("signedUrl") or signed
                except Exception as e:
                    logger.error(f"Failed to generate signed url: {e}")
        return {"videos": videos}
    except Exception as e:
        logger.error(f"Dashboard Videos error: {e}")
        return {"videos": [], "error": str(e)}


@app.delete("/api/dashboard/videos/{video_id}", summary="Delete a video", description="Deletes video from Supabase Storage and DB.")
async def delete_dashboard_video(video_id: str):
    from cloud.cloud_auth import get_supabase_client
    from datetime import datetime
    try:
        sb = get_supabase_client()
        # 1. Get the video record to find storage_path
        res = sb.table("scheduled_videos").select("storage_path, title").eq("id", video_id).execute()
        if not res.data:
            return {"status": "error", "message": "Video not found"}
        
        storage_path = res.data[0].get("storage_path")
        title = res.data[0].get("title")
        
        # 2. Delete from Supabase Storage bucket
        if storage_path:
            sb.storage.from_("reelgrab-videos").remove([storage_path])
            
        # 3. Delete from Supabase DB
        sb.table("scheduled_videos").delete().eq("id", video_id).execute()
        
        # 4. Write to audit log for safe side
        with open("reelgrab_audit.log", "a", encoding='utf-8') as log_file:
            log_file.write(f"[{datetime.now().isoformat()}] DELETED VIDEO | ID: {video_id} | Title: {title} | Storage: {storage_path}\n")
            
        return {"status": "success", "message": "Video deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete video: {e}")
        import traceback
        err = traceback.format_exc()
        logger.error(f"Convert error trace: {err}")
        return {"status": "error", "message": repr(e)}


from pydantic import BaseModel
class ConvertRequest(BaseModel):
    ratio: str

@app.post("/api/dashboard/videos/{video_id}/convert", summary="Convert Aspect Ratio")
async def convert_dashboard_video(video_id: str, req: ConvertRequest):
    from cloud.cloud_auth import get_supabase_client
    import os
    import subprocess
    import uuid
    import asyncio
    
    ratio_map = {
        "9:16": (1080, 1920),
        "1:1": (1080, 1080),
        "4:5": (1080, 1350),
        "16:9": (1920, 1080)
    }
    if req.ratio not in ratio_map:
        return {"status": "error", "message": "Invalid ratio"}
    W, H = ratio_map[req.ratio]
    
    try:
        sb = get_supabase_client()
        res = sb.table("scheduled_videos").select("storage_path").eq("id", video_id).execute()
        if not res.data:
            return {"status": "error", "message": "Video not found"}
            
        storage_path = res.data[0].get("storage_path")
        
        # 1. Download the original video completely to memory or disk
        temp_in = f"downloads/conv_in_{uuid.uuid4().hex}.mp4"
        temp_out = f"downloads/conv_out_{uuid.uuid4().hex}.mp4"
        os.makedirs("downloads", exist_ok=True)
        
        with open(temp_in, "wb") as f:
            res_down = sb.storage.from_("reelgrab-videos").download(storage_path)
            f.write(res_down)
            
        # 2. Run FFmpeg (blur background padding technique)
        filter_complex = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease[fg];[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,boxblur=20:20,crop={W}:{H}[bg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
        cmd = [
            # Check if ffmpeg exists locally (downloaded by standard agent setup)
            "backend/ffmpeg.exe" if os.path.exists("backend/ffmpeg.exe") else "ffmpeg",
            "-y", "-i", temp_in,
            "-lavfi", filter_complex,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "copy",
            temp_out
        ]
        
        def run_ffmpeg():
            return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
        process = await asyncio.to_thread(run_ffmpeg)
        
        if process.returncode != 0:
            logger.error(f"FFmpeg error: {process.stderr.decode()}")
            return {"status": "error", "message": "FFmpeg conversion failed: " + process.stderr.decode()[:200]}
            
        # 3. Upload overwritten video back to Supabase
        with open(temp_out, "rb") as f:
            sb.storage.from_("reelgrab-videos").update(storage_path, f, file_options={"content-type": "video/mp4", "upsert": "true"})
            
        # Cleanup
        if os.path.exists(temp_in): os.remove(temp_in)
        if os.path.exists(temp_out): os.remove(temp_out)
        
        return {"status": "success", "message": "Converted"}
    except Exception as e:
        logger.error(f"Convert error: {e}")
        import traceback
        err = traceback.format_exc()
        logger.error(f"Convert error trace: {err}")
        return {"status": "error", "message": repr(e)}
