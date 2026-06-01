import { useState } from "react";
import type { PlayerId, ShotType } from "@/core/types";
import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./ShotPanel.module.css";

type Result = "make" | "miss";

export default function ShotPanel({ roster, onCourt, onSubmit }: PanelProps) {
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [shot, setShot] = useState<ShotType | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [secondary, setSecondary] = useState<PlayerId | null>(null);

  const shooterOptions = roster.filter((p) => onCourt.includes(p.id) || p.id === "op");
  const sfOnCourt = roster.filter(
    (p) => onCourt.includes(p.id) && p.id !== "op" && p.id !== player,
  );

  const ready = player !== null && shot !== null && result !== null;

  const showAssist = player !== null && player !== "op" && result === "make";
  const showBlock = player === "op" && result === "miss";
  const showSecondary = showAssist || showBlock;

  function reset() {
    setPlayer(null);
    setShot(null);
    setResult(null);
    setSecondary(null);
  }

  function handlePlayer(id: PlayerId) {
    const next = player === id ? null : id;
    setPlayer(next);
    // Recompute secondary visibility with the new player
    const nextShowAssist = next !== null && next !== "op" && result === "make";
    const nextShowBlock = next === "op" && result === "miss";
    if (!nextShowAssist && !nextShowBlock) setSecondary(null);
  }

  function handleShot(s: ShotType) {
    setShot(shot === s ? null : s);
  }

  function handleResult(r: Result) {
    const next = result === r ? null : r;
    setResult(next);
    const nextShowAssist = player !== null && player !== "op" && next === "make";
    const nextShowBlock = player === "op" && next === "miss";
    if (!nextShowAssist && !nextShowBlock) setSecondary(null);
  }

  function handleSecondary(id: PlayerId) {
    setSecondary(secondary === id ? null : id);
  }

  function handleSubmit() {
    if (!ready) return;
    const parts: string[] = [player!, shot!, result!];
    if (showSecondary && secondary) parts.push(secondary);
    onSubmit(parts.join(" "));
    reset();
  }

  const secondaryLabel = showAssist ? "Assist (optional)" : "Blocked by (optional)";

  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Shot</h3>

      <div className={styles.section}>
        <div className={shared.label}>Player</div>
        <div className={shared.grid}>
          {shooterOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${shared.btn} ${player === p.id ? shared.btnSelected : ""}`}
              onClick={() => handlePlayer(p.id)}
              title={p.displayName}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={shared.label}>Shot Type</div>
        <div className={shared.row}>
          {(["two", "three", "layup"] as ShotType[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`${shared.btn} ${shot === s ? shared.btnSelected : ""}`}
              onClick={() => handleShot(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={shared.label}>Result</div>
        <div className={shared.row}>
          {(["make", "miss"] as Result[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`${shared.btn} ${result === r ? shared.btnSelected : ""}`}
              onClick={() => handleResult(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {showSecondary && (
        <div className={styles.section}>
          <div className={shared.label}>{secondaryLabel}</div>
          <div className={shared.grid}>
            {sfOnCourt.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`${shared.btn} ${secondary === p.id ? shared.btnSelected : ""}`}
                onClick={() => handleSecondary(p.id)}
                title={p.displayName}
              >
                {p.id}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={shared.submit}
        disabled={!ready}
        onClick={handleSubmit}
      >
        Log Shot
      </button>
    </div>
  );
}
