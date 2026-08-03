# ReelGrab Project Report

## Project Overview
ReelGrab is a personal Instagram Reel downloader that runs on localhost only, designed for personal use. The application allows users to download Instagram Reels and YouTube videos, extract metadata, generate AI-powered content suggestions, and automate posting to YouTube Shorts with intelligent scheduling.

## Current Project Phase
Based on the git history and recent commits, the project is currently in **Phase 3: Intelligent Automation & Cloud Integration** phase. The most recent commit (`135cd18`) implemented "Intelligent 2-per-day automation scheduling with cloud enqueue logic," indicating advanced automation features are now implemented.

## Technical Stack Analysis

### Frontend Technologies
- **HTML5** - Semantic markup structure
- **CSS3** - Custom styling with CSS variables, animations, and responsive design
- **JavaScript (Vanilla)** - DOM manipulation, API interactions, and UI logic
- **Fonts**: Archivo Black, Inter, JetBrains Mono (from Google Fonts)
- **Icons**: Custom SVG icons embedded in HTML

### Backend Technologies
- **Python 3.10+** - Core backend language
- **FastAPI** - Modern, fast web framework for building APIs
- **Uvicorn** - ASGI server for running the FastAPI application
- **Pydantic** - Data validation and settings management
- **yt-dlp** - Video downloading library (fork of youtube-dl)
- **Ollama** - Local LLM inference for AI content generation
- **Google API Client** - YouTube Data API v3 integration
- **Supabase** - Cloud database and storage backend

### Cloud Infrastructure
- **Supabase** - PostgreSQL database with real-time capabilities
- **Supabase Storage** - Object storage for video files
- **GitHub Actions** - CI/CD automation for cloud workflows
- **Google Cloud YouTube Data API** - YouTube upload and management

### AI/ML Components
- **Ollama** - Local LLM service running models like:
  - qwen2.5:7b (preferred)
  - qwen2.5:3b (fallback)
  - llama3.2:3b (fallback)
  - mistral:7b (fallback)
  - qwen2:0.5b (absolute fallback)
- Custom AI pipeline for YouTube Shorts optimization:
  - Viral title generation
  - Description optimization
  - Hashtag suggestions
  - Optimal posting time prediction
  - Content analysis and reasoning

## Core Features

### 1. Video Download Capabilities
- **Platform Support**: Instagram Reels, YouTube videos
- **Format Selection**: Multiple quality/resolution options
- **Metadata Extraction**: Title, description, hashtags, thumbnail, view/like counts
- **Thumbnail Download**: Separate thumbnail download functionality

### 2. AI-Powered Content Optimization
- **Viral Title Generation**: Uses proven patterns (curiosity gap, payoff tease, etc.)
- **Description Optimization**: Creates engaging, conversion-focused descriptions
- **Hashtag Generation**: Mix of broad and niche-specific hashtags
- **Optimal Scheduling**: Recommends best posting times based on content type and audience region
- **Confidence Scoring**: Provides reasoning and confidence notes for AI suggestions

### 3. YouTube Automation Pipeline
- **One-Click Automation**: Download, process, and schedule YouTube uploads
- **Intelligent Scheduling**: Enforces maximum 2 uploads per day limit
- **Cloud Integration**: Secure upload to Supabase Storage
- **YouTube Integration**: Automated upload via YouTube Data API v3
- **Retry Mechanism**: Automatic retries (up to 3 attempts) for failed uploads
- **Cleanup Automation**: Automatic deletion of cloud files after 3 days

### 4. User Interface Features
- **Retro CRT/Aesthetic Design**: VHS-inspired visual theme with sprocket holes
- **Real-time Feedback**: Loading states, error handling, success notifications
- **Interactive Elements**: Clickable format chips, copy-to-clipboard buttons
- **Responsive Design**: Works across different screen sizes
- **Dark Theme**: Optimized for low-light viewing with accent colors

### 5. Cloud-Native Architecture
- **Microservices Approach**: Separate workflows for upload and cleanup
- **Serverless Functions**: GitHub Actions as scheduled cron jobs
- **Database-First Approach**: Supabase as central data store
- **Object Storage**: Supabase Storage for media files
- **API-First Design**: RESTful backend with comprehensive endpoints

## System Architecture

