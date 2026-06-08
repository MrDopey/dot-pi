import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import util from "node:util";

const execPromise = util.promisify(exec);

export default function defaultExportExtension(pi: ExtensionAPI) {
  pi.registerCommand("export-default", {
    description: "Export session to HTML (with debug info)",
    handler: async (args, ctx) => {
      const sessionFile = ctx.sessionManager.getSessionFile();
      
      // 1. Check if the session is even backed by a file
      if (!sessionFile) {
        ctx.ui.notify("Error: This session is ephemeral or not yet assigned a file path. Add a message to chat to force a save.", "error");
        return;
      }

      // 2. Check for existence with more attempts (increasing total wait time to 10 seconds)
      let attempts = 0;
      const maxAttempts = 20; 
      ctx.ui.notify(`Looking for session file: ${sessionFile}...`, "info");
      
      while (attempts < maxAttempts && !fs.existsSync(sessionFile)) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!fs.existsSync(sessionFile)) {
        ctx.ui.notify(`Error: Session file still not found on disk after ${attempts * 0.5}s: ${sessionFile}`, "error");
        return;
      }

      const exportDir = process.env.PI_EXPORT_DIR || process.cwd();
      
      let filename = args[0] || `pi-session-${path.basename(sessionFile, '.jsonl')}.html`;
      if (!filename.endsWith(".html")) {
        filename += ".html";
      }

      const fullOutputPath = path.resolve(exportDir, filename);

      // Force overwrite
      if (fs.existsSync(fullOutputPath)) {
        try {
          fs.unlinkSync(fullOutputPath);
        } catch (err: any) {
          ctx.ui.notify(`Failed to overwrite: ${err.message}`, "error");
          return;
        }
      }

      try {
        ctx.ui.notify(`Exporting session to ${fullOutputPath}...`, "info");
        await execPromise(`/usr/local/bin/pi --export "${sessionFile}" "${fullOutputPath}"`);
        ctx.ui.notify(`Successfully exported to: ${fullOutputPath}`, "info");
      } catch (err: any) {
        ctx.ui.notify(`Export failed: ${err.message}`, "error");
        console.error(err);
      }
    },
  });
}
