# Mayank AI Fullstack Chatbot (LangChain + DeepAgents + React 18 + Express 5 + MCP Server)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![LangChain](https://img.shields.io/badge/Agent-LangChain%20%26%20DeepAgents-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Cloud-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![MCP](https://img.shields.io/badge/Protocol-MCP%20SDK-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Overview:** An enterprise-ready, autonomous fullstack AI ChatBot combining React 18, Express 5, LangChain ReAct & DeepAgents, Model Context Protocol (MCP), and **Human-in-the-Loop (HITL)** approval. Features autonomous planning (`write_todos`), specialized sub-agents delegation (`research-agent`, `utility-agent`, `leads-agent`), genuine backend pause-and-resume approval, real-time SSE streaming, multimodal vision, and Whisper audio transcription.

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
│   ├── vercel.json                    # Frontend Vercel SPA routing configuration
│   └── package.json                   # Frontend dependencies
│
├── backend/                           # ⚙️ BACKEND (Node.js + Express 5 API + LangChain + MCP Client)
│   ├── agent/                         # 🤖 Multi-Tier Agent Core
│   │   ├── index.js                   # Classic ReAct Agent runner & model factory
│   │   ├── deepAgent.js               # Master Deep Planning Coordinator
│   │   ├── subagents.js               # Specialized Sub-Agents (Research, Utility, Leads)
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
├── vercel.json                        # Root Vercel monorepo build & routing configuration
├── LICENSE                            # MIT Open Source License
├── .gitignore                         # Git exclusion rules
├── package.json                       # Root runner (concurrently fullstack dev script)
└── README.md                          # Repository documentation
```

---

## ⚡ Tech Stack & Specifications

| Component | Technology | Version / Specification | Role in System |
| :--- | :--- | :--- | :--- |
| **Agent Framework** | `@langchain/langgraph` | `^1.4.21` | Graph-based state machine & native event streaming (`streamEvents`) |
| **Agent Primitives** | `@langchain/core` / `langchain` | `^1.2.17` / `^1.5.15` | Core message primitives, runnable tools, and prompt chains |
| **Deep Planning** | `deepagents` | `^1.14.2` | Hierarchical planning and dynamic task coordination |
| **Protocol** | `@modelcontextprotocol/sdk` | `^1.30.0` | Stdio client & server connection for deterministic utility tools |
| **Primary LLM** | Google Gemini (`@langchain/google-genai`) | `gemini-3.5-flash-lite` | Ultra-fast multimodal chat and corporate reasoning engine |
| **Secondary LLM** | Groq Cloud (`@langchain/groq`) | `llama-3.3-70b-versatile` | Ultra-low latency fallback and Whisper speech transcription |
| **Backend API** | Node.js + Express | `v5.2.1` (ES Modules) | High-concurrency REST & SSE streaming server |
| **Task Scheduler** | `node-cron` | `^4.6.0` | Multi-schedule recurring background jobs with auto-PM detection |
| **Email Service** | `nodemailer` | `^10.1.1` | Responsive HTML table briefing generation and SMTP dispatch |
| **Frontend UI** | React 18 + Vite 6 | `^18.3.1` / `^6.0.0` | Glassmorphism interface, custom typewriter queue, dark/light themes |

---

## 🔀 Deep Agent Workflow & HITL Architecture

```
User Query: "Find info about Bengaluru, check weather, calculate budget, prepare email summary."
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
      │          Research       Utility        Leads
      │            Agent         Agent         Agent
      │           (Wiki)     (Weather+Math) (B2B + Email)
      │                └────────────┬────────────┘
      │                             │
      │             3. Sensitive Action ('request_human_approval')
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
      │      (Email is sent)                 (Email aborted)
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
                   ├── Tier 1: SerpAPI Google Search Engine
                   ├── Tier 2: AI Corporate Intelligence Engine (Gemini LLM)
                   ├── Tier 3: DuckDuckGo Web Engine
                   └── Tier 4: Wikipedia Corporate Knowledge Registry
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

