# Known Bugs & Defect Log

This document tracks identified bugs, unhandled exceptions, edge cases, hardcoded debug values, and broken logic within the **ReelGrab** project.

| ID | Severity | File & Line | Description | Suggested Fix | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| BUG-001 | High | [main.py:16](file:///d:/Workspace/Madhu/backend/main.py#L16) | Hardcoded YouTube API key `AIzaSyDhb0SP...` exposed directly in source code. | Move `YOUTUBE_API_KEY` to environment variables (`os.getenv`) and handle empty state gracefully. | Open |
| BUG-002 | Medium | [main.py:98-104](file:///d:/Workspace/Madhu/backend/main.py#L98-L104) | Synchronous network fetch `urllib.request.urlopen` blocks event loop during format resolution. | Replace synchronous `urllib.request` calls with `httpx` async client calls. | Open |
| BUG-003 | Medium | [main.py:310](file:///d:/Workspace/Madhu/backend/main.py#L310) | Unhandled `urllib.error.HTTPError` / connection timeouts when downloading thumbnails. | Wrap thumbnail retrieval in explicit exception handlers returning 404 or standard HTTP error. | Open |
| BUG-004 | Low | [script.js:80-89](file:///d:/Workspace/Madhu/frontend/script.js#L80-L89) | Auth status check swallows errors silently with `console.error` without updating UI indicator. | Add visual error state on auth banner when status check fails or backend is unreachable. | Open |
| BUG-005 | Medium | [automate.py:97-102](file:///d:/Workspace/Madhu/backend/automate.py#L97-L102) | Bare `except Exception as e` in schedule calculation silently defaults to `now + 2h` without logging error trace. | Log exact exception trace for time parsing failures before applying fallback schedule window. | Open |
| BUG-006 | Low | [script.js:378](file:///d:/Workspace/Madhu/frontend/script.js#L378) | Time string parsing fallback displays raw string on parsing errors without warning user. | Validate date format before rendering and show fallback tag indicator in UI. | Open |
| BUG-007 | Medium | [cloud_auth.py:42](file:///d:/Workspace/Madhu/cloud/cloud_auth.py#L42) | Missing environment variable throws raw `ValueError` crashing requests rather than returning HTTP 500 error response. | Handle missing credentials inside FastAPI middleware/exception handlers with friendly message. | Open |

