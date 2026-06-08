import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// --- Configuration ---
const RENAME_INTERVAL = parseInt(process.env.PI_SESSION_RENAMER_INTERVAL || "2", 10) || 5;
const CONTEXT_LIMIT = parseInt(process.env.PI_SESSION_RENAMER_CONTEXT_LIMIT || "300", 10) || 3000;
const PI_MODEL = process.env.PI_SESSION_RENAMER_MODEL; // Optional

// --- Helper Functions ---

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getRecentContext(ctx: ExtensionContext): string {
  const entries = ctx.sessionManager.getEntries();
  let context = "";

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

      if (context.length >= CONTEXT_LIMIT) break;
    }
  }

  return context.slice(-CONTEXT_LIMIT);
}

// --- Plugin Logic ---

let promptCount = 0;

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    promptCount++;

    if (promptCount >= RENAME_INTERVAL) {
      const recentContext = getRecentContext(ctx);
      const fullPrompt = `Context:\n${recentContext}\n\nInstruction: Suggest a very short, 3-word name (normalized lowercase-hyphens) based on this context. Return ONLY the name.`;

      const args = ["--no-extensions", "--no-session"];
      if (PI_MODEL) {
        args.push("--model", PI_MODEL);
      }
      args.push("-p");

      try {
        const { spawn } = require('node:child_process');

        const stdout = await new Promise<string>((resolve, reject) => {
          const child = spawn('pi', [...args, fullPrompt], {
            detached: true,
            stdio: ['ignore', 'pipe', 'ignore'],
            env: { ...process.env },
          });

          const pid = child.pid!;
          let out = '';
          child.stdout.on('data', (chunk: Buffer) => { out += chunk; });

          let settled = false;
          const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

          child.on('error', (err: Error) => done(() => reject(err)));

          child.on('close', (code: number | null) => {
            done(() => code === 0
              ? resolve(out)
              : reject(new Error(`Child process exited with code ${code}`)));
          });

          const timer = setTimeout(() => {
            if (settled) return;
            try { process.kill(-pid, 'SIGTERM'); } catch { /* already dead */ }
            done(() => reject(new Error('Child process timed out after 30s')));
          }, 30_000);
          if (timer.unref) timer.unref();
        });

        const newName = normalizeName(stdout.trim());
        if (newName) {
          pi.setSessionName(newName);
          promptCount = 0;
        }
      } catch {
        // Silently fail — don't pollute TUI with error output
      }
    }
  });
}
