"""
ai_pipeline.py
Professional YouTube Shorts content generation pipeline.
Implements the full spec: model selection, system prompt, temperature,
retry/validation logic, and structured JSON output.
"""

import json
import re
import urllib.request
from typing import Optional

# ── Model selection ─────────────────────────────────────────────────────────
# Uses the best available model; falls back down the list.
PREFERRED_MODELS = ["qwen2.5:7b", "qwen2.5:3b", "llama3.2:3b", "mistral:7b", "qwen2:0.5b"]

def _get_best_model() -> str:
    """Return the best available Ollama model from PREFERRED_MODELS."""
    try:
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read())
            available = {m["name"] for m in data.get("models", [])}
            for model in PREFERRED_MODELS:
                if model in available:
                    return model
    except Exception:
        pass
    return "qwen2:0.5b"   # absolute fallback

# ── System prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a YouTube Shorts growth strategist and copywriter specializing in high-retention, high-CTR content. You analyze video metadata and produce a title, description, hashtags, and optimal posting time engineered to maximize views, watch time, and shares — without resorting to misleading clickbait that hurts retention.

RULES FOR title:
- 40–60 characters ideal (hard cap 100). Shorts titles get cut off on mobile — front-load the hook.
- Use ONE proven pattern matched to detected_genre:
  * Curiosity gap: "The reason nobody saw this coming"
  * Payoff tease: "Wait for the ending"
  * Specific stat: "3 seconds that changed everything"
  * Direct benefit: "How to X in under a minute"
- Do NOT use ALL CAPS words, more than one emoji, or more than one exclamation mark.
- Do NOT promise something the video does not deliver.
- If detected_language is not English, write the title in that language optimized for native viewers.

RULES FOR description:
- First line is the most important — it shows in feed/search before "more". Make it a hook.
- 2–4 short sentences total. Plain, conversational, no corporate tone.
- No false urgency, no ALL CAPS.

