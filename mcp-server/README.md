# ChatBot MCP Server

A Model Context Protocol (MCP) server built with `@modelcontextprotocol/sdk` using **Stdio transport**.

## 🛠️ Tools

1. **`get_time`**:
   - Returns current date and time (ISO string, local formatted time, timestamp, and timezone).
   - Parameters: none.

2. **`calculator`**:
   - Performs arithmetic calculations.
   - Parameters:
     - `a` (number): First number
     - `b` (number): Second number
     - `operation` (string): `"add"` | `"subtract"` | `"multiply"` | `"divide"`
   - Includes safety checks against division by zero.

## 🚀 How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the MCP Server
```bash
npm start
```
*(Runs `node index.js` listening over standard input/output)*

## ⚙️ MCP Client Configuration Example

### Claude Desktop / Antigravity / Cursor Configuration
```json
{
  "mcpServers": {
    "chatbot-tools": {
      "command": "node",
      "args": ["c:/Users/mayank jaiswal/OneDrive/Desktop/ChatBot/mcp-server/index.js"]
    }
  }
}
```
