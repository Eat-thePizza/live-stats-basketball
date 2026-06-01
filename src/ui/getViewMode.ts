export type ViewMode = "stats" | "landing";

const LANDING_HOSTS = new Set(["ethanliu.cc.cd"]);
const STATS_HOSTS = new Set(["ethanliu.ccwu.cc"]);

/**
 * Resolve which top-level view to render.
 *
 * Priority:
 *   1. `?view=landing` or `?view=stats` query override
 *   2. Hostname lookup (case-insensitive)
 *   3. Default to "stats" so unknown hosts (incl. localhost) keep the
 *      existing app behavior.
 */
export function getViewMode(hostname: string, search: string): ViewMode {
  const params = new URLSearchParams(search);
  const override = params.get("view");
  if (override === "landing" || override === "stats") {
    return override;
  }
  const h = (hostname ?? "").toLowerCase();
  if (LANDING_HOSTS.has(h)) return "landing";
  if (STATS_HOSTS.has(h)) return "stats";
  return "stats";
}
