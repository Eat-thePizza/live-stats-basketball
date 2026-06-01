import styles from "./Header.module.css";
import logoUrl from "@/assets/logo_main.svg";

export interface HeaderProps {
  opponentName: string;
  gameDate?: string;
  gameClockLabel?: string;
  sfPoints?: number;
  opPoints?: number;
  onNewGame: () => void;
  onDownloadCSV: () => void;
  onDownloadLog: () => void;
  onDownloadRecap?: () => void;
  onDownloadJSON?: () => void;
  onOpenClips?: () => void;
  onOpenRosterEditor: () => void;
}

export default function Header({
  opponentName,
  gameDate,
  gameClockLabel,
  sfPoints,
  opPoints,
  onNewGame,
  onDownloadCSV,
  onDownloadLog,
  onDownloadRecap,
  onDownloadJSON,
  onOpenClips,
  onOpenRosterEditor,
}: HeaderProps) {
  const dateStr = gameDate ?? new Date().toLocaleDateString();
  const opLabel = opponentName || "OP";
  return (
    <header className={styles.root}>
      <img
        className={styles.logo}
        src={logoUrl}
        alt="Saint Francis High School logo"
      />
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Saint Francis Basketball Stats</h1>
        <p className={styles.subtitle}>
          Opponent: {opponentName || "\u2014"} &middot; {dateStr}
        </p>
        {gameClockLabel !== undefined && (
          <p className={styles.clock}>{gameClockLabel}</p>
        )}
      </div>

      {(sfPoints !== undefined && opPoints !== undefined) && (
        <div className={styles.scoreboard} aria-label="Live scoreboard">
          <span className={styles.scoreTeam}>SF</span>
          <span className={styles.scoreVal}>{sfPoints}</span>
          <span className={styles.scoreSep}>:</span>
          <span className={styles.scoreVal}>{opPoints}</span>
          <span className={styles.scoreTeam}>{opLabel}</span>
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={onNewGame}>
          New Game
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onOpenRosterEditor}
        >
          Roster
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onDownloadCSV}
        >
          Download CSV
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onDownloadLog}
        >
          Download Log
        </button>
        {onDownloadRecap !== undefined && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onDownloadRecap}
          >
            Download Recap
          </button>
        )}
        {onDownloadJSON !== undefined && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onDownloadJSON}
          >
            Download JSON
          </button>
        )}
        {onOpenClips !== undefined && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onOpenClips}
          >
            Clips
          </button>
        )}
      </div>
    </header>
  );
}
