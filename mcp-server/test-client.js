import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function test() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["index.js"]
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  console.log("Listing tools...");
  const tools = await client.listTools();
  console.log("Tools available:", JSON.stringify(tools.tools.map(t => t.name)));

  console.log("\nTesting get_time tool:");
  const timeRes = await client.callTool({
    name: "get_time",
    arguments: {}
  });
  console.log("Time response:", timeRes.content[0].text);

  console.log("\nTesting calculator tool (add):");
  const addRes = await client.callTool({
    name: "calculator",
    arguments: { a: 15, b: 27, operation: "add" }
  });
  console.log("Add response:", addRes.content[0].text);

  console.log("\nTesting calculator tool (divide by zero):");
  const divZeroRes = await client.callTool({
    name: "calculator",
    arguments: { a: 10, b: 0, operation: "divide" }
  });
  console.log("Divide zero response:", divZeroRes);

  await client.close();
  console.log("\nTest completed successfully!");
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
