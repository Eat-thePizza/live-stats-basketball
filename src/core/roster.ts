import type { Roster } from "./types";

export const DEFAULT_ROSTER: Roster = [
  { id: "devin",    displayName: "Devin Turner" },
  { id: "alden",    displayName: "Alden Visitacion" },
  { id: "wes",      displayName: "Weston Edwards" },
  { id: "max",      displayName: "Max Sequeira" },
  { id: "ayaan",    displayName: "Ayaan Bawa" },
  { id: "luke",     displayName: "Luke Alexander" },
  { id: "john",     displayName: "John Weaver" },
  { id: "james",    displayName: "James Wilson" },
  { id: "jackson",  displayName: "Jackson Corbett" },
  { id: "yidi",     displayName: "Yidi Qin" },
  { id: "derek",    displayName: "Derek Johnson" },
  { id: "gianni",   displayName: "Gianni Rivas" },
  { id: "kingston", displayName: "Kingston Ng" },
  { id: "zane",     displayName: "Zane Bermudez" },
  { id: "zayden",   displayName: "Zayden Bermudez" },
  { id: "drew",     displayName: "Drew Cumby" },
  { id: "op",       displayName: "Opponent" },
];

export function isValidPlayerId(roster: Roster, id: string): boolean {
  return roster.some(p => p.id === id);
}
