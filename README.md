# ReelGrab

A personal Instagram reel downloader that runs on localhost only, for personal use.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
2. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Run the backend server:
   ```bash
   uvicorn backend.main:app --reload
   ```
5. Open `frontend/index.html` in your web browser.
