import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./PossessionPanel.module.css";

export default function PossessionPanel({ onSubmit }: PanelProps) {
  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Team Possession</h3>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${shared.submit} ${styles.big}`}
          onClick={() => onSubmit("-p sf")}
        >
          SF gets ball
        </button>
        <button
          type="button"
          className={`${shared.submit} ${styles.big}`}
          onClick={() => onSubmit("-p op")}
        >
          Opponent gets ball
        </button>
      </div>
    </div>
  );
}
