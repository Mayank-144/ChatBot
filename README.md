# Mayank AI Fullstack Chatbot (LangChain + DeepAgents + React 18 + Express 5 + MCP Server)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![LangChain](https://img.shields.io/badge/Agent-LangChain%20%26%20DeepAgents-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![MCP](https://img.shields.io/badge/Protocol-MCP%20SDK-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-F55036?logo=fastapi&logoColor=white)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Overview:** An enterprise-ready, autonomous fullstack AI ChatBot combining React 18, Express 5, LangChain ReAct & DeepAgents, Model Context Protocol (MCP), and **Human-in-the-Loop (HITL)** approval. Features autonomous planning (`write_todos`), specialized sub-agents delegation (`research-agent`, `utility-agent`, `communication-agent`), genuine backend pause-and-resume approval, real-time SSE streaming, multimodal vision, and Whisper audio transcription.

---

## 🏗️ Project Architecture

```
ChatBot/
├── frontend/                          # 🎨 FRONTEND (React 18 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/                  # MessageList, MessageItem, LiveTodoProgress (Plan & HITL Card), FileCard
│   │   │   ├── Header/                # Header, Theme Toggle, Leads Modal Trigger, Clear Conversation
│   │   │   ├── Icons/                 # High-performance SVG Icon components
│   │   │   ├── Input/                 # ChatInput, StagedFiles, DragOverlay
│   │   │   └── Leads/                 # LeadsPanel (Modal for search, results, and cron scheduler)
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Chat state, typewriter queue, HITL decision handlers
│   │   │   ├── useFileUpload.js       # 4-tier attachment picker & drag-and-drop
│   │   │   └── useTheme.js            # Dark/Light theme state with localStorage persistence
│   │   ├── services/
│   │   │   └── api.js                 # Unified SSE streaming fetcher & approval decision sender
│   │   ├── utils/
│   │   │   └── fileParser.js          # In-browser parsers (PDF.js, SheetJS, Mammoth, Canvas)
│   │   ├── App.jsx                    # Root React Application component
│   │   ├── App.css                    # Glassmorphism CSS design system & micro-animations
│   │   └── main.jsx                   # Vite React DOM mount point
│   ├── vite.config.js                 # Vite dev proxy configuration (/api -> :5000)
│   └── package.json                   # Frontend dependencies
│
├── backend/                           # ⚙️ BACKEND (Node.js + Express 5 API + LangChain + MCP Client)
│   ├── agent/                         # 🤖 Multi-Tier Agent Core
│   │   ├── index.js                   # Classic ReAct Agent runner & model factory
│   │   ├── deepAgent.js               # Master Deep Planning Coordinator
│   │   ├── subagents.js               # Specialized Sub-Agents (Research, Utility, Communication)
│   │   ├── leadsAgent.js              # Autonomous Business Leads Agent Coordinator
│   │   ├── approvalManager.js         # HITL AsyncLocalStorage & Promise pause/resume manager
│   │   ├── router.js                  # Deterministic Query Router (Simple vs Complex vs Leads)
│   │   └── memory.js                  # Windowed In-Memory Session Storage
│   ├── tools/                         # 🛠️ LangChain Agent Tools
│   │   ├── weatherTool.js             # Live OpenWeatherMap API tool
│   │   ├── wikiTool.js                # Wikipedia REST API knowledge lookup
│   │   ├── calculatorTool.js          # High-precision MCP Calculator wrapper
│   │   ├── timeTool.js                # High-precision MCP Real-Time Clock wrapper
│   │   ├── approvalTool.js            # General Human Approval tool wrapper (HITL Action Tool)
│   │   ├── leadsTool.js               # SerpAPI + DuckDuckGo + Wikipedia B2B Lead Generator
│   │   ├── emailTool.js               # Nodemailer Responsive HTML Email Reporter
│   │   └── index.js                   # Barrel export for all active agent tools
│   ├── services/                      # ⏱️ Backend Services
│   │   └── scheduler.js               # node-cron recurring lead generation & dispatch service
│   ├── index.js                       # Express Server, SSE Streamer, Leads Endpoints & MCP Client
│   ├── package.json                   # Backend dependencies
│   └── .env.example                   # Backend environment template
│
├── mcp-server/                        # 🔌 MODEL CONTEXT PROTOCOL (MCP) SERVER
│   ├── index.js                       # MCP Server with Stdio transport (get_time, calculator)
│   └── package.json                   # MCP dependencies (@modelcontextprotocol/sdk, zod)
│
├── .gitignore                         # Git exclusion rules
├── package.json                       # Root runner (concurrently fullstack dev script)
└── README.md                          # Repository documentation
```

---

## 🔍 Deep Agents Compatibility & Specifications

