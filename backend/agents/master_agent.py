import logging
from backend.agents.base import BaseAgent, AgentState
from backend.agents.llm import call_ollama
import datetime

logger = logging.getLogger(__name__)

class MasterAgent(BaseAgent):
    """
    Consolidated agent that performs Content, Metadata, Posting, and Validation
    analysis in a single Ollama call to drastically reduce generation time
    while maintaining the high quality of titles, hashtags, and description.
    """
    def run(self, state: AgentState) -> AgentState:
        logger.info("MasterAgent generating all metadata in a single pass...")
        
        raw_title = state.get("raw_title", "")
        raw_description = state.get("raw_description", "")
        transcript = state.get("transcript_text", "")
        
        system_prompt = (
            "You are ReelGrab's Advanced YouTube Shorts & Instagram Reels Intelligence Engine.\n"
            "Analyze the provided video transcript and raw metadata to generate HIGHLY RELEVANT, VIRAL content.\n\n"
            "REQUIREMENTS:\n"
            "1. Generate 10 diverse title strategies (Curiosity, Emotional, Search, Story, Relatable, Unexpected, Question, Short, Entertainment, Natural).\n"
            "2. Score each title internally and select the absolutely strongest as 'best_title'. Do NOT use generic clickbait like 'Must Watch'.\n"
            "3. Generate a highly engaging, optimized 'description' that summarizes the video perfectly.\n"
            "4. Generate up to 15 HIGHLY RELEVANT 'youtube_hashtags' (mix of broad and niche).\n"
            "5. Generate up to 30 HIGHLY RELEVANT 'instagram_hashtags' (mix of broad and niche).\n"
            "6. Provide a 'posting_recommendation' (e.g., '18:00', score: 95) based on general best practices for this niche.\n"
            "7. Validate the content for safety and quality.\n\n"
            "Output JSON exactly matching this schema:\n"
            "{\n"
            '  "content_summary": "1 sentence summary",\n'
            '  "title_candidates": [{"title": "string", "strategy": "string", "score": 95}],\n'
            '  "best_title": "string",\n'
            '  "viewer_appeal_score": 95,\n'
            '  "title_reason": ["Why this title was chosen"],\n'
            '  "description": "string",\n'
            '  "youtube_hashtags": ["#string"],\n'
            '  "instagram_hashtags": ["#string"],\n'
            '  "posting": {\n'
            '      "scheduled_time": "18:00",\n'
            '      "score": 95,\n'
            '      "confidence": "high",\n'
            '      "reason": "Why this time is best"\n'
            '  },\n'
            '  "validation": {"status": "passed"}\n'
            "}"
        )
        
        user_prompt = f"RAW TITLE:\n{raw_title}\n\nRAW DESC:\n{raw_description}\n\nTRANSCRIPT:\n{transcript[:1500]}"
        
        parsed = call_ollama(
            model="qwen2.5:7b",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_retries=2
        )
        
        if not parsed:
            logger.warning("MasterAgent generation failed (timeout or invalid JSON).")
            # We still need to return the nested structures so main.py mapping works
            state.update("metadata", {"status": "failed"})
            state.update("posting", {})
            state.update("validation", {"status": "failed"})
        else:
            # Reconstruct the state dictionary expected by main.py
            
            # --- Metadata ---
            yt = parsed.get("youtube_hashtags", [])
            ig = parsed.get("instagram_hashtags", [])
            seen = set()
            clean_yt = []
            clean_ig = []
            for t in yt:
                norm = t.lower().strip()
                if not norm.startswith("#"): norm = "#" + norm
                if norm not in seen:
                    seen.add(norm)
                    clean_yt.append(t.strip())
            for t in ig:
                norm = t.lower().strip()
                if not norm.startswith("#"): norm = "#" + norm
                if norm not in seen:
                    seen.add(norm)
                    clean_ig.append(t.strip())
                    
            state.update("metadata", {
                "status": "success",
                "best_title": parsed.get("best_title", ""),
                "title_candidates": parsed.get("title_candidates", []),
                "viewer_appeal_score": parsed.get("viewer_appeal_score", 0),
                "title_reason": parsed.get("title_reason", []),
                "description": parsed.get("description", ""),
                "youtube_hashtags": clean_yt[:15],
                "instagram_hashtags": clean_ig[:30],
            })
            
            # --- Posting ---
            state.update("posting", parsed.get("posting", {}))
            
            # --- Validation ---
            state.update("validation", parsed.get("validation", {"status": "passed"}))
            
            # --- Dummy passes for UI checkboxes ---
            state.update("video", {"status": "success"})
            state.update("content", {"status": "success"})
            state.update("analytics", {"reasoning": "Aggregated in master pass"})
            
        return state
