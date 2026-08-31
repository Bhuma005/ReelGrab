import logging
import re
from backend.agents.base import BaseAgent, AgentState
from backend.agents.llm import call_ollama

logger = logging.getLogger(__name__)

def backfill_hashtags(existing_tags: list, title: str, description: str, min_count: int = 7) -> list:
    """Ensure at least min_count unique, normalized hashtags grounded in content."""
    normalized = []
    seen = set()
    
    # 1. Normalize existing tags
    for tag in (existing_tags or []):
        cleaned = re.sub(r'[^\w#]', '', str(tag)).strip()
        if not cleaned:
            continue
        if not cleaned.startswith("#"):
            cleaned = "#" + cleaned
        norm = cleaned.lower()
        if norm not in seen and len(cleaned) > 2:
            seen.add(norm)
            normalized.append(cleaned)

    # 2. Extract potential keywords from title & description if needed
    if len(normalized) < min_count:
        combined_text = f"{title} {description}"
        # Extract meaningful alphanumeric words >= 4 chars
        words = re.findall(r'\b[A-Za-z]{4,15}\b', combined_text)
        skip_words = {"this", "that", "with", "from", "video", "about", "watch", "more", "their", "only", "ones", "reel", "post"}
        for word in words:
            if word.lower() not in skip_words:
                tag = f"#{word.capitalize()}"
                norm = tag.lower()
                if norm not in seen:
                    seen.add(norm)
                    normalized.append(tag)
                if len(normalized) >= min_count:
                    break

    # 3. High-intent Shorts discovery tags fallback if still under min_count
    default_discovery_tags = ["#Shorts", "#ShortsFeed", "#Viral", "#Trending", "#ForYou", "#Story", "#Explore", "#MustWatch"]
    for tag in default_discovery_tags:
        norm = tag.lower()
        if norm not in seen:
            seen.add(norm)
            normalized.append(tag)
        if len(normalized) >= min_count:
            break

    return normalized

