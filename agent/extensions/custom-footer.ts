/**
 * Extension that colors the session name yellow in the footer.
 */
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
          const separator = " • ";
          let pwd = cwd.split("/").filter(Boolean).pop() || cwd;
          if (branch) pwd += ` (${branch})`;
          
          if (sessionName) {
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
          
          // Context usage via built-in context tracking
          const contextUsage = ctx.getContextUsage();
          const fmt = (n: number) => {
            if (n < 1000) return `${n}`;
            if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
            return `${(n / 1000000).toFixed(1)}m`;
          };
          const blue = theme.getFgAnsi("border");
          const dim = theme.getFgAnsi("dim");
          let ctxStr: string;
          if (contextUsage && contextUsage.contextWindow > 0) {
            const pct = contextUsage.percent !== null ? contextUsage.percent.toFixed(1) : "?";
            ctxStr = `${blue}${pct}%${dim}/${fmt(contextUsage.contextWindow)} (auto)`;
          } else {
            ctxStr = "";
          }
          const thinkingLevel = pi.getThinkingLevel();
          const green = theme.getFgAnsi("success");
          const modelStr = ctx.model ? `(${ctx.model.provider}) ${green}${ctx.model.id}${dim}${separator}${thinkingLevel}` : "no-model";
          const right = theme.fg("dim", ctxStr ? `${ctxStr}${separator}${modelStr}` : modelStr);

          // Collapse into single line: pwd on left, stats on right
          const pwdStyled = theme.fg("dim", pwd);
          const pad = " ".repeat(Math.max(1, width - visibleWidth(pwdStyled) - visibleWidth(right)));
          const line = truncateToWidth(pwdStyled + pad + right, width, theme.fg("dim", "..."));

          return [line];
        },
      };
    });
  });
}
