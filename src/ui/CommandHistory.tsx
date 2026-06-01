import styles from "./CommandHistory.module.css";
import type { HistoryEntry } from "@/core/types";
import { formatElapsed } from "@/core/clock";

export interface CommandHistoryProps {
  history: HistoryEntry[];
}

export default function CommandHistory({ history }: CommandHistoryProps) {
  const reversed = history.slice().reverse();
  return (
    <div className={styles.root}>
      <h3 className={styles.heading}>Command History</h3>
      {reversed.length === 0 ? (
        <p className={styles.empty}>(no commands yet)</p>
      ) : (
        <ol className={styles.list}>
          {reversed.map((entry, i) => (
            <li key={history.length - 1 - i}>
              <span className={styles.timestamp}>{formatElapsed(entry.tMs)}</span>
              {"  "}
              {entry.line}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
