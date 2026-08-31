import json
import re
import urllib.request
import logging

logger = logging.getLogger(__name__)

def get_optimal_model() -> str:
    """Return user's chosen high-intelligence model."""
    return "qwen2.5:7b"

def call_ollama(model: str = None, system_prompt: str = "", user_prompt: str = "", temperature: float = 0.7, max_retries: int = 1) -> dict:
    """Call Qwen 2.5 7B with lean 140-token budget for fast high-quality CPU inference."""
    if not model:
        model = "qwen2.5:7b"

    timeout = 60.0

    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 220,
            "num_thread": 8,
        }
    }

    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/generate",
                data=json.dumps(payload).encode("utf-8"),
                method="POST",
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as res:
                result = json.loads(res.read())
                raw = result.get("response", "{}")
                raw = re.sub(r"^```[a-z]*\n?", "", raw.strip())
                raw = re.sub(r"\n?```$", "", raw.strip())
                return json.loads(raw)
        except json.JSONDecodeError as e:
            last_err = e
        except Exception as e:
            last_err = e
            break

    logger.warning(f"Fast Ollama call ({model}) finished with: {last_err}")
    return {}
