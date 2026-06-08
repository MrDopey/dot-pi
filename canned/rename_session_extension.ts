import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec, execSync } from "node:child_process";

// --- Configuration ---
// Prefix environment variables with PI_SESSION_RENAMER_
const RENAME_INTERVAL = parseInt(process.env.PI_SESSION_RENAMER_INTERVAL || "2", 10) || 5;
const CONTEXT_LIMIT = parseInt(process.env.PI_SESSION_RENAMER_CONTEXT_LIMIT || "300", 10) || 3000;
const PI_MODEL = process.env.PI_SESSION_RENAMER_MODEL; // Optional

// --- Helper Functions ---

/** Normalizes a name: lowercase, spaces/punctuation -> hyphens, no leading/trailing hyphens */
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '');   // Remove leading/trailing hyphens
}

/** Efficiently extracts the last N characters of text content by iterating backwards */
function getRecentContext(ctx: ExtensionContext): string {
  const entries = ctx.sessionManager.getEntries();
  let context = "";
  
  // Iterate backwards to gather recent content efficiently
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "message" && (entry.message.role === "user" || entry.message.role === "assistant")) {
      const content = entry.message.content;
      let text = "";
      
      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content.map(c => (c.type === 'text' ? c.text : '')).join(' ');
      }
      
      context = text + "\n" + context;
      
      // Stop once we have reached the configured character limit
      if (context.length >= CONTEXT_LIMIT) {
        break;
      }
    }
  }
  
  return context.slice(-CONTEXT_LIMIT);
}

// --- Plugin Logic ---

let promptCount = 0;

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    promptCount++;
    console.log(`[RenamePlugin] Agent completed. Count: ${promptCount}/${RENAME_INTERVAL}`);

    if (promptCount >= RENAME_INTERVAL) {
      console.log("[RenamePlugin] Interval reached. Generating new name using headless CLI...");

      // 1. Construct the prompt
      const recentContext = getRecentContext(ctx);
      const fullPrompt = `Context:\n${recentContext}\n\nInstruction: Suggest a very short, 3-word name (normalized lowercase-hyphens) based on this context. Return ONLY the name.`;

      // 2. Prepare CLI arguments
      const args = ["--no-extensions", "--no-session"];
      if (PI_MODEL) {
        args.push("--model", PI_MODEL);
      }
      args.push("-p", `'${fullPrompt.replaceAll('.', '\'')}'`);

      // 3. Execute the CLI synchronously to avoid hanging
      try {
        const { execSync } = require('node:child_process');
        const stdout = execSync(`pi ${args.join(' ')}`, {
          env: { ...process.env },
          encoding: 'utf-8'
        });

        const newName = normalizeName(stdout.trim());
        pi.setSessionName(newName);
        console.log(`[RenamePlugin] Session successfully renamed to: ${newName}`);
        promptCount = 0; // Reset counter after success
      } catch (error) {
        console.error(`[RenamePlugin] Failed to rename session: ${error.message}`);
        if (error.stderr) {
          console.error(`[RenamePlugin] CLI Error: ${error.stderr}`);
        }
      }
    }
  });

  console.log("[RenamePlugin] Activated successfully.");
}
