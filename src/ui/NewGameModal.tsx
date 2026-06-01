import { useEffect, useRef, useState } from "react";
import type { Roster, PlayerId } from "@/core/types";
import styles from "./NewGameModal.module.css";

export interface NewGameModalProps {
  open: boolean;
  roster: Roster;
  onConfirm: (
    opponentName: string,
    startingLineup: PlayerId[],
    customRoster?: Roster,
    showPanels?: boolean,
  ) => void;
  onCancel: () => void;
}

interface ManualRow {
  id: string;
  displayName: string;
}

export default function NewGameModal({ open, roster, onConfirm, onCancel }: NewGameModalProps) {
  const [name, setName] = useState("");
  const [lineup, setLineup] = useState<PlayerId[]>([]);
  const [useDefaultRoster, setUseDefaultRoster] = useState<boolean>(true);
  const [showPanels, setShowPanels] = useState<boolean>(true);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setLineup([]);
      setUseDefaultRoster(true);
      setShowPanels(true);
      setManualRows([
        { id: "", displayName: "" },
        { id: "", displayName: "" },
        { id: "", displayName: "" },
        { id: "", displayName: "" },
        { id: "", displayName: "" },
      ]);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  // When default roster is in use we pick from `roster` prop. Otherwise we must
  // build a custom roster from manualRows before allowing lineup selection.
  const validatedManual = (() => {
    const ids = new Set<string>();
    const cleaned: ManualRow[] = [];
    for (const r of manualRows) {
      const id = r.id.trim().toLowerCase();
      const dn = r.displayName.trim();
      if (!id || !dn) continue;
      if (id === "op") return { ok: false as const, error: '"op" is reserved.' };
      if (ids.has(id)) return { ok: false as const, error: `Duplicate id "${id}".` };
      ids.add(id);
      cleaned.push({ id, displayName: dn });
    }
    if (cleaned.length < 5) {
      return { ok: false as const, error: "Enter at least 5 players." };
    }
    return { ok: true as const, rows: cleaned };
  })();

  const customRosterReady = !useDefaultRoster && validatedManual.ok;
  const activeRoster: Roster = useDefaultRoster
    ? roster
    : customRosterReady
      ? [
          ...validatedManual.rows.map((r) => ({ id: r.id, displayName: r.displayName })),
          { id: "op", displayName: "Opponent" },
        ]
      : roster;

  const lineupSelectionEnabled = useDefaultRoster || customRosterReady;
  const canSubmit = lineup.length === 5 && lineupSelectionEnabled;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const ordered = activeRoster.filter((p) => lineup.includes(p.id)).map((p) => p.id);
    if (useDefaultRoster) {
      onConfirm(name.trim(), ordered, undefined, showPanels);
    } else {
      onConfirm(name.trim(), ordered, activeRoster, showPanels);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) handleSubmit();
    }
  };

  const togglePlayer = (id: PlayerId) => {
    setLineup((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const updateManualRow = (i: number, field: "id" | "displayName", value: string) => {
    setManualRows((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], [field]: value };
      return next;
    });
    setLineup([]); // roster changed — invalidate lineup
  };
  const addManualRow = () => setManualRows((prev) => [...prev, { id: "", displayName: "" }]);
  const removeManualRow = (i: number) => {
    setManualRows((prev) => prev.filter((_, idx) => idx !== i));
    setLineup([]);
  };

  const showManualError =
    !useDefaultRoster && !validatedManual.ok ? validatedManual.error : null;

  const sfPlayers = activeRoster.filter((p) => p.id !== "op");

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-game-modal-title"
    >
      <div className={styles.dialog}>
        <h2 id="new-game-modal-title" className={styles.title}>Start a New Game</h2>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-game-opponent">
            Opponent
          </label>
          <p className={styles.body}>Enter the opponent's name (optional)</p>
          <input
            id="new-game-opponent"
            ref={inputRef}
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <input
              type="checkbox"
              checked={useDefaultRoster}
              onChange={(e) => {
                setUseDefaultRoster(e.target.checked);
                setLineup([]);
              }}
            />{" "}
            Default Roster
          </label>
          <p className={styles.body}>
            {useDefaultRoster
              ? "Using the current default roster."
              : "Manually input roster below (minimum 5 players)."}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <input
              type="checkbox"
              checked={showPanels}
              onChange={(e) => setShowPanels(e.target.checked)}
            />{" "}
            Show Event Logging Panel
          </label>
          <p className={styles.body}>
            {showPanels
              ? "Event logging panel will be visible after the game starts."
              : "Event logging panel will be hidden; you can toggle it later from the side handle."}
          </p>
        </div>

        {!useDefaultRoster && (
          <div className={styles.field}>
            <h3 className={styles.subtitle}>Manual Roster</h3>
            <div className={styles.manualRows}>
              {manualRows.map((row, i) => (
                <div key={i} className={styles.manualRow}>
                  <input
                    aria-label={`Player ID ${i + 1}`}
                    className={styles.input}
                    placeholder="id"
                    type="text"
                    value={row.id}
                    onChange={(e) => updateManualRow(i, "id", e.target.value)}
                  />
                  <input
                    aria-label={`Display name ${i + 1}`}
                    className={styles.input}
                    placeholder="Display Name"
                    type="text"
                    value={row.displayName}
                    onChange={(e) => updateManualRow(i, "displayName", e.target.value)}
                  />
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => removeManualRow(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={addManualRow}
            >
              Add Player
            </button>
            {showManualError && (
              <p className={styles.error} role="alert">{showManualError}</p>
            )}
          </div>
        )}

        <h3 className={styles.subtitle}>Starting Lineup (5 required)</h3>
        {!lineupSelectionEnabled ? (
          <p className={styles.body}>Complete the manual roster above to choose a lineup.</p>
        ) : (
          <div className={styles.lineupGrid}>
            {sfPlayers.map((p) => {
              const selected = lineup.includes(p.id);
              const disabled = !selected && lineup.length >= 5;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.displayName}
                  className={`${styles.playerBtn} ${selected ? styles.playerBtnSelected : ""}`}
                  disabled={disabled}
                  onClick={() => togglePlayer(p.id)}
                >
                  {p.id}
                </button>
              );
            })}
          </div>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
