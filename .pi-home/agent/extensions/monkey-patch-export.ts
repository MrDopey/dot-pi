import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentSession } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Custom export directory resolution
// ---------------------------------------------------------------------------

/**
 * Returns the resolved custom export directory, or null when not configured.
 * Priority: PI_EXPORT_DIR env var > cwd
 * Relative paths in PI_EXPORT_DIR are resolved against process.cwd().
 */
function getExportDir(): string | null {
  const envDir = process.env.PI_EXPORT_DIR;
  if (!envDir) return null;
  return path.resolve(process.cwd(), envDir);
}

/**
 * Inject a custom output location into an export path.
 *
 * Rules:
 *  - No custom dir configured → leave path untouched.
 *  - outputPath is undefined  → auto-generate a filename under custom dir.
 *  - outputPath is absolute   → use as-is (user's explicit intent).
 *  - outputPath is relative   → resolve under custom dir.
 */
function injectCustomLocation(
  outputPath: string | undefined,
  sessionFile: string | undefined,
): string | undefined {
  const exportDir = getExportDir();
  if (!exportDir) return outputPath;

  if (!outputPath) {
    // No path → generate a default filename under the custom dir
    if (!sessionFile) return outputPath;
    const base = path.basename(sessionFile, ".jsonl");
    return path.resolve(exportDir, `pi-session-${base}.html`);
  }

  if (path.isAbsolute(outputPath)) return outputPath;

  return path.resolve(exportDir, outputPath);
}

/**
 * Ensure the parent directory exists for a given file path.
 */
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Capture original methods before patching
// ---------------------------------------------------------------------------

const origExportToHtml = AgentSession.prototype.exportToHtml;
const origExportToJsonl = AgentSession.prototype.exportToJsonl;

// ---------------------------------------------------------------------------
// Monkey-patch AgentSession.prototype.exportToHtml
// ---------------------------------------------------------------------------

AgentSession.prototype.exportToHtml = async function (
  this: AgentSession,
  outputPath?: string,
): Promise<string> {
  const sessionFile = this.sessionManager?.getSessionFile();
  const modifiedPath = injectCustomLocation(outputPath, sessionFile);

  // Ensure the custom export directory exists before writing
  if (modifiedPath !== outputPath && modifiedPath) {
    ensureDir(modifiedPath);
  }

  return origExportToHtml.call(this, modifiedPath);
};

// ---------------------------------------------------------------------------
// Monkey-patch AgentSession.prototype.exportToJsonl
// ---------------------------------------------------------------------------

AgentSession.prototype.exportToJsonl = function (
  this: AgentSession,
  outputPath?: string,
): string {
  const sessionFile = this.sessionManager?.getSessionFile();
  const modifiedPath = injectCustomLocation(outputPath, sessionFile);

  // Ensure the custom export directory exists before writing
  if (modifiedPath !== outputPath && modifiedPath) {
    ensureDir(modifiedPath);
  }

  return origExportToJsonl.call(this, modifiedPath);
};

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function defaultExportExtension(_pi: ExtensionAPI) {
  // All the work is done by the prototype patches above.
  // They intercept every export call — whether triggered by the TUI /export
  // command, programmatic API, or any other path — and inject the custom
  // output directory.
  //
  // Configure with the PI_EXPORT_DIR environment variable:
  //   export PI_EXPORT_DIR=/path/to/exports
  //   export PI_EXPORT_DIR=./exports          (relative → resolved against cwd)
  //
  // When PI_EXPORT_DIR is unset, the export path is left unchanged (default
  // pi behaviour).
}