- **`@langchain/core`**: `^1.2.17` (Meets requirement: `^1.2.14` ✅)
- **`@langchain/langgraph`**: `^1.4.21` (Meets requirement: `^1.4.10` ✅)
- **`langchain`**: `^1.5.15` (Meets requirement: `^1.5.10` ✅)
- **Model Support**: Google Gemini (`gemini-3.5-flash-lite`) and Groq (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) with LangGraph native event streaming (`streamEvents`).

---

## 🔀 Deep Agent Workflow & HITL Architecture

```
User Query: "Find info about Indore, check weather, calculate 25 × 4, prepare email summary."
                                    │
                                    ▼
                             POST /api/chat
                                    │
                                    ▼
                         backend/agent/router.js
                                    │
      ┌─────────────────────────────┼─────────────────────────────┐
      ▼                             ▼                             ▼
[Simple Query]               [Complex Query]               [Leads Query]
      │                             │                             │
Classic ReAct Agent         Main Deep Coordinator        Autonomous Leads Agent
      │                             │                    (SerpAPI + Email Tool)
      │             1. Mandatory Plan ('write_todos')
      │                (Broadcasts live checklist to UI)
      │                             │
      │             2. Specialized Sub-Agent Delegation
      │                ┌────────────┬────────────┐
      │                ▼            ▼            ▼
      │          Research       Utility     Communication
      │            Agent         Agent          Agent
      │           (Wiki)     (Weather+Math)  (Draft Email)
      │                └────────────┬────────────┘
      │                             │
      │             3. Sensitive Action ('send_email')
      │                             │
      │                backend/agent/approvalManager.js
      │             ┌───────────────┴───────────────┐
      │             ▼                               ▼
      │      [GENUINE PAUSE]              Broadcast Approval Event
      │   (Node Promise halts)            over SSE to Frontend UI
      │                                             │
      │                                             ▼
      │                                  Frontend displays Card
      │                                 [✓ Approve]  [✕ Reject]
      │                                             │
      │             4. User Decision Received       │
      │                (POST /api/approval)         │
      │                             ◄───────────────┘
      │             ┌───────────────┴───────────────┐
      │             ▼                               ▼
      │       [User Approves]                 [User Rejects]
      │      Action Executed                 Action Cancelled
      │      (Email is sent)                 (Email cancelled)
      │             └───────────────┬───────────────┘
      │                             │
      │             5. Synthesize Final Report
      │                (Stream final response chunks)
      │                             │
      └─────────────────────────────┴─────────────────────────────┐
                                                                  ▼
                                                          Frontend Displays
                                                         Final Comprehensive
                                                             Markdown Answer
```

---

## 🎯 Business Leads Agent Workflow

```
[User via UI Panel]        [node-cron Recurring Schedule]        [Chat Trigger]
        │                               │                              │
        └───────────────────────┬───────┴──────────────────────────────┘
                                │
                                ▼
                   backend/agent/leadsAgent.js
                                │
                    1. search_business_leads
                                │
                                ▼
                   backend/tools/leadsTool.js
                   ├── Tier 1: SerpAPI Google Engine
                   ├── Tier 2: DuckDuckGo Web Engine
                   └── Tier 3: Wikipedia Corporate Knowledge Fallback
                                │
                                ▼
                     5 Structured B2B Leads
             (Company, Website, Email, Phone, Description)
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
     [Send Email = true]                   [Send Email = false]
             │                                     │
             ▼                                     │
   backend/tools/emailTool.js                      │
   (Nodemailer HTML Digest Dispatch)               │
             │                                     │
             └──────────────────┬──────────────────┘
                                │
                                ▼
                Return Leads Data & Summary Report
```

---

## 🛠️ Autonomous Tools & Sub-Agents

| Agent / Tool Name | Domain / Subagent | Engine / API | Capability |
| :--- | :--- | :--- | :--- |
| `write_todos` | Master Coordinator | LangChain Tool | Dynamic checklist creation and progress tracking |
| `delegate_to_research_agent` | **Research Agent** | Wikipedia REST API | Encyclopedic research, facts, history, city information |
| `delegate_to_utility_agent` | **Utility Agent** | OpenWeatherMap + MCP | Live weather lookups, arithmetic calculations, clock time |
| `request_human_approval` | Sensitive HITL Action | Approval Manager | **Pauses backend execution**; waits for human Approve/Reject |
| `calculator` | Utility Specialist | MCP (Stdio Client) | High-precision arithmetic (Add, Subtract, Multiply, Divide) |
| `get_time` | Utility Specialist | MCP (Stdio Client) | Real-time timestamps and local timezone |
| `get_weather` | Utility Specialist | OpenWeatherMap API | Real-time temperature, humidity, wind, conditions |
| `search_business_leads` | **Leads Agent** | SerpAPI + DDG + Wiki | Multi-source B2B company discovery with emails, phones, sites |
| `send_leads_email` | **Leads Agent** | Nodemailer (HTML Table) | Sends executive formatted HTML lead digest email with SMTP |

---

## ✨ Core Features & Highlights