| Tool / Sub-Agent Name | Domain / Specialist | Engine / Provider | Capability |
| :--- | :--- | :--- | :--- |
| `write_todos` | Master Coordinator | LangChain Tool | Dynamic checklist creation, step recording, and progress tracking |
| `delegate_to_research_agent` | **Research Agent** | Wikipedia REST API | Encyclopedic research, facts, history, definitions, and city data |
| `delegate_to_utility_agent` | **Utility Agent** | OpenWeatherMap + MCP | Live weather lookups, arithmetic calculations, and clock time |
| `delegate_to_leads_agent` | **Leads Agent** | SerpAPI + Gemini + SMTP | Autonomous B2B leads discovery, contact verification, and email reports |
| `request_human_approval` | Sensitive HITL Action | Approval Manager | **Pauses backend execution**; waits for human Approve/Reject decision |
| `calculator` | Utility Specialist | MCP (Stdio Client) | High-precision arithmetic (Add, Subtract, Multiply, Divide) |
| `get_time` | Utility Specialist | MCP (Stdio Client) | Real-time timestamps and local timezone resolution |
| `get_weather` | Utility Specialist | OpenWeatherMap API | Real-time temperature, humidity, wind, and weather conditions |
| `search_business_leads` | **Leads Specialist** | SerpAPI + Gemini LLM | Multi-source B2B company discovery with emails, phones, and websites |
| `send_leads_email` | **Email Specialist** | Nodemailer (HTML Table) | Sends executive formatted HTML lead digest email via Gmail/SMTP |

---

## ✨ Core Features & Highlights

### 1. 🎯 Autonomous Business Leads Agent & Multi-Schedule Automation
- **Multi-Source Discovery Engine**: Uses SerpAPI for live Google scraping, Gemini AI Corporate Intelligence for verified real companies, DuckDuckGo as secondary web fallback, and Wikipedia corporate registry as fourth tier.
- **Executive HTML Email Dispatch**: Uses Nodemailer to format and send responsive HTML tables complete with clickable websites, `mailto:` and `tel:` buttons, and clean status tags.
- **Multi-Schedule Concurrent Engine**: Supports running multiple schedules simultaneously (e.g., `12:51 PM` for Fintech in Mumbai AND `1:00 PM` for AI in Bangalore). Each active schedule runs as an isolated background cron task.
- **Smart Time Parser & Afternoon Auto-Detection**: Accepts human clock times (e.g., `12:51 PM`, `14:00`, `9:15 AM`, `1:15`) as well as standard 5-part cron syntax (`* * * * *`, `0 8 * * *`). Automatically detects PM for afternoon entries without AM/PM specified.
- **Active Schedules Management UI**: Real-time list of all active recurring schedules inside the `🎯 Leads` modal with target metadata, estimated next run, and individual delete (`🗑️`) controls.
- **⚡ Instant Test Trigger (`Test Run Now`)**: Trigger immediate lead extraction and email dispatch with 1 click without waiting for minute rollover.
- **Chat Router Integration**: Natural language queries like *"Find AI leads in Indore and email them to me"* are routed directly to the autonomous Leads Agent with SSE streaming.

### 2. 🛡️ Human-in-the-Loop (HITL) with Genuine Backend Pause & Clean Synthesis
- Critical and sensitive operations genuinely pause execution using `AsyncLocalStorage` and Promise hooks in `approvalManager.js`.
- The frontend displays an interactive **Human Approval Card** with action details and two actionable buttons:
  - **`[✓ Approve Action]`**: Resumes backend execution, marks action approved, and completes execution.
  - **`[✕ Reject & Cancel]`**: Safely cancels the action and resumes the agent to deliver an abort notice without performing the sensitive action.
- **Clean Report Synthesis**: Strict protocols ensure the final markdown response does not duplicate the approval widget or print redundant "Reviewer Status" sections, focusing purely on deliverables.

### 3. ✨ Modern Streamlined Thinking UI
- Features a single, elegant **`Thinking...` indicator** with a soft glowing pulsing cyan dot and smooth fade animations positioned directly where the response streams in.
- Eliminated redundant bouncing dots and header status labels for a clean, distraction-free typing experience.

### 4. 🤖 Specialized Sub-Agents (Task Delegation)
- **Research Agent**: Handles deep encyclopedic research, definitions, and city facts.
- **Utility Agent**: Combines arithmetic expressions, real-time clock timestamps, and live weather conditions.
- **Leads Agent**: Scouts corporate leads, extracts contact details, and formats executive HTML reports.
- Real-time sub-agent badges (`research-agent`, `utility-agent`, `leads-agent`) stream live to the UI as they run.

### 5. 🧠 Autonomous Dynamic Planning (`write_todos`)
- Breaks complex multi-step queries into a numbered checklist.
- Updates status in real-time (`in_progress`, `completed`, `awaiting_approval`).

### 6. 🔌 Model Context Protocol (MCP) Integration
- Direct connection via `@modelcontextprotocol/sdk` on Stdio transport for deterministic, zero-hallucination calculations and system clock timestamps.

