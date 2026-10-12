# Mayank AI Fullstack Chatbot (LangChain + DeepAgents + React 18 + Express + MCP Server)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![LangChain](https://img.shields.io/badge/Agent-LangChain%20%26%20DeepAgents-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![MCP](https://img.shields.io/badge/Protocol-MCP%20SDK-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-F55036?logo=fastapi&logoColor=white)](https://groq.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Overview:** An enterprise-ready, autonomous fullstack AI ChatBot combining React 18, Express, LangChain ReAct & DeepAgents, and Model Context Protocol (MCP). Features autonomous planning (`write_todos`), specialist subagents (`task`), real-time SSE streaming, live execution checklists, multimodal vision, and Whisper audio transcription.

---

## 🏗️ Project Architecture

```
ChatBot/
├── frontend/                          # 🎨 FRONTEND (React 18 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/                  # MessageList, MessageItem, LiveTodoProgress, FileCard, EmptyState
│   │   │   ├── Header/                # Header, Theme Toggle, Clear Conversation
│   │   │   ├── Icons/                 # High-performance SVG Icon components
│   │   │   └── Input/                 # ChatInput, StagedFiles, DragOverlay
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Chat state, typewriter queue & AbortController
│   │   │   ├── useFileUpload.js       # 4-tier attachment picker & drag-and-drop
│   │   │   ├── useTheme.js            # Dark/Light theme state with localStorage persistence
│   │   │   └── index.js               # Barrel export for custom hooks
│   │   ├── services/
│   │   │   └── api.js                 # Unified SSE streaming fetcher (Todos, Subagents, Tools)
│   │   ├── utils/
│   │   │   └── fileParser.js          # In-browser parsers (PDF.js, SheetJS, Mammoth, Canvas)
│   │   ├── App.jsx                    # Root React Application component
│   │   ├── App.css                    # Glassmorphism CSS design system & micro-animations
│   │   └── main.jsx                   # Vite React DOM mount point
│   ├── .env.example                   # Client environment variables template
│   ├── vite.config.js                 # Vite dev proxy configuration (/api -> :5000)
│   └── package.json                   # Frontend dependencies
│
├── backend/                           # ⚙️ BACKEND (Node.js + Express API + LangChain + MCP Client)
│   ├── agent/                         # 🤖 Multi-Tier Agent Core
│   │   ├── index.js                   # Classic ReAct Agent runner & model factory
│   │   ├── deepAgent.js               # LangChain DeepAgent runner (Planning, Subagents, StateBackend)
│   │   ├── router.js                  # Deterministic Query Router (Simple vs Complex)
│   │   └── memory.js                  # Windowed In-Memory Session Storage
│   ├── tools/                         # 🛠️ LangChain Agent Tools
│   │   ├── weatherTool.js             # Live OpenWeatherMap API tool
│   │   ├── wikiTool.js                # Wikipedia REST API knowledge lookup
│   │   ├── calculatorTool.js          # High-precision MCP Calculator wrapper
│   │   ├── timeTool.js                # High-precision MCP Real-Time Clock wrapper
│   │   └── index.js                   # Barrel export for all active agent tools
│   ├── index.js                       # Express Server, SSE Streamer & MCP Client manager
│   ├── .env.example                   # Server environment variables template
│   └── package.json                   # Backend dependencies
│
├── mcp-server/                        # 🔌 MODEL CONTEXT PROTOCOL (MCP) SERVER
│   ├── index.js                       # MCP Server with Stdio transport (get_time, calculator)
│   ├── test-client.js                 # Standalone tester for MCP tool verification
│   ├── package.json                   # MCP dependencies (@modelcontextprotocol/sdk, zod)
│   └── README.md                      # MCP configuration and architecture guide
│
├── api/                               # ⚡ VERCEL SERVERLESS EDGE RUNTIME (Cloud Deployment)
│   ├── chat.js                        # Edge streaming chat endpoint with direct tool execution
│   ├── transcribe.js                  # Edge Whisper audio transcription endpoint
│   └── health.js                      # Edge health check endpoint
│
├── vercel.json                        # Vercel deployment configuration
├── package.json                       # Root runner (concurrently fullstack dev script)
└── README.md                          # Repository documentation
```

---

## 🔀 Intelligent Multi-Tier Agent Execution

