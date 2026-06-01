export function now(): number {
  return Date.now();
}

export function formatElapsed(tMs: number | null): string {
  if (tMs === null) return "--:--";
  const safe = Math.max(0, Math.floor(tMs / 1000));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `+${mm}:${ss}`;
}