### Frontend-Backend Communication
```
Frontend (localhost:9090) 
    ↓ HTTP REST API
Backend API (localhost:8000)
    ↓ 
├── Local Processing (yt-dlp, Ollama)
├── Cloud Storage (Supabase)
└── External APIs (YouTube Data API)
```

### Cloud Workflow Pipeline
1. **User Action**: Click "Automate & Post to YouTube" in UI
2. **Backend Processing**: 
   - Video downloaded locally
   - AI-generated metadata created
   - Video uploaded to Supabase Storage
   - Database record created with schedule time
3. **Cloud Upload Worker** (GitHub Actions - every 20 minutes):
   - Polls for pending videos ready for upload
   - Downloads from Supabase Storage
   - Uploads to YouTube via API
   - Updates database with YouTube video ID
4. **Cloud Cleanup Worker** (GitHub Actions - daily at 21:30 UTC):
   - Finds uploaded videos older than 3 days
   - Removes from Supabase Storage
   - Archives to audit log
   - Deletes from main table

## API Endpoints

### Video Processing Endpoints
- `POST /formats` - Get available video formats/resolutions
- `POST /metadata` - Extract video metadata (title, description, thumbnail)
- `POST /metadata/comments` - Extract hashtags from video comments
- `POST /download-thumbnail` - Download video thumbnail
- `POST /metadata/analyze` - AI-powered content analysis and optimization

### Download Endpoints
- `POST /download` - Download video in selected format
- `POST /download-thumbnail` - Download video thumbnail

### Automation Endpoints
- `POST /automate` - Full automation pipeline (download → AI processing → cloud upload)
- `POST /auth/status` - Check YouTube authentication status
- `POST /auth/login` - Initiate YouTube OAuth flow
- `POST /auth/callback` - Handle YouTube OAuth callback
- `POST /auth/logout` - Disconnect YouTube account

## Database Schema

### `scheduled_videos` Table
- `id` (UUID) - Primary key
- `title` (TEXT) - Video title
- `description` (TEXT) - Video description
- `hashtags` (TEXT[]) - Array of hashtags
- `storage_path` (TEXT) - Path in Supabase Storage
- `schedule_time` (TIMESTAMPTZ) - Scheduled upload time (UTC)
- `upload_status` (TEXT) - Status: pending/uploading/uploaded/failed
- `youtube_video_id` (TEXT) - YouTube video ID after upload
- `uploaded_at` (TIMESTAMPTZ) - Upload timestamp
- `delete_after` (TIMESTAMPTZ) - Auto-deletion timestamp (upload + 3 days)
- `retry_count` (INTEGER) - Number of upload retry attempts
- `last_error` (TEXT) - Last error message if upload failed
- `created_at` (TIMESTAMPTZ) - Record creation timestamp

### `videos_audit_log` Table
- `id` (UUID) - Primary key
- `title` (TEXT) - Video title
- `youtube_video_id` (TEXT) - YouTube video ID
- `uploaded_at` (TIMESTAMPTZ) - Upload timestamp
- `deleted_at` (TIMESTAMPTZ) - Deletion timestamp

## Key Concepts and Implementation Details

### 1. Rate Limiting
- Implemented backend rate limiting (5 seconds between requests)
- Prevents abuse and protects external API quotas

### 2. AI Pipeline
- **Model Selection**: Dynamic selection of best available Ollama model
- **Prompt Engineering**: Sophisticated system prompts for YouTube Shorts optimization
- **Validation & Fixing**: Post-processing to enforce title length, emoji limits, etc.
- **Fallback Mechanisms**: Graceful degradation to smaller models if needed

### 3. Intelligent Scheduling Algorithm
- **Genre-Based Timing**: Different content types have optimal posting times
- **Regional Awareness**: Considers target audience timezone
- **Daily Limits**: Enforces maximum 2 uploads per day constraint
- **Fallback Logic**: Defaults to evening times if scheduling fails

### 4. Cloud Integration Security
- **Environment Variables**: Secrets stored in GitHub Secrets/.env (never committed)
- **Service Accounts**: Supabase service key for backend operations
- **OAuth 2.0**: Proper YouTube authentication flow with refresh tokens
- **Token Refresh**: Automatic access token refresh using refresh tokens

### 5. Error Handling & Resilience
- **Retry Logic**: Automatic retries for failed cloud operations
- **Graceful Degradation**: Falls back to basic functionality when AI unavailable
- **Resource Cleanup**: Temporary file cleanup after operations
- **Status Tracking**: Comprehensive status tracking for all operations

