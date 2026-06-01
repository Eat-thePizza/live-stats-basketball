import { useState } from "react";
import type { PlayerId } from "@/core/types";
import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./TurnoverPanel.module.css";

export default function TurnoverPanel({ roster, onCourt, onSubmit }: PanelProps) {
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [stealer, setStealer] = useState<PlayerId | null>(null);

  const options = roster.filter((p) => onCourt.includes(p.id) || p.id === "op");
  const stealerOptions = options.filter((p) => p.id !== player);

  function togglePlayer(id: PlayerId) {
    setPlayer((cur) => (cur === id ? null : id));
  }

  function toggleStealer(id: PlayerId) {
    setStealer((cur) => (cur === id ? null : id));
  }

  function handleSubmit() {
    if (!player) return;
    const line = stealer ? `${player} to ${stealer}` : `${player} to`;
    onSubmit(line);
    setPlayer(null);
    setStealer(null);
  }

  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Turnover</h3>

      <div className={styles.section}>
        <div className={shared.label}>Player (committed turnover)</div>
        <div className={shared.grid}>
          {options.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${shared.btn} ${player === p.id ? shared.btnSelected : ""}`}
              onClick={() => togglePlayer(p.id)}
              title={p.displayName}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={shared.label}>Steal by (optional)</div>
        <div className={shared.grid}>
          {stealerOptions.map((p) => (
            <button
              key={`s-${p.id}`}
              type="button"
              className={`${shared.btn} ${stealer === p.id ? shared.btnSelected : ""}`}
              onClick={() => toggleStealer(p.id)}
              title={p.displayName}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={shared.submit}
        disabled={!player}
        onClick={handleSubmit}
      >
        Log Turnover
      </button>
    </div>
  );
}
