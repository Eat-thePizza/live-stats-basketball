import { useState } from "react";
import type { PlayerId } from "@/core/types";
import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./FreeThrowPanel.module.css";

type FtResult = "make" | "miss";

export default function FreeThrowPanel({ roster, onCourt, onSubmit }: PanelProps) {
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [results, setResults] = useState<FtResult[]>([]);

  const options = roster.filter((p) => onCourt.includes(p.id) || p.id === "op");

  const ready = player !== null && results.length > 0;

  function togglePlayer(id: PlayerId) {
    setPlayer((cur) => (cur === id ? null : id));
  }

  function addResult(r: FtResult) {
    setResults((cur) => [...cur, r]);
  }

  function clearResults() {
    setResults([]);
  }

  function reset() {
    setPlayer(null);
    setResults([]);
  }

  function handleSubmit() {
    if (!ready) return;
    onSubmit(`${player} ft ${results.join(" ")}`);
    reset();
  }

  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Free Throws</h3>

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

      <div className={styles.section}>
        <div className={shared.label}>Results</div>
        <div className={styles.resultControls}>
          <button type="button" className={shared.btn} onClick={() => addResult("make")}>
            + Make
          </button>
          <button type="button" className={shared.btn} onClick={() => addResult("miss")}>
            + Miss
          </button>
          <button type="button" className={shared.btn} onClick={clearResults}>
            Clear
          </button>
        </div>
        <div className={shared.pendingList} aria-label="Pending FT results">
          {results.map((r, i) => (
            <span key={i} className={shared.pendingItem}>{r}</span>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={shared.submit}
        disabled={!ready}
        onClick={handleSubmit}
      >
        Log FTs
      </button>
    </div>
  );
}
