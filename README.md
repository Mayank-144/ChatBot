# Mayank AI Fullstack Chatbot (React + Express + MCP Server + Multimodal Vision & Audio)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![MCP](https://img.shields.io/badge/Protocol-MCP%20SDK-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-F55036?logo=fastapi&logoColor=white)](https://groq.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-grade, Fullstack AI Chatbot featuring **Model Context Protocol (MCP)** tool execution, **Custom Client-Server Architecture**, **Multimodal Vision Intelligence**, and **Groq Whisper Audio Transcription**. 

Built with ChatGPT-inspired aesthetics, real-time Server-Sent Events (SSE) streaming, parallel inline typing cursors, multi-format document analysis, image recognition, video frame inspection, and autonomous multi-turn tool calling.

---

## 🏗️ Project Architecture

The repository is organized into a clean, modular structure:

```
ChatBot/
├── client/                      # 🎨 FRONTEND (React 18 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/            # MessageList, MessageItem (with Tool Badges), FileCard, EmptyState
│   │   │   ├── Header/          # Header, Theme Toggle, Clear Chat
│   │   │   ├── Icons/           # Scalable SVG Icon library
│   │   │   └── Input/           # ChatInput, StagedFiles, DragOverlay
│   │   ├── hooks/
│   │   │   ├── useChat.js       # Chat state, typewriter queue & Stop controller
│   │   │   ├── useFileUpload.js # 4-tier attachment picker & drag-and-drop
│   │   │   └── useTheme.js      # Dark/Light theme state
│   │   ├── services/
│   │   │   └── api.js           # API streaming fetcher & SSE reader (Tool events)
│   │   ├── utils/
│   │   │   └── fileParser.js    # Canvas, PDF.js, SheetJS, Mammoth & Whisper parsers
│   │   ├── App.jsx              # Main React Root Component
│   │   ├── App.css              # Custom responsive CSS design system
│   │   └── main.jsx             # React DOM entry point
│   ├── .env                     # Frontend environment configuration
│   ├── vite.config.js           # Vite build & backend proxy config
│   └── package.json             # Frontend dependencies
│
├── server/                      # ⚙️ BACKEND (Node.js + Express API + MCP Client)
│   ├── index.js                 # Express server with /api/chat, MCP tool execution loop, Whisper API
│   ├── .env                     # Server environment configuration & GROQ_API_KEY
│   └── package.json             # Backend dependencies (@modelcontextprotocol/sdk, express, cors)
│
├── mcp-server/                  # 🔌 MODEL CONTEXT PROTOCOL (MCP) SERVER
│   ├── index.js                 # MCP Server with Stdio transport & Tools (get_time, calculator)
│   ├── test-client.js           # Automated client tester for MCP tools
│   ├── package.json             # MCP dependencies (@modelcontextprotocol/sdk, zod)
│   └── README.md                # MCP configuration & inspector guide
│
├── api/                         # ⚡ VERCEL SERVERLESS EDGE FUNCTIONS (Cloud Production)
│   ├── chat.js                  # Edge streaming /api/chat endpoint
│   ├── transcribe.js            # Edge Whisper /api/transcribe endpoint
│   └── health.js                # Edge /api/health endpoint
│
├── vercel.json                  # Vercel deployment configuration
├── package.json                 # Monorepo runner (npm run dev)
└── README.md                    # Project documentation
```

---

## 🛠️ Model Context Protocol (MCP) Integration

The backend implements the official **Model Context Protocol** standard via `@modelcontextprotocol/sdk`:

```
User Prompt ──> Backend (/api/chat) ──> Groq Model (Tools Definition)
                     │                            │
                     │ (Tool Call Requested)       │
                     ▼                            │
             MCP Server (Stdio) ──────────────────┘
             ├─ get_time (Date/Time/Timezone)
             └─ calculator (Arithmetic operations)
                     │
             (Accurate Result)
                     ▼
             Groq Final Stream ──> Frontend UI with "⚡ Tool used: <name>" Badge
```

### Registered MCP Tools:
1. **`get_time`**: Returns real-time system date, time, timestamp, and local timezone.
2. **`calculator`**: Performs arithmetic operations (`add`, `subtract`, `multiply`, `divide`) with division-by-zero protection.

### Visual Tool Badges:
When the model executes an MCP tool to answer a query, the frontend dynamically displays a badge:
- `⚡ Tool used: calculator`
- `⚡ Tool used: get_time`

---

## ✨ Key Features

### 1. 🖼️ Multimodal Intelligence & Media Support
* 📸 **Photos & Images**: Direct visual analysis of `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.svg` using `qwen/qwen3.8-27b` Vision AI.
* 🎥 **Videos**: Automatically extracts key visual frames and metadata from `.mp4`, `.webm`, `.mov`, `.mkv`, `.avi` for AI scene analysis.
* 🎵 **Audios**: Automatically transcribes spoken voice & audio from `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac` using **Groq Whisper Large V3 Turbo**.
* 📄 **Documents & Files**: Client-side parsing of **PDF** (`pdfjs-dist`), **Excel** (`xlsx`), **Word** (`mammoth`), **CSV**, **JSON**, **Markdown**, and **Code** files.

### 2. 💬 ChatGPT-Style User Experience
* ➕ **4-Tier Attach Dropdown**: Clean separate buttons for **Photos**, **Videos**, **Audios**, and **Files**.
* ⏹ **Combined Send / Stop Button**: Seamlessly toggle between `Send ↵` and `⏹ Stop` with instant request cancellation via `AbortController`.
* 🟢 **Parallel Inline Streaming Cursor**: Blinking typewriter cursor tracks directly at the tip of the last character in real time.
* 🌓 **Dark & Light Mode**: Instant smooth theme switching.
* 📋 **One-Click Markdown Copy**: Instant copy with visual checkmark feedback.

---

## 🔗 Backend Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check & active model status |
| `/api/chat` | `POST` | Chat completions with MCP tool execution & SSE streaming |
| `/api/transcribe` | `POST` | Whisper speech-to-text audio transcription |
| `/api/mcp/tools` | `GET` | Returns list of connected MCP tools |
| `/api/mcp/time` | `GET` | Direct test endpoint for `get_time` tool |
| `/api/mcp/calculate` | `GET` | Direct test endpoint for `calculator` tool (`?a=25&b=4&op=multiply`) |

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
npm start
```

**Frontend Client (Port 5173):**
```bash
cd client
npm install
npm run dev
```

**Test MCP Server Interactively in Browser:**
```bash
cd mcp-server
npx @modelcontextprotocol/inspector node index.js
```

Open your browser at `http://localhost:5173` to start chatting!

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
