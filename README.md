# Mayank AI Fullstack Chatbot (React + Node.js Express + Multimodal Vision & Audio)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-F55036?logo=fastapi&logoColor=white)](https://groq.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, production-grade Fullstack AI Chatbot featuring a **Custom Client-Server Architecture**, **Multimodal Vision Intelligence**, and **Groq Whisper Audio Transcription**. 

Built with ChatGPT-inspired aesthetics, smooth real-time Server-Sent Events (SSE) streaming, typewriter animations with parallel inline cursor tracking, and support for multi-format document analysis, image recognition, video frame inspection, and voice transcription.

---

## 🏗️ Project Architecture

The repository is organized into a clean monorepo with dedicated frontend, backend, and serverless edge layers:

```
ChatBot/
├── client/                      # 🎨 FRONTEND WORKSPACE (React 18 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/            # MessageList, MessageItem, FileCard, EmptyState
│   │   │   ├── Header/          # Header, Theme Toggle, Clear Chat
│   │   │   ├── Icons/           # Scalable SVG Icon library
│   │   │   └── Input/           # ChatInput, StagedFiles, DragOverlay
│   │   ├── hooks/
│   │   │   ├── useChat.js       # Chat state, typewriter queue & Stop controller
│   │   │   ├── useFileUpload.js # 4-tier attachment picker & drag-and-drop
│   │   │   └── useTheme.js      # Dark/Light theme state
│   │   ├── services/
│   │   │   └── api.js           # API streaming fetcher & SSE reader
│   │   ├── utils/
│   │   │   └── fileParser.js    # Canvas, PDF.js, SheetJS, Mammoth & Whisper parsers
│   │   ├── App.jsx              # Main React Root Component
│   │   ├── App.css              # Custom responsive CSS design system
│   │   └── main.jsx             # React DOM entry point
│   ├── .env                     # Frontend environment configuration
│   ├── vite.config.js           # Vite build & backend proxy config
│   └── package.json             # Frontend dependencies
│
├── server/                      # ⚙️ BACKEND WORKSPACE (Node.js + Express API)
│   ├── index.js                 # Express server with /api/chat, /api/transcribe, /api/health
│   ├── .env                     # Server environment configuration & GROQ_API_KEY
│   └── package.json             # Backend dependencies
│
├── api/                         # ⚡ VERCEL SERVERLESS EDGE FUNCTIONS (Production)
│   ├── chat.js                  # Edge streaming /api/chat endpoint
│   ├── transcribe.js            # Edge Whisper /api/transcribe endpoint
│   └── health.js                # Edge /api/health endpoint
│
├── vercel.json                  # Vercel deployment configuration
├── package.json                 # Monorepo runner (npm run dev)
├── .gitignore                   # Ignored files (node_modules, .env)
└── README.md                    # Project documentation
```

---

## ✨ Key Features

### 1. 🖼️ Multimodal Intelligence & Media Support
* 📸 **Photos & Images**: Direct visual analysis of `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.svg` using `qwen/qwen3.8-27b` Vision AI.
* 🎥 **Videos**: Automatically extracts key visual frames and metadata from `.mp4`, `.webm`, `.mov`, `.mkv`, `.avi` for AI scene analysis.
* 🎵 **Audios**: Automatically transcribes spoken voice & audio from `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac` using **Groq Whisper Large V3 Turbo**.
* 📄 **Documents & Files**: Client-side parsing of **PDF** (`pdfjs-dist`), **Excel** (`xlsx`), **Word** (`mammoth`), **CSV**, **JSON**, **Markdown**, and **Code** files.

### 2. 💬 ChatGPT-Style User Experience
* ➕ **4-Tier Attach Dropdown**: Clean separate buttons for **Photos**, **Videos**, **Audios**, and **Files** (no confusing slashes/obliques).
* ⏹ **Combined Send / Stop Button**: Seamlessly toggle between `Send ↵` and `⏹ Stop` with instant request cancellation via `AbortController`.
* 🟢 **Parallel Inline Streaming Cursor**: Blinking typewriter cursor tracks directly at the tip of the last character in real time.
* 🌓 **Dark & Light Mode**: Instant smooth theme switching.
* 📋 **One-Click Markdown Copy**: Instant copy with visual checkmark feedback.

---

## 🔗 Custom Backend Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check & active model status |
| `/api/chat` | `POST` | Chat completions with real-time SSE streaming & Vision routing |
| `/api/transcribe` | `POST` | Whisper speech-to-text audio transcription |

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher recommended)
* A free [Groq Cloud API Key](https://console.groq.com/keys)

### 1. Configure Environment Variables
Create a `.env` file in the `server/` directory:
```env
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
```

Create a `.env` file in the `client/` directory:
```env
VITE_BACKEND_API_URL=http://localhost:5000/api/chat
```

### 2. Run Locally

#### Option A: Run Both Frontend & Backend (Single Command)
From the root directory:
```bash
npm run dev
```

#### Option B: Run Individually

**Backend Server (Port 5000):**
```bash
cd server
npm install
npm run dev
```

**Frontend Client (Port 5173):**
```bash
cd client
npm install
npm run dev
```

Open your browser at `http://localhost:5173` to start chatting!

---

## ☁️ Deployment (Vercel)

1. Push your repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Add `GROQ_API_KEY` to **Project Settings → Environment Variables**.
4. Click **Deploy**. Vercel will automatically configure the edge functions in `/api` and host the frontend.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
