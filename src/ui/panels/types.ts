import type { Roster, PlayerId } from "@/core/types";

export interface PanelProps {
  roster: Roster;
  onCourt: PlayerId[];
  onSubmit: (line: string) => void;
}
