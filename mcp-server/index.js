import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Initialize the MCP Server
const server = new McpServer({
  name: "chatbot-mcp-server",
  version: "1.0.0"
});

// Tool 1: get_time - Returns current date and time
server.tool(
  "get_time",
  "Returns the current date and time in both ISO format and local formatted string",
  {},
  async () => {
    const now = new Date();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              iso: now.toISOString(),
              local: now.toLocaleString(),
              timestamp: now.getTime(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            null,
            2
          )
        }
      ]
    };
  }
);

// Tool 2: calculator - Performs arithmetic operations on two numbers
server.tool(
  "calculator",
  "Performs basic arithmetic operations: add, subtract, multiply, or divide on two numbers",
  {
    a: z.number().describe("The first number"),
    b: z.number().describe("The second number"),
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("Operation to perform (add, subtract, multiply, divide)")
  },
  async ({ a, b, operation }) => {
    let result;
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Error: Division by zero is not allowed."
              }
            ]
          };
        }
        result = a / b;
        break;
      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Unsupported operation '${operation}'. Allowed operations: add, subtract, multiply, divide.`
            }
          ]
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              a,
              b,
              operation,
              result
            },
            null,
            2
          )
        }
      ]
    };
  }
);

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ChatBot MCP Server is running on stdio transport.");
}

main().catch((error) => {
  console.error("Fatal server error:", error);
  process.exit(1);
});