```
                       User Prompt
                            │
                            ▼
                    POST /api/chat
                            │
                            ▼
              backend/agent/router.js
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    [Simple / Direct Query]        [Complex / Multi-Step Task]
            │                               │
    Classic ReAct Agent            LangChain DeepAgent
  (backend/agent/index.js)       (backend/agent/deepAgent.js)
            │                               │
            │                  ┌────────────┴────────────┐
            │                  ▼                         ▼
            │            write_todos                 task tool
            │         (Dynamic Checklist)       (Specialist Subagents)
            │                                            │
            │                                 ┌──────────┴──────────┐
            │                                 ▼                     ▼
            │                          research-agent        math-time-agent
            │                         (Wiki + Weather)     (Calculator + Clock)
            │                                 │                     │
            └─────────────────┬───────────────┴─────────────────────┘
                              ▼
                Server-Sent Events (SSE) Stream
              (Data: Tokens, Todos, Subagents, Badges)
                              ▼
                 Frontend Live Progress UI
```

---

## 🛠️ Autonomous Tools & Protocol Integrations

| Tool Name | Engine / Transport | Domain | Capability |
| :--- | :--- | :--- | :--- |
| `get_weather` | OpenWeatherMap REST API | Weather & Climate | Live temperatures, humidity, wind speed, condition |
| `wikipedia_search` | Wikipedia REST API | Encyclopedia Knowledge | Biographies, scientific principles, historical events |
| `calculator` | MCP (Stdio Client) | Precision Math | High-precision arithmetic (Add, Subtract, Multiply, Divide) |
| `get_time` | MCP (Stdio Client) | Real-time Clock | Exact timestamps, current local time and timezone |
| `write_todos` | DeepAgents Core | Task Planning | Dynamic checklist creation, progress tracking |
| `task` | DeepAgents Subagents | Delegation | Isolated domain execution with specialist subagents |

---

## ✨ Core Features & Highlights

### 1. 🧠 Dynamic Planning & Live Checklists
- Breaks down complex, multi-domain prompts into clear, trackable step-by-step goals with `write_todos`.
- Streams progress in real-time to the frontend (`LiveTodoProgress.jsx`) with animated indicators.

### 2. 🤖 Isolated Specialist Subagents
- **Research Agent**: Dedicated to Wikipedia factual analysis and weather reports.
- **Math & Time Agent**: Dedicated to numeric computations and real-time clock retrieval.
- Subagent internal tokens are filtered out from the main coordinator output, streaming only the final synthesised response to the user.

### 3. 🔌 Official Model Context Protocol (MCP) Integration
- Direct integration using `@modelcontextprotocol/sdk` via Stdio transport.
- Decouples tool execution from the backend application for zero-hallucination math and clock data.

### 4. 🖼️ Multimodal Vision & Audio
- 📸 **Vision AI**: Analyzes photos, diagrams, and screenshots via `qwen/qwen3.8-27b`.
- 🎙️ **Audio Transcription**: In-browser recording and audio file parsing via **Groq Whisper Large V3 Turbo**.
- 📄 **Document Extraction**: In-browser client-side parsing for **PDF**, **Excel**, **Word**, **CSV**, **JSON**, and **Code** files.

### 5. 🛡️ Robust Error Recovery & Resilience
- Gracefully handles Groq 429 rate limits with exponential backoff and retry.
- Automatic fallback from DeepAgent to classic ReAct agent if unexpected formatting issues occur.

---

## 🔗 Backend Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health status, active models, DeepAgent status, and tool list |
| `/api/chat` | `POST` | Primary SSE chat completions stream with multi-tier routing |
| `/api/transcribe` | `POST` | Whisper speech-to-text audio transcription |
| `/api/memory/clear` | `POST` | Clear conversation memory for a session ID |
| `/api/mcp/tools` | `GET` | Inspect connected Model Context Protocol tools |
| `/api/mcp/time` | `GET` | Direct test endpoint for MCP `get_time` |
| `/api/mcp/calculate`| `GET` | Direct test endpoint for MCP `calculator` |

---

## 🚀 Getting Started

### 1. Environment Setup
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
OPENWEATHER_API_KEY=your_openweather_api_key_here
USE_DEEP_AGENT=true
```

### 2. Run Locally (Single Command)
From the root directory:
```bash
npm run dev
```

* **Frontend Client**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5000](http://localhost:5000)
* **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 3. Individual Service Commands
- **Backend Only**: `npm run backend`
- **Frontend Only**: `npm run frontend`
- **MCP Test Client**: `node mcp-server/test-client.js`
- **Build Frontend Bundle**: `npm run build`

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
