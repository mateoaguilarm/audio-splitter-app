# Audio Splitter

A full-stack web app that splits audio files (MP3, WAV, M4A, OGG) into equal-length segments using FFmpeg.

## Stack

| Layer    | Tech                        |
|----------|-----------------------------|
| Backend  | Node.js + Express.js        |
| Frontend | React + Vite + Tailwind CSS |
| Audio    | FFmpeg via fluent-ffmpeg     |
| Deploy   | Netlify (frontend) + Railway / Render (backend) |

---

## Prerequisites

- **Node.js 18+**
- **FFmpeg** installed and in your `$PATH`

### Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

Verify: `ffmpeg -version`

---

## Local Development

### 1. Clone & install

```bash
git clone https://github.com/<you>/audio-splitter-app.git
cd audio-splitter-app
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # edit if needed
npm install
npm run dev            # starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL if backend is not on :5000
npm install
npm run dev            # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## API Reference

### `POST /api/split`

Split an audio file into segments.

| Field             | Type   | Description                        |
|-------------------|--------|------------------------------------|
| `audio`           | File   | Audio file (multipart/form-data)   |
| `segmentDuration` | number | Segment length **in minutes** (1–120) |

**Response**

```json
{
  "success": true,
  "jobId": "1720000000000-123456789",
  "totalSegments": 3,
  "segments": [
    {
      "index": 1,
      "filename": "parte_1.mp3",
      "downloadUrl": "http://localhost:5000/api/download/<jobId>/parte_1.mp3",
      "size": 4194304
    }
  ]
}
```

### `GET /api/download/:jobId/:filename`

Download a specific segment. Files expire after **1 hour**.

---

## Deployment

### Frontend → Netlify

1. Push to GitHub.
2. In Netlify: **New site → Import from Git**.
3. Set build settings (auto-detected from `netlify.toml`).
4. Add environment variable `VITE_API_URL` pointing to your backend.
5. Add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as GitHub Actions secrets for CI/CD.

### Backend → Railway / Render

1. Create a new Node.js service.
2. Set root to `backend/`.
3. Start command: `npm start`.
4. Set environment variables from `.env.example`.
5. Ensure FFmpeg is available (Railway and Render include it by default on Linux).

---

## Project Structure

```
audio-splitter-app/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/audio.js
│   │   └── utils/audioProcessor.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── Upload.jsx
│   │   │   ├── Controls.jsx
│   │   │   ├── Preview.jsx
│   │   │   ├── Progress.jsx
│   │   │   └── Results.jsx
│   │   └── styles/index.css
│   ├── .env.example
│   └── package.json
├── .github/workflows/deploy.yml
├── netlify.toml
└── README.md
```