### 6. User Experience Features
- **Visual Feedback**: Loading spinners, progress indicators, toast notifications
- **Error Recovery**: Clear error messages with retry options
- **Copy Functionality**: One-click copying of text/hashtags
- **Format Selection**: Visual representation of video quality/file size
- **Dark Mode Optimization**: Carefully chosen color scheme for readability

## Recent Development Focus (Based on Git History)

### Phase 1 & 2: Cloud Migration (`7b586c6`)
- Migrated to cloud architecture with Supabase backend
- Implemented GitHub Actions workflows for cloud processing
- Added YouTube authentication and upload capabilities
- Created database schema for video scheduling

### Phase 3: Intelligent Automation (`135cd18`)
- Enhanced automation with intelligent 2-per-day scheduling
- Improved AI content generation pipeline
- Refined cloud upload/worker logic
- Enhanced frontend automation UI and feedback

## Setup and Installation

### Prerequisites
- Python 3.10+
- Node.js (for frontend serving, though Python HTTP server is used)
- Git
- Ollama (for AI features - optional but recommended)
- Supabase account (for cloud features)
- Google Cloud project with YouTube Data API enabled

### Local Setup
1. Clone the repository
2. Create virtual environment: `python -m venv venv`
3. Activate virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r backend/requirements.txt`
5. Configure environment variables (see `.env.example` or check `.gitignore` for required vars)
6. Start backend: `python -m uvicorn backend.main:app --reload`
7. Start frontend: `cd frontend && python -m http.server 9090`
8. Visit: `http://127.0.0.1:9090`

### Cloud Setup
1. Create Supabase project and obtain URL and service key
2. Create Google Cloud project and enable YouTube Data API v3
3. Set up OAuth 2.0 credentials for YouTube access
4. Configure GitHub Secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `YT_CLIENT_ID`
   - `YT_CLIENT_SECRET`
   - `YT_REFRESH_TOKEN`
5. Ensure GitHub Actions workflows are enabled

## Future Enhancements Possibilities

### Short-Term Improvements
1. **Enhanced Analytics**: Deeper engagement metrics and A/B testing
2. **Template System**: Save and Template**: Save/reuse successful title/description templates
3. **Batch Processing**: Handle multiple videos in queue
4. **Platform Expansion**: Support for TikTok, Facebook Reels, etc.

### Medium-Term Enhancements
1. **Advanced AI Integration**: 
   - Video content analysis for better recommendations
   - Trend detection and prediction
   - Automated thumbnail generation
2. **Improved Scheduling**:
   - Machine learning-based optimal timing
   - Audience engagement prediction
   - Competitor analysis integration
3. **Collaboration Features**:
   - Multi-user support
   - Team workflow management
   - Approval processes

### Long-Term Vision
1. **Mobile Companion App**: On-the-go video processing
2. **Desktop Application**: Native Electron/ Tauri app
3. **Marketplace**: Share and discover content templates
4. **Enterprise Features**: Team management, analytics dashboard, SLA guarantees

## Project Strengths

### Technical Excellence
- Modern, maintainable codebase with clear separation of concerns
- Comprehensive error handling and recovery mechanisms
- Secure handling of credentials and API keys
- Responsive, user-friendly interface with attention to UX details

### Innovative Features
- AI-powered content optimization running locally (privacy-focused)
- Intelligent scheduling with platform-specific best practices
- Hybrid local/cloud architecture balancing performance and scalability
- Automated cleanup to prevent storage bloat

### Production Readiness
- Comprehensive logging and monitoring capabilities
- Backup and disaster recovery considerations
- Scalable cloud infrastructure
- Clear documentation and setup instructions

## Conclusion

ReelGrab represents a sophisticated evolution from a simple video downloader to an intelligent content automation platform. By combining local processing power (for privacy and speed) with cloud scalability (for reliability and advanced features), it offers a unique solution for content creators looking to streamline their workflow while maintaining control over their data.

The project demonstrates modern full-stack development practices, thoughtful API design, and innovative use of AI for content optimization. Its current phase indicates a mature, production-ready system with room for continued growth and enhancement.

---
*Report generated on: 2026-08-03*
*Based on analysis of ReelGrab project repository*