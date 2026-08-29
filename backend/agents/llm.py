import json
import re
import urllib.request
import logging

logger = logging.getLogger(__name__)

def call_ollama(model: str, system_prompt: str, user_prompt: str, temperature: float = 0.8, max_retries: int = 2) -> dict:
    """Call Ollama with retry + strict JSON validation for Agent usage."""
    timeout = 90.0 if "0.5b" in model else 300.0

    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 400 if "0.5b" in model else 1024,
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

    logger.error(f"Agent Ollama call failed after {max_retries} attempts: {last_err}")
    return {}