### 1. 🎯 Autonomous Business Leads Agent & Automated Email Reports
- **Multi-Source Discovery Engine**: Uses SerpAPI for live Google scraping, DuckDuckGo as secondary web fallback, and Wikipedia corporate registry as third tier to guarantee 5 structured leads.
- **Executive HTML Email Dispatch**: Uses Nodemailer to format and send responsive HTML tables complete with clickable websites, `mailto:` and `tel:` buttons, and clean status tags.
- **Automated Recurring Scheduler**: Built-in `node-cron` service supporting predefined presets (`morning`, `evening`, `night`, `midnight`, `disabled`) and arbitrary custom cron expressions.
- **Dedicated Management Panel**: Access via the top header `🎯 Leads` button to configure searches, trigger manual runs, inspect active cron status, and test email delivery.
- **Chat Router Integration**: Natural language queries like *"Find AI leads in Indore and email them to me"* are routed directly to the autonomous Leads Agent with SSE streaming.

### 2. 🛡️ Human-in-the-Loop (HITL) with Genuine Backend Pause
- Critical and sensitive operations genuinely pause execution using `AsyncLocalStorage` and Promise hooks in `approvalManager.js`.
- The frontend displays an interactive **Human Approval Card** with action details and two actionable buttons:
  - **`[✓ Approve Action]`**: Resumes backend execution, marks action approved, and completes execution.
  - **`[✕ Reject & Cancel]`**: Safely cancels the action and resumes the agent to deliver the report without performing the sensitive action.
- Zero fake approval: The backend genuinely waits for the human decision.

### 3. 🤖 Specialized Sub-Agents (Task Delegation)
- **Research Agent**: Handles deep encyclopedic research, definitions, and city facts.
- **Utility Agent**: Combines arithmetic expressions, real-time clock timestamps, and live weather conditions.
- Real-time sub-agent badges (`research-agent`, `utility-agent`) stream live to the UI as they run.

### 4. 🧠 Autonomous Dynamic Planning (`write_todos`)
- Breaks complex multi-step queries into a numbered checklist.
- Updates status in real-time (`in_progress`, `completed`, `awaiting_approval`).

### 5. 🔌 Model Context Protocol (MCP) Integration
- Direct connection via `@modelcontextprotocol/sdk` on Stdio transport for deterministic, zero-hallucination calculations and system clock timestamps.

### 6. 🖼️ Multimodal Vision & Audio
- 📸 **Vision AI**: Analyzes photos, diagrams, and screenshots.
- 🎙️ **Audio Transcription**: In-browser microphone recording and audio file parsing powered by **Groq Whisper Large V3 Turbo**.
- 📄 **Document Extraction**: In-browser client-side parsing for **PDF**, **Excel**, **Word**, **CSV**, **JSON**, and **Code** files.

---

## 🔗 Backend API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check, active models, DeepAgent status, and tool availability |
| `/api/chat` | `POST` | Primary Server-Sent Events (SSE) chat completions stream with multi-tier routing |
| `/api/approval` | `POST` | Resolves pending human approval (`approvalId`, `sessionId`, `decision: 'approve' \| 'reject'`) |
| `/api/approval/:sessionId` | `GET` | Queries active pending approvals for a session |
| `/api/leads/run` | `POST` | Execute on-demand business lead generation and optional email dispatch |
| `/api/leads/status` | `GET` | Fetch recurring scheduler state, active preset, cron expression, and last execution |
| `/api/leads/schedule` | `POST` | Dynamically update lead scheduler preset or custom cron schedule |
| `/api/transcribe` | `POST` | Whisper speech-to-text audio transcription |
| `/api/memory/clear` | `POST` | Clear conversation memory for a session ID |
| `/api/mcp/tools` | `GET` | Inspect connected Model Context Protocol tools |
| `/api/mcp/time` | `GET` | Direct test endpoint for MCP `get_time` |
| `/api/mcp/calculate`| `GET` | Direct test endpoint for MCP `calculator` |

---

## 🚀 Getting Started

### 1. Environment Setup
Configure your `backend/.env` file:
```env
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
OPENWEATHER_API_KEY=your_openweather_api_key_here
USE_DEEP_AGENT=true

# Business Leads Agent & Email Notifications
USE_LEADS_AGENT=true
SERPAPI_KEY=your_serpapi_key_here
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_TO=recipient@example.com
LEADS_SCHEDULE=morning
LEADS_CRON_EXPR=0 8 * * *
LEADS_QUERY=AI software development companies
LEADS_INDUSTRY=Information Technology
LEADS_LOCATION=San Francisco, CA
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
- **Build Frontend Bundle**: `npm run build`

---

## 🧪 Demonstration Queries

### Query 1: Deep Planning & HITL Approval
```text
Find information about Indore, check its current weather, calculate 25 × 4, and prepare an email containing the summary.
```

### Query 2: Autonomous Business Lead Generation via Chat
```text
Find 5 business leads for software agencies in Bangalore and send the executive email report.
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

