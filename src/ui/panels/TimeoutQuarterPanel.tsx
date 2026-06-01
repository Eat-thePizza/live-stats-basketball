import type { PanelProps } from "./types";
import shared from "./panelShared.module.css";
import styles from "./TimeoutQuarterPanel.module.css";

export interface TimeoutQuarterPanelProps extends PanelProps {
  tipoffDone?: boolean;
  gameEnded?: boolean;
  onEndGame?: () => void;
}

export default function TimeoutQuarterPanel({
  onSubmit,
  tipoffDone = false,
  gameEnded = false,
  onEndGame,
}: TimeoutQuarterPanelProps) {
  return (
    <div className={shared.panel}>
      <h3 className={shared.title}>Timeout / Quarter</h3>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${shared.submit} ${styles.big}`}
          onClick={() => onSubmit("-t")}
          disabled={gameEnded}
        >
          Timeout
        </button>
        <button
          type="button"
          className={`${shared.submit} ${styles.big}`}
          onClick={() => onSubmit("---")}
          disabled={gameEnded}
        >
          End Quarter
        </button>
        <button
          type="button"
          className={`${shared.submit} ${styles.big}`}
          onClick={() => onSubmit("tip")}
          disabled={tipoffDone || gameEnded}
        >
          {tipoffDone ? "Clock Running" : "Tipoff"}
        </button>
        <button
          type="button"
          className={`${shared.submit} ${styles.big} ${styles.endGame}`}
          onClick={() => onEndGame?.()}
          disabled={!tipoffDone || gameEnded}
          title={!tipoffDone ? "Available after tipoff" : "End the game"}
        >
          {gameEnded ? "Game Ended" : "End Game"}
        </button>
      </div>
    </div>
  );
}
