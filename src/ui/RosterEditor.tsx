import { useEffect, useState } from "react";
import type { Player, Roster } from "@/core/types";
import styles from "./RosterEditor.module.css";

export interface RosterEditorProps {
  open: boolean;
  roster: Roster;
  onSave: (roster: Roster) => void;
  onCancel: () => void;
}

interface Row {
  id: string;
  displayName: string;
}

function splitRoster(roster: Roster): { editable: Row[]; op: Player | null } {
  const editable: Row[] = [];
  let op: Player | null = null;
  for (const p of roster) {
    if (p.id === "op") op = p;
    else editable.push({ id: p.id, displayName: p.displayName });
  }
  return { editable, op };
}

export default function RosterEditor({ open, roster, onSave, onCancel }: RosterEditorProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [opEntry, setOpEntry] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const { editable, op } = splitRoster(roster);
      setRows(editable);
      setOpEntry(op);
      setError(null);
    }
  }, [open, roster]);

  if (!open) return null;

  const updateRow = (index: number, field: "id" | "displayName", value: string) => {
    setRows((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { id: "", displayName: "" }]);
  };

  const handleSave = () => {
    const normalized = rows.map((r) => ({
      id: r.id.trim().toLowerCase(),
      displayName: r.displayName.trim(),
    }));
    for (const r of normalized) {
      if (!r.id) {
        setError("Every player id must be non-empty.");
        return;
      }
      if (!r.displayName) {
        setError("Every display name must be non-empty.");
        return;
      }
    }
    const ids = new Set<string>();
    for (const r of normalized) {
      if (ids.has(r.id)) {
        setError(`Duplicate player id: "${r.id}".`);
        return;
      }
      ids.add(r.id);
    }
    if (ids.has("op")) {
      setError('Player id "op" is reserved for the opponent.');
      return;
    }
    const finalRoster: Roster = [
      ...normalized,
      opEntry ?? { id: "op", displayName: "Opponent" },
    ];
    setError(null);
    onSave(finalRoster);
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-editor-title"
    >
      <div className={styles.dialog}>
        <h2 id="roster-editor-title" className={styles.title}>Edit Roster</h2>
        <div className={styles.list}>
          {rows.map((row, i) => {
            const idId = `roster-row-id-${i}`;
            const nameId = `roster-row-name-${i}`;
            return (
              <div key={i} className={styles.row}>
                <input
                  id={idId}
                  aria-label={`Player ID ${i + 1}`}
                  className={styles.input}
                  type="text"
                  value={row.id}
                  onChange={(e) => updateRow(i, "id", e.target.value)}
                />
                <input
                  id={nameId}
                  aria-label={`Display name ${i + 1}`}
                  className={styles.input}
                  type="text"
                  value={row.displayName}
                  onChange={(e) => updateRow(i, "displayName", e.target.value)}
                />
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={() => removeRow(i)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={addRow}
          >
            Add Player
          </button>
          <div className={styles.actionsRight}>
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
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
