import { useState } from "react";
import type { PlayerId } from "@/core/types";
import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./LineupPanel.module.css";

// UX decision for 6th-click: cap at 5 selections. Clicking an unselected player
// while 5 are already selected is a no-op. User must deselect one first.
export default function LineupPanel({ roster, onCourt, onSubmit }: PanelProps) {
  const sfPlayers = roster.filter((p) => p.id !== "op");
  const subInOptions = roster.filter((p) => p.id !== "op" && !onCourt.includes(p.id));
  const subOutOptions = roster.filter((p) => p.id !== "op" && onCourt.includes(p.id));

  const [selected, setSelected] = useState<PlayerId[]>([]);
  const [subIn, setSubIn] = useState<PlayerId | null>(null);
  const [subOut, setSubOut] = useState<PlayerId | null>(null);

  function toggleSelected(id: PlayerId) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 5) return cur; // cap at 5
      return [...cur, id];
    });
  }

  function handleSetLineup() {
    if (selected.length !== 5) return;
    onSubmit(`-l ${selected.join(" ")}`);
    setSelected([]);
  }

  function handleSub() {
    if (!subIn || !subOut) return;
    onSubmit(`-s ${subIn} ${subOut}`);
    setSubIn(null);
    setSubOut(null);
  }

  function toggleIn(id: PlayerId) {
    setSubIn((cur) => (cur === id ? null : id));
  }
  function toggleOut(id: PlayerId) {
    setSubOut((cur) => (cur === id ? null : id));
  }

  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Lineup</h3>

      <div className={styles.section}>
        <div className={shared.label}>Set Full Lineup ({selected.length}/5)</div>
        <div className={shared.grid}>
          {sfPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${shared.btn} ${selected.includes(p.id) ? shared.btnSelected : ""}`}
              onClick={() => toggleSelected(p.id)}
              title={p.displayName}
            >
              {p.id}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={shared.submit}
          disabled={selected.length !== 5}
          onClick={handleSetLineup}
        >
          Set Lineup
        </button>
      </div>

      <div className={styles.subSection}>
        <div className={shared.label}>Substitution</div>
        <div className={styles.twoCol}>
          <div>
            <div className={styles.colLabel}>Player In</div>
            <div className={shared.grid}>
              {subInOptions.map((p) => (
                <button
                  key={`in-${p.id}`}
                  type="button"
                  className={`${shared.btn} ${subIn === p.id ? shared.btnSelected : ""}`}
                  onClick={() => toggleIn(p.id)}
                  title={p.displayName}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className={styles.colLabel}>Player Out</div>
            <div className={shared.grid}>
              {subOutOptions.map((p) => (
                <button
                  key={`out-${p.id}`}
                  type="button"
                  className={`${shared.btn} ${subOut === p.id ? shared.btnSelected : ""}`}
                  onClick={() => toggleOut(p.id)}
                  title={p.displayName}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={shared.submit}
          disabled={!subIn || !subOut}
          onClick={handleSub}
        >
          Sub
        </button>
      </div>
    </div>
  );
}
