# AI Chatbot (React + Vite)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Groq](https://img.shields.io/badge/Powered%20By-Groq-F05A28)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, responsive, and minimalist AI Chatbot built using **React**, **Vite**, and **Groq / OpenAI-compatible APIs**. Features a sleek chat timeline, rich Markdown rendering, one-click message copying, and seamless Dark/Light theme toggling.

---

## ✨ Features

- ⚡ **Ultra-Fast AI Inference**: Powered by Groq Cloud APIs (e.g., `openai/gpt-oss-120b`, `llama-3.1-8b-instant`).
- 🌓 **Dark & Light Mode**: Instant theme switching with persistent `localStorage` support.
- 📝 **Rich Markdown Rendering**: Formats tables, lists, bold text, blockquotes, and code blocks using `react-markdown` & `remark-gfm`.
- 📋 **One-Click Message Copy**: Discrete copy button on both user and AI messages with instant visual feedback.
- 🗑️ **Chat Management**: Quick conversation clearing with confirmation.
- 🎨 **Pure Vanilla CSS**: Crafted without bloated UI frameworks for maximum speed and control.
- 📱 **Fully Responsive**: Adapts seamlessly to all desktop and mobile screen sizes.

---

## 🛠️ Tech Stack

- **Frontend Framework**: [React 18](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS (Custom Design System with CSS Variables)
- **Markdown Processing**: `react-markdown` + `remark-gfm`
- **API**: Groq Cloud / OpenAI-compatible Chat Completions API

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ai-chatbot.git
cd ai-chatbot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the project root (you can refer to [`.env.example`](file:///c:/Users/mayank%20jaiswal/OneDrive/Desktop/ChatBot/.env.example)):

```env
# Groq API Configuration
VITE_API_URL=https://api.groq.com/openai/v1/chat/completions
VITE_MODEL=openai/gpt-oss-120b
VITE_API_KEY=your_groq_api_key_here
```

> **Note**: Get your free API key from [Groq Console](https://console.groq.com/keys).

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📦 Production Build

To create an optimized production build:
```bash
npm run build
```

To preview the production build locally:
```bash
npm run preview
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