### 7. 🖼️ Multimodal Vision, Audio & Document Extraction
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
| `/api/leads/status` | `GET` | Fetch recurring scheduler state, active schedules count, and last execution |
| `/api/leads/schedule` | `POST` | Dynamically add recurring schedule (supports presets, custom cron, or human time like "12:51 PM") |
| `/api/leads/schedule/test-now` | `POST` | Immediately trigger an automated scheduled test run and deliver email directly |
| `/api/leads/schedule/:id` | `DELETE` | Remove a specific active recurring schedule by unique ID |
| `/api/leads/schedule/clear` | `POST` | Clear all active recurring schedules |
| `/api/transcribe` | `POST` | Whisper speech-to-text audio transcription |
| `/api/memory/clear` | `POST` | Clear conversation memory for a session ID |
| `/api/mcp/tools` | `GET` | Inspect connected Model Context Protocol tools |
| `/api/mcp/time` | `GET` | Direct test endpoint for MCP `get_time` |
| `/api/mcp/calculate` | `GET` | Direct test endpoint for MCP `calculator` |

---

## 🚀 Getting Started

### 1. Environment Setup
Configure your `backend/.env` file:
```env
PORT=5000

# AI Model Provider: 'gemini' (recommended) or 'groq'
MODEL_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

# Groq Cloud (Optional for Groq LLM fallback or Whisper Audio Transcription)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Real-Time Weather Tool
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Deep Planning Coordinator
USE_DEEP_AGENT=true

# Business Leads Agent & Email Notifications
USE_LEADS_AGENT=true
SERPAPI_KEY=your_serpapi_key_here
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_TO=recipient@example.com
LEADS_SCHEDULE=morning
LEADS_QUERY=AI software development companies
LEADS_INDUSTRY=Information Technology
LEADS_LOCATION=India
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

### 4. 🌐 Vercel Production Deployment
Deploying the frontend to Vercel is fully automated and pre-configured:

1. **Import Repository**: Connect your GitHub repository (`ChatBot`) to Vercel.
2. **Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build` (automatically compiles frontend and outputs to `./dist`)
   - **Output Directory**: `dist`
3. **Environment Variables**:
   - `VITE_BACKEND_API_URL`: Your deployed backend URL (e.g. `https://your-backend.onrender.com/api/chat`).
4. **Deploy**:
   - Click **Deploy**. Vercel will build the frontend, handle all SPA routes via `vercel.json`, and seamlessly connect chat, approvals, and leads endpoints to your live backend.

---

## 🧪 Demonstration Queries

### Query 1: Master All-in-One Multi-Agent Plan (Calls All 8 Tools)
```text
We are planning the "India AI & Enterprise Tech Summit 2025" in Bengaluru. Execute this end-to-end multi-agent corporate workflow calling all specialized tools:

1. [Planning Tool]: Formulate a structured step-by-step execution plan using write_todos and track progress.
2. [Wikipedia Research Tool]: Delegate to Research Agent to fetch and summarize the tech background and growth of Bengaluru as the "Silicon Valley of India" from Wikipedia.
3. [Live Weather Tool]: Delegate to Utility Agent to check the live current weather and temperature in Bengaluru for event logistics.
4. [Clock Time Tool]: Delegate to Utility Agent to check the exact real-time local clock time in India.
5. [Leads Discovery Tool]: Delegate to Leads Agent to search and discover the top 5 genuine, verified enterprise AI and SaaS companies in Bengaluru with official websites, contact emails, phone numbers, and descriptions.
6. [Math Calculator Tool]: Delegate to Utility Agent to calculate the total budget for 16 executive sponsorship passes at ₹18,500 each plus 18% GST using calculator: (16 * 18500) * 1.18.
7. [Human-in-the-Loop Approval Tool]: Because this commercial booking commitment exceeds ₹3,00,000, PAUSE execution immediately and request my human approval with the exact calculated budget and attendee count before committing.
8. [Email Dispatch Tool]: As soon as I approve, compile and autonomously dispatch the complete verified executive HTML briefing report directly to my Gmail inbox: recipient@example.com.
```

### Query 2: Pure Business Leads Agent Trigger via Chat
```text
Find 5 business leads for AI companies in Mumbai and send the email report to recipient@example.com
```

### Query 3: Multi-Task Utility & Deep Planning with HITL
```text
We are planning a conference trip to Mumbai. 1. Check live weather in Mumbai. 2. Calculate flight tickets: 4 * 6500. 3. Since the cost is ₹26,000, pause and ask for my approval before proceeding. 4. Once approved, summarize the final itinerary.
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
