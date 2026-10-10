# Mayank AI Fullstack Chatbot (LangChain + React + Express + MCP Server + Multimodal Vision & Audio)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![LangChain](https://img.shields.io/badge/Agent-LangChain-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![MCP](https://img.shields.io/badge/Protocol-MCP%20SDK-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-F55036?logo=fastapi&logoColor=white)](https://groq.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Overview:** An autonomous full-stack AI ChatBot built with React 18, Express, LangChain ReAct Agents, and Model Context Protocol (MCP). Features real-time autonomous tool execution (Live Weather, Wikipedia, MCP Calculator & Clock), Multimodal Vision, and Groq Whisper audio transcription.

---

## 🏗️ Project Architecture

```
ChatBot/
├── frontend/                     # 🎨 FRONTEND (React 18 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/             # MessageList, MessageItem (Tool Badges), FileCard, EmptyState
│   │   │   ├── Header/           # Header, Theme Toggle, Clear Chat
│   │   │   ├── Icons/            # Scalable SVG Icon library
│   │   │   └── Input/            # ChatInput, StagedFiles, DragOverlay
│   │   ├── hooks/
│   │   │   ├── useChat.js        # Chat state, typewriter queue & Stop controller
│   │   │   ├── useFileUpload.js  # 4-tier attachment picker & drag-and-drop
│   │   │   └── useTheme.js       # Dark/Light theme state
│   │   ├── services/
│   │   │   └── api.js            # API streaming fetcher & SSE reader (Tool events)
│   │   ├── utils/
│   │   │   └── fileParser.js     # Canvas, PDF.js, SheetJS, Mammoth & Whisper parsers
│   │   ├── App.jsx               # Main React Root Component
│   │   ├── App.css               # Modern glassmorphism CSS design system
│   │   └── main.jsx              # React DOM entry point
│   ├── .env.example              # Frontend environment example
│   ├── vite.config.js            # Vite build & backend proxy config (/api -> :5000)
│   └── package.json              # Frontend dependencies
│
├── backend/                      # ⚙️ BACKEND (Node.js + Express API + LangChain + MCP Client)
│   ├── agent/                    # 🤖 LangChain Agent Core
│   │   ├── index.js              # ReAct Agent runner with Groq LLM & event streaming
│   │   └── memory.js             # Windowed Session Memory (ConversationBufferMemory)
│   ├── tools/                    # 🛠️ LangChain Agent Tools
│   │   ├── weatherTool.js        # Live OpenWeatherMap API tool
│   │   ├── wikiTool.js           # Wikipedia REST API knowledge search
│   │   ├── calculatorTool.js     # High-precision MCP Calculator wrapper
│   │   ├── timeTool.js           # MCP Real-time Clock wrapper
│   │   └── index.js              # Barrel export for all active agent tools
│   ├── index.js                  # Main Express Server & SSE streaming router
│   ├── .env.example              # Server environment template
│   └── package.json              # Backend dependencies
│
├── mcp-server/                   # 🔌 MODEL CONTEXT PROTOCOL (MCP) SERVER
│   ├── index.js                  # MCP Server with Stdio transport (get_time, calculator)
│   ├── test-client.js            # Automated client tester for MCP tools
│   ├── package.json              # MCP dependencies (@modelcontextprotocol/sdk, zod)
│   └── README.md                 # MCP configuration guide
│
├── api/                          # ⚡ VERCEL SERVERLESS EDGE FUNCTIONS (Cloud Production)
│   ├── chat.js                   # Edge streaming /api/chat with tool execution
│   ├── transcribe.js             # Edge Whisper /api/transcribe endpoint
│   └── health.js                 # Edge /api/health endpoint
│
├── vercel.json                   # Vercel deployment configuration
├── package.json                  # Root runner (concurrently dev runner)
└── README.md                     # Project documentation
```

---

## 🛠️ Autonomous Tools & Agent Execution

