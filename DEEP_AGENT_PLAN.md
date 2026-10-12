# 🚀 LangChain DeepAgents Architecture & Implementation Plan

## 1. 🔍 Compatibility Check
- **Installed `@langchain/core`**: `^1.2.17` (Meets requirement: `^1.2.14` ✅)
- **Installed `@langchain/langgraph`**: `^1.4.21` (Meets requirement: `^1.4.10` ✅)
- **Installed `langchain`**: `^1.5.15` (Meets requirement: `^1.5.10` ✅)
- **Model Compatibility**: Groq `openai/gpt-oss-120b` via `@langchain/groq` is fully compatible with LangGraph event streaming (`streamEvents`).

---

## 2. 📦 Required NPM Packages
```bash
# In backend/
npm install deepagents @langchain/langgraph-checkpoint @langchain/langgraph-sdk langsmith
```

---

## 3. 📁 File Structure & Modifications

### A. Nayi Files Jo Banengi (New Files)
1. `backend/agent/router.js`
   - Fast classifier to route queries: Simple -> ReAct Agent, Complex -> Deep Agent.
2. `backend/agent/deepAgent.js`
   - Deep Agent runner with `createDeepAgent`, `write_todos` planning, subagent spawning, and error recovery.
3. `backend/agent/subagents.js`
   - Specialist subagents (e.g. Researcher, Math/Time Analyst).
4. `frontend/src/components/Chat/LiveTodoProgress.jsx`
   - Live todo progress bar, step checklist, and active subagent indicator.

### B. Existing Files Jo Modify Hongi
1. `backend/index.js`
   - Route requests using `agentRouter`.
   - Stream SSE events: `todo_update`, `subagent_event`, and token deltas.
   - Expose Deep Agent status in `/api/health`.
2. `backend/.env.example` & `backend/.env`
   - Add `USE_DEEP_AGENT=true`.
3. `frontend/src/services/api.js`
   - Handle SSE `todo_update` and `subagent` stream payloads.
4. `frontend/src/hooks/useChat.js`
   - Manage live streaming todos state per message.
5. `frontend/src/components/Chat/MessageItem.jsx`
   - Render `LiveTodoProgress` component above/inside the message text.
6. `frontend/src/App.css`
   - Styling for todo cards, progress bar, animated spinners, and subagent tags.

---

## 4. 🔀 Intelligent Routing Architecture
```
User Prompt ──> backend/index.js ──> backend/agent/router.js
                                           │
             ┌─────────────────────────────┴─────────────────────────────┐
             ▼                                                           ▼
     [Simple Query / Chit-chat]                               [Complex / Multi-Step Goal]
             │                                                           │
   Existing ReAct Agent                                           LangChain DeepAgent
  (backend/agent/index.js)                                      (backend/agent/deepAgent.js)
             │                                                           │
             │                                              ┌────────────┴────────────┐
             │                                              ▼                         ▼
             │                                        write_todos tool            task tool
             │                                      (Live Plan & Progress)   (Specialist Subagents)
             │                                                           │
             └─────────────────────────────┬─────────────────────────────┘
                                           ▼
                           Server-Sent Events (SSE) Stream
                     (Tokens + Live Todo Updates + Subagent Tags)
                                           ▼
                           Frontend Live Progress UI Card
```
