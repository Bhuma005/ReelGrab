import json
import re
import urllib.request
import logging

logger = logging.getLogger(__name__)

def get_optimal_model() -> str:
    """Select the fastest high-quality local model to avoid 5-minute CPU stalls."""
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as res:
            data = json.loads(res.read())
            models = [m.get("name", "") for m in data.get("models", [])]
            for pref in ["qwen2:0.5b", "qwen2.5:3b", "llama3.2:3b", "qwen2.5:7b"]:
                if pref in models:
                    return pref
            if models:
                return models[0]
    except Exception as e:
        logger.debug(f"Could not query Ollama tags: {e}")
    return "qwen2:0.5b"

def call_ollama(model: str = None, system_prompt: str = "", user_prompt: str = "", temperature: float = 0.7, max_retries: int = 1) -> dict:
    """Call Ollama with lean token budget and strict 14s timeout for instant UX."""
    if not model:
        model = get_optimal_model()

    timeout = 14.0

    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 220,
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