```
User Prompt ──> Backend (/api/chat) ──> LangChain ReAct Agent (Groq LLM)
                     │
                     ├─ 🌤️ get_weather       ──> OpenWeatherMap API (Live Temp, Humidity, Wind)
                     ├─ 📚 wikipedia_search  ──> Wikipedia REST API (Factual Knowledge)
                     ├─ 🧮 calculator        ──> Stdio Transport ──> MCP Server (Exact Math)
                     ├─ 🕒 get_time          ──> Stdio Transport ──> MCP Server (Real-Time Clock)
                     └─ 📄 search_documents  ──> Cohere Embeddings + MongoDB Atlas Vector Search (RAG)
                     │
                     ▼
          Server-Sent Events (SSE) Streaming
                     │
                     ▼
          Frontend UI with Interactive Glassmorphic Badges
          [🌤️ Live Weather] [📚 Wikipedia] [🧮 MCP Calculator] [🕒 MCP Time] [📄 RAG Documents]
```

---

## ✨ Key Features

### 1. 🤖 LangChain ReAct Autonomous Agent
* **Multi-Turn Reasoning**: Smartly decides when to call tools or answer directly.
* **Autonomous RAG Routing**: Decides dynamically whether to invoke `search_documents` for uploaded files or use general tools/answers.
* **Typo & Multilingual Tolerance**: Understands informal Hinglish and spelling typos (e.g. *"ujjianu weather"*, *"delhi ka mausam"*).
* **Session-Based Memory**: Remembers previous questions and context within a session window.

### 2. 🧠 RAG (PDF / Excel + Cohere Multilingual + MongoDB Atlas Vector Search)
* 📄 **Document Parsers**: Server-side parsing for **PDF** (`pdf-parse`) and **Excel / CSV** (`xlsx`).
* 🌐 **Multilingual Embeddings**: Powered by **Cohere `embed-multilingual-v3.0`** (1024 dimensions, optimal for English, Hindi, and Hinglish).
* 🍃 **MongoDB Atlas Vector Search**: `$vectorSearch` pipeline stage for high-speed similarity retrieval with intelligent fallback.
* 🛠️ **`search_documents` LangChain Tool**: Fully integrated into agent tools with source file, page, and sheet attribution.

#### 📌 MongoDB Atlas Vector Search Index Configuration
In your MongoDB Atlas cluster, create a Search Index on your vectors collection (e.g. `document_vectors`) with the following JSON:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "sessionId"
    }
  ]
}
```

### 3. 🔌 Model Context Protocol (MCP) Integration
* Direct stdio transport integration with `@modelcontextprotocol/sdk`.
* High-precision calculation and exact real-time clock without hallucination.

### 4. 🖼️ Multimodal Intelligence & Media Support
* 📸 **Images & Photos**: Visual analysis of `.png`, `.jpg`, `.webp`, `.svg` via `qwen/qwen3.8-27b` Vision AI.
* 🎥 **Videos**: Scene frame inspection and metadata analysis.
* 🎵 **Audio & Voice**: Real-time speech-to-text transcription via **Groq Whisper Large V3 Turbo**.
* 📄 **Documents**: Client-side inspection and server-side vector ingestion for **PDF**, **Excel**, **Word**, **CSV**, **JSON**, and **Code** files.

### 5. 💬 ChatGPT-Inspired User Experience
* 🟢 **Typewriter SSE Streaming Cursor**: Real-time character streaming with smooth typing effects.
* ⏹ **Send / Stop Controls**: Instant abort controller support to halt streaming at any moment.
* 🌓 **Dark / Light Mode**: Instant theme toggle with full CSS variable design system.
* 📋 **One-Click Markdown Copy**: Instant snippet copying with visual confirmation.

---

## 🔗 Backend Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Server status, active model, and list of registered tools |
| `/api/chat` | `POST` | Streaming chat endpoint with LangChain agent reasoning & vision routing |
| `/api/transcribe` | `POST` | Whisper speech-to-text audio transcription |
| `/api/memory/clear` | `POST` | Clear conversation memory for a session |
| `/api/mcp/tools` | `GET` | List connected Model Context Protocol tools |
| `/api/mcp/time` | `GET` | Direct test endpoint for MCP `get_time` tool |
| `/api/mcp/calculate`| `GET` | Direct test endpoint for MCP `calculator` tool |

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
```

### 2. Run Locally (Single Command)
From the root directory:
```bash
npm run dev
```

* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5000](http://localhost:5000)
* **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 3. Individual Service Commands
- **Backend Only**: `npm run backend` (or `npm --prefix backend run dev`)
- **Frontend Only**: `npm run frontend` (or `npm --prefix frontend run dev`)
- **MCP Test Client**: `node mcp-server/test-client.js`
- **Build Frontend**: `npm run build`

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