RULES FOR hashtags:
- 3–5 tags: mix of broad (#Shorts, #Drama) and niche-specific (#KDrama, #NightHasCome).
- Return as JSON array of strings starting with #.

RULES FOR optimal_schedule_time:
- Base on detected_genre + target_audience_region.
- Evening commute 6–9 PM local, lunch 12–1 PM, late-night 9–11 PM are strongest.
- Comedy/entertainment skews evening; tutorial/how-to skews morning/lunch.
- Return in 12-hour local time format (e.g. "7:30 PM").

OUTPUT: Return ONLY a single valid JSON object — no preamble, no markdown fences, no explanation:
{
  "title": "",
  "description": "",
  "hashtags": ["", ""],
  "optimal_schedule_time": "",
  "schedule_reasoning": "",
  "confidence_notes": ""
}"""

# Lightweight prompt for small (sub-1B) models where the full system prompt is too heavy
SYSTEM_PROMPT_LITE = """You are a YouTube Shorts copywriter. Given video info, output ONE JSON object only.
RULES: title under 60 chars, 2-sentence description, 5 hashtags mix broad+niche, optimal post time for India.
OUTPUT FORMAT (strict JSON only, no extra text):
{"title":"","description":"","hashtags":[""],"optimal_schedule_time":"","schedule_reasoning":"","confidence_notes":""}"""

# ── Validation helpers ───────────────────────────────────────────────────────
def _count_emojis(text: str) -> int:
    emoji_pattern = re.compile(
        r'[\U00010000-\U0010ffff'
        r'\U0001F600-\U0001F64F'
        r'\U0001F300-\U0001F5FF'
        r'\U0001F680-\U0001F9FF'
        r'\u2600-\u26FF\u2700-\u27BF]',
        flags=re.UNICODE
    )
    return len(emoji_pattern.findall(text))

def _validate_and_fix(parsed: dict, fallback_title: str) -> dict:
    """Enforce hard rules on the model output."""
    title = parsed.get("title", "").strip()

    # Strip parenthetical garbage
    title = re.sub(r'\(.*?\)', '', title).strip()
    # Remove jargon phrases
    for bad in ["YouTube Shorts", "Maximal Replays", "Share Drives",
                "Short Title:", "Output JSON", "Massive Views on"]:
        title = title.replace(bad, "").strip(" :–-")
    # Enforce hard cap
    if len(title) > 100:
        title = title[:97].rsplit(' ', 1)[0].rstrip(" :–-") + "…"
    # Enforce single emoji
    if _count_emojis(title) > 1:
        # Strip all emojis if there are too many
        title = re.sub(
            r'[\U00010000-\U0010ffff\U0001F600-\U0001F64F'
            r'\U0001F300-\U0001F5FF\U0001F680-\U0001F9FF'
            r'\u2600-\u26FF\u2700-\u27BF]', '', title).strip()
    # Fallback if still empty
    if not title:
        title = fallback_title[:97]

    parsed["title"] = title

    # Ensure hashtags are a list
    if not isinstance(parsed.get("hashtags"), list):
        parsed["hashtags"] = ["#Shorts", "#Viral"]

    return parsed

def _call_ollama(model: str, user_prompt: str, temperature: float = 0.8, max_retries: int = 2) -> dict:
    """Call Ollama with retry + strict JSON validation."""
    # Use lighter system prompt for tiny models
    system = SYSTEM_PROMPT_LITE if "0.5b" in model else SYSTEM_PROMPT
    timeout = 90.0 if "0.5b" in model else 120.0

    payload = {
        "model": model,
        "system": system,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 400 if "0.5b" in model else 512,
        }
    }

    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                "http://localhost:11434/api/generate",
                data=json.dumps(payload).encode("utf-8"),
                method="POST",
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as res:
                result = json.loads(res.read())
                raw = result.get("response", "{}")
                # Strip any accidental markdown fences
                raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
                raw = re.sub(r"\n?```$", "", raw.strip())
                return json.loads(raw)
        except json.JSONDecodeError as e:
            last_err = e
            payload["prompt"] = user_prompt + "\n\nIMPORTANT: Return ONLY valid JSON, nothing else."
        except Exception as e:
            last_err = e
            break

    print(f"Ollama call failed after {max_retries} attempts: {last_err}")
    return {}

# ── Public API ───────────────────────────────────────────────────────────────
def generate_shorts_content(
    video_title: str,
    video_description: str,
    hashtags: Optional[list] = None,
    duration_seconds: Optional[int] = None,
    transcript: Optional[str] = None,
    detected_genre: Optional[str] = None,
    detected_language: Optional[str] = "English",
    key_moments: Optional[str] = None,
    channel_niche: Optional[str] = None,
    target_region: Optional[str] = "India",
    temperature: float = 0.8,
) -> dict:
    """
    Full pipeline: select model → build prompt → call Ollama → validate → return.
    Returns a dict with: title, description, hashtags, optimal_schedule_time,
    schedule_reasoning, confidence_notes.
    """
    model = _get_best_model()
    print(f"[AI Pipeline] Using model: {model}")

    # Auto-detect genre from title/description if not provided
    if not detected_genre:
        combined = (video_title + " " + video_description).lower()
        if any(w in combined for w in ["thriller", "survival", "game", "mystery", "dark"]):
            detected_genre = "thriller"
        elif any(w in combined for w in ["romance", "love", "heart", "crush", "dating"]):
            detected_genre = "romance"
        elif any(w in combined for w in ["comedy", "funny", "laugh", "humor", "prank"]):
            detected_genre = "comedy"
        elif any(w in combined for w in ["tutorial", "how to", "learn", "tips", "guide"]):
            detected_genre = "tutorial"
        else:
            detected_genre = "drama"

    # Detect language from description
    if not detected_language:
        detected_language = "English"

    user_prompt = f"""video_duration_seconds: {duration_seconds or 'unknown'}
transcript_or_captions: {(transcript or video_description or '')[:600]}
detected_genre: {detected_genre}
detected_language: {detected_language}
key_moments: {key_moments or 'not available'}
channel_niche: {channel_niche or 'entertainment / drama'}
target_audience_region: {target_region}

Additional context:
Original video title: {video_title}
Original hashtags: {', '.join(hashtags or [])}

Generate the JSON output now."""

    fallback_title = video_title[:97] if video_title else "Watch This Short"
    parsed = _call_ollama(model, user_prompt, temperature)
    parsed = _validate_and_fix(parsed, fallback_title)

    # Guaranteed fallbacks for missing fields
    if not parsed.get("title"):
        parsed["title"] = fallback_title
    if not parsed.get("description"):
        parsed["description"] = (
            f"{video_description[:150].strip()}. "
            "Subscribe for more content like this."
        )
    if not parsed.get("optimal_schedule_time"):
        parsed["optimal_schedule_time"] = "07:00 PM"
    if not parsed.get("schedule_reasoning"):
        parsed["schedule_reasoning"] = "Evening hours (6–9 PM) show peak Shorts engagement."
    if not isinstance(parsed.get("hashtags"), list) or not parsed["hashtags"]:
        parsed["hashtags"] = ["#Shorts", "#Viral", "#Trending"]
    if not parsed.get("confidence_notes"):
        parsed["confidence_notes"] = f"Generated by {model}."
    else:
        # Always ensure model name is in the notes
        if model not in parsed["confidence_notes"]:
            parsed["confidence_notes"] = f"Generated by {model}. " + parsed["confidence_notes"]

    return parsed
