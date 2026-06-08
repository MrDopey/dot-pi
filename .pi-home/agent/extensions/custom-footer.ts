/**
 * Extension that colors the session name yellow in the footer.
 */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          const sessionName = ctx.sessionManager.getSessionName();
          const cwd = ctx.sessionManager.getCwd();
          const branch = footerData.getGitBranch();

          // Build pwd line with yellow session name
          let pwd = cwd.replace(/^\/home\/[^/]+/, "~");
          if (branch) pwd += ` (${branch})`;
          
          if (sessionName) {
            const separator = " • ";
            const yellowName = theme.fg("warning", sessionName);
            // Account for ANSI codes in width calculation
            const baseWidth = visibleWidth(pwd + separator);
            const nameWidth = visibleWidth(sessionName);
            if (baseWidth + nameWidth <= width) {
              pwd = pwd + separator + yellowName;
            } else {
              const availWidth = width - visibleWidth(separator) - nameWidth;
              if (availWidth > 10) {
                pwd = truncateToWidth(pwd, availWidth, "...") + separator + yellowName;
              }
            }
          }
          
          const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));

          // Context usage
          let contextUsed = 0;
          const entries = ctx.sessionManager.getEntries();
          for (let i = entries.length - 1; i >= 0; i--) {
            const e = entries[i];
            if (e.type === "message" && e.message.role === "assistant") {
              contextUsed = (e.message as AssistantMessage).usage.input;
              break;
            }
          }

          const fmt = (n: number) => n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
          const maxContext = ctx.model?.contextWindow;
          let left: string;
          if (maxContext && maxContext > 0) {
            const pct = Math.round((contextUsed / maxContext) * 100);
            left = theme.fg("dim", `ctx: ${fmt(contextUsed)}/${fmt(maxContext)} (${pct}%)`);
          } else {
            left = theme.fg("dim", `ctx: ${fmt(contextUsed)}`);
          }
          const right = theme.fg("dim", ctx.model?.id || "no-model");

          const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          const statsLine = truncateToWidth(left + pad + right, width);

          return [pwdLine, statsLine];
        },
      };
    });
  });
}