class MasterAgent(BaseAgent):
    """
    Single-call YouTube Shorts Growth Engine grounded in YouTube's 2026 ranking algorithm.
    Generates exactly ONE high-CTR hook title, ONE search-optimized description,
    and a guaranteed minimum of 7 hashtags in a single fast Ollama call.
    """
    def run(self, state: AgentState) -> AgentState:
        logger.info("MasterAgent generating algorithm-grounded Shorts metadata (single call)...")
        
        raw_title = (state.get("raw_title") or "").strip()
        raw_description = (state.get("raw_description") or "").strip()
        transcript = (state.get("transcript_text") or "").strip()
        comments = state.get("comments") or []
        view_count = state.get("views") or state.get("view_count") or ""
        like_count = state.get("likes") or state.get("like_count") or ""
        
        # 1. Clean boilerplate and Wikipedia-style noise from caption
        cleaned_desc = raw_description
        cleaned_desc = re.split(r'Film Details:|Cast:|Director:|Release Year:|Cinematography:|Music:|Copyright Disclaimer|streaming on', cleaned_desc, flags=re.IGNORECASE)[0]
        cleaned_desc = re.sub(r'#\w+', '', cleaned_desc)
        cleaned_desc = re.sub(r'[\r\n]+', ' ', cleaned_desc).strip()
        
        # Extract dialogue quote or key hook if present in caption
        quote_match = re.search(r'"([^"]{10,120})"', raw_description)
        core_quote = quote_match.group(1).strip() if quote_match else ""
        
        # Grounded context (never fabricated)
        is_generic_title = not raw_title or raw_title.lower().startswith("video by") or raw_title.lower().startswith("reel by") or len(raw_title) < 5
        effective_subject = core_quote or cleaned_desc[:250] or (raw_title if not is_generic_title else "Trending Story")

        system_prompt = (
            "You are an Elite YouTube Shorts Growth Strategist & Copywriter.\n"
            "Your metadata must follow YouTube's ranking & CTR principles:\n"
            "1. TITLE (Single Output): Front-load the hook/keyword in the first 40-50 characters to avoid mobile truncation. Use specific curiosity or emotional relatability (NOT vague hype clickbait). Must be under 60 characters with 1 emoji.\n"
            "2. DESCRIPTION (Single Output): First 1-2 lines must be a natural-language search-friendly summary (indexed for YouTube search), followed by a viewer question to drive comment velocity (retention signal), and a call-to-subscribe.\n"
            "3. HASHTAGS: Provide an array of at least 7 relevant, content-grounded hashtags mixing broad (#Shorts, #ShortsFeed, #Viral) and niche topic tags.\n"
            "4. NEVER invent facts or copy cast credits. Strictly output ONE JSON object with no markdown fences.\n\n"
            "JSON SCHEMA:\n"
            "{\n"
            '  "title": "Front-loaded hook under 60 chars with emoji",\n'
            '  "description": "Natural search summary.\\n\\nQuestion for viewers?\\n\\n👉 Subscribe for more!\\n#Shorts #Tag",\n'
            '  "hashtags": ["#Shorts", "#ShortsFeed", "#Viral", "#Tag4", "#Tag5", "#Tag6", "#Tag7"],\n'
            '  "viewer_appeal_score": 95,\n'
            '  "title_reason": ["Front-loaded mobile hook", "High emotional curiosity"],\n'
            '  "posting": {"scheduled_time": "19:30", "score": 95, "reason": "Peak evening retention window"}\n'
            "}"
        )
        
        context_parts = [
            f"SUBJECT & CONTEXT: {effective_subject}",
            f"RAW CAPTION: {cleaned_desc[:400]}"
        ]
        if core_quote:
            context_parts.append(f"CORE DIALOGUE / QUOTE: \"{core_quote}\"")
        if transcript:
            context_parts.append(f"TRANSCRIPT / SPOKEN AUDIO: {transcript[:250]}")
        if comments:
            context_parts.append(f"TOP AUDIENCE COMMENTS: {', '.join(str(c) for c in comments[:3])}")
        if view_count or like_count:
            context_parts.append(f"METRICS: {view_count} views, {like_count} likes")

        user_prompt = "Generate YouTube Shorts metadata based on this video content:\n" + "\n".join(context_parts)
        
        parsed = call_ollama(
            model="qwen2.5:7b",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_retries=2
        )
        
        ai_failed = False
        if not parsed or (not parsed.get("title") and not parsed.get("best_title")):
            logger.info("Ollama did not return valid schema. Using algorithm-grounded fallback.")
            ai_failed = True
            
            # Grounded fallback title
            if core_quote and len(core_quote) < 55:
                fallback_title = f"{core_quote} 💔"
            elif len(effective_subject) < 50:
                fallback_title = f"{effective_subject} 🔥"
            else:
                fallback_title = f"The Story Behind {effective_subject[:38]}... 🥺"
                
            fallback_desc = f"{cleaned_desc[:180] or effective_subject}...\n\nWhat are your thoughts on this? Let us know below! 👇\n\n👉 Subscribe for daily shorts!\n#Shorts #Viral"
            
            parsed = {
                "title": fallback_title,
                "description": fallback_desc,
                "hashtags": ["#Shorts", "#ShortsFeed", "#Viral", "#Trending", "#Explore", "#Story", "#MustWatch"],
                "viewer_appeal_score": 90,
                "title_reason": ["Front-loaded caption hook", "Clear subject context"],
                "posting": {
                    "scheduled_time": "19:30",
                    "score": 95,
                    "reason": "Standard peak 7:30 PM mobile audience retention slot."
                }
            }

        # Extract single title & description
        final_title = (parsed.get("title") or parsed.get("best_title") or raw_title or "Trending Short").strip()
        final_desc = (parsed.get("description") or parsed.get("optimized_description") or raw_description).strip()
        
        # Ensure at least 7 hashtags guaranteed
        raw_hashtags = parsed.get("hashtags") or parsed.get("youtube_hashtags") or []
        guaranteed_hashtags = backfill_hashtags(raw_hashtags, final_title, cleaned_desc, min_count=7)
        
        posting_data = parsed.get("posting", {
            "scheduled_time": "19:30",
            "score": 95,
            "reason": "Peak evening mobile retention window."
        })
        
        # Update AgentState
        state.update("metadata", {
            "status": "success",
            "best_title": final_title,
            "title_candidates": [{"title": final_title, "strategy": "High-CTR Algorithm Hook", "score": parsed.get("viewer_appeal_score", 95)}],
            "viewer_appeal_score": parsed.get("viewer_appeal_score", 95),
            "title_reason": parsed.get("title_reason", ["Front-loaded mobile hook", "High search & retention alignment"]),
            "description": final_desc,
            "youtube_hashtags": guaranteed_hashtags,
            "instagram_hashtags": guaranteed_hashtags,
            "ai_failed": ai_failed
        })
        
        state.update("posting", posting_data)
        state.update("validation", {"status": "passed"})
        state.update("video", {"status": "success"})
        state.update("content", {"status": "success"})
        state.update("analytics", {"reasoning": "Single-call 2026 YouTube Shorts algorithm optimization complete"})
        
        return state

