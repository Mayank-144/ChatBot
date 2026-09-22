# Mayank AI Fullstack Chatbot (React + Node.js Express)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, production-ready Fullstack AI Chatbot with **Clean Client-Server Architecture**. Features ChatGPT-style multi-format document analysis (PDF, Excel, Word, CSV, Code, Text), smooth real-time token streaming with line-by-line typewriter animations, and custom backend API routes.

---

## 🏗️ Project Architecture

The project is structured into two dedicated workspaces:

```
ChatBot/
├── client/                      # 🎨 FRONTEND (React 18 + Vite)
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/          # Reusable UI components (Icons, Header, Chat, Input)
│   │   ├── hooks/               # Custom React hooks (useChat, useFileUpload, useTheme)
│   │   ├── services/            # API service (communicates with /api/chat)
│   │   ├── utils/               # File parsing utilities (PDF, Excel, Word, Text)
│   │   ├── App.jsx              # Main clean React component
│   │   ├── App.css              # Custom CSS design system
│   │   └── main.jsx             # React entry point
│   ├── .env                     # Frontend environment configuration
│   ├── index.html               # Single page HTML entry
│   ├── vite.config.js           # Vite build config
│   └── package.json             # Frontend dependencies
│
├── server/                      # ⚙️ BACKEND (Node.js + Express API)
│   ├── index.js                 # Custom /api/chat & /api/health server
│   ├── .env                     # Server environment configuration & Groq API key
│   └── package.json             # Backend dependencies
│
├── package.json                 # Monorepo runner (npm run dev)
├── .gitignore                   # Git ignore for node_modules and .env files
└── README.md                    # Project documentation
```

---

## ✨ Key Features

- ⚙️ **Self-Created Backend API**: Node.js Express server running on port 5000 with streaming chat completions and health monitoring.
- 📎 **ChatGPT-Style File Uploads**: Upload & analyze **PDF**, **Excel (`.xlsx`/`.xls`)**, **Word (`.docx`)**, **CSV**, **JSON**, and **Code** files.
- 🖋️ **Line-by-Line Typewriter Animation**: Natural reading-speed generation with dynamic line pauses and blinking cursor.
- 🌓 **Dark & Light Mode**: Instant theme switching with persistent local storage.
- 📝 **Rich Markdown Rendering**: Tables, lists, syntax blocks, and code styling via `react-markdown` & `remark-gfm`.
- 📋 **One-Click Copy**: Copy button with visual confirmation.
- 📱 **Fully Responsive**: Optimized for desktop, tablet, and mobile views.

---

## 🚀 How to Run

### Method 1: Single Command (Recommended)
From the root folder, run both the backend server (Port 5000) and frontend client (Port 5173) together:
```bash
npm run dev
```

### Method 2: Running Individually

**1. Run the Backend Server:**
```bash
cd server
npm install
npm run dev
```
Server runs on: `http://localhost:5000`

**2. Run the Frontend Client:**
```bash
cd client
npm install
npm run dev
```
Frontend runs on: `http://localhost:5173`

---

## 🔗 Custom Backend Endpoints

- **Health Check**: `GET http://localhost:5000/api/health`
- **Chat Streaming API**: `POST http://localhost:5000/api/chat`

---

## 📄 License
MIT License.
