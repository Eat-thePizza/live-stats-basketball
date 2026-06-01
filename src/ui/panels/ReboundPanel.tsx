import { useState } from "react";
import type { PlayerId } from "@/core/types";
import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./ReboundPanel.module.css";

export default function ReboundPanel({ roster, onCourt, onSubmit }: PanelProps) {
  const [player, setPlayer] = useState<PlayerId | null>(null);

  const options = roster.filter((p) => onCourt.includes(p.id) || p.id === "op");

  function togglePlayer(id: PlayerId) {
    setPlayer((cur) => (cur === id ? null : id));
  }

  function submit(kind: "or" | "dr") {
    if (!player) return;
    onSubmit(`${player} ${kind}`);
    setPlayer(null);
  }

  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Rebound</h3>

      <div className={styles.section}>
        <div className={shared.label}>Player</div>
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

      <div className={styles.actions}>
        <button
          type="button"
          className={shared.submit}
          disabled={!player}
          onClick={() => submit("or")}
        >
          Offensive Rebound
        </button>
        <button
          type="button"
          className={shared.submit}
          disabled={!player}
          onClick={() => submit("dr")}
        >
          Defensive Rebound
        </button>
      </div>
    </div>
  );
}
