import { useEffect, useState } from "react";

function readHash(): string {
  const h = window.location.hash;
  if (!h || h === "#") return "/";
  return h.startsWith("#") ? h.slice(1) : h;
}

export function useHashRoute(): string {
  const [path, setPath] = useState<string>(() => readHash());
  useEffect(() => {
    const onChange = () => setPath(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

export function matchClipsRoute(path: string): { gameId: string } | null {
  const m = path.match(/^\/games\/([^/]+)\/stage2\/clips\/?$/);
  return m ? { gameId: decodeURIComponent(m[1]) } : null;
}

export function matchProjectRoute(path: string): boolean {
  return /^\/project\/?$/.test(path);
}
