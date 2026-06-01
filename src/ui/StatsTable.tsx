import type { GameState } from "@/core/types";
import type { PlayerStatRow } from "@/core/stats";
import { computePlayerRow, computeTeamRow, computeOffRTG } from "@/core/stats";
import styles from "./StatsTable.module.css";

export interface StatsTableProps {
  state: GameState;
}

const COLUMNS = [
  "Player",
  "2PM/2PA",
  "2P%",
  "3PM/3PA",
  "3P%",
  "OR",
  "DR",
  "TO",
  "STL",
  "AST",
  "BLK",
  "FTM/FTA",
  "FT%",
  "+/-",
  "Points",
] as const;

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function Row({ row, className }: { row: PlayerStatRow; className?: string }) {
  return (
    <tr className={className}>
      <td>{row.displayName}</td>
      <td>{row.twoMadeOverAttempted}</td>
      <td>{fmtPct(row.twoPct)}</td>
      <td>{row.threeMadeOverAttempted}</td>
      <td>{fmtPct(row.threePct)}</td>
      <td>{row.or}</td>
      <td>{row.dr}</td>
      <td>{row.to}</td>
      <td>{row.stl}</td>
      <td>{row.ast}</td>
      <td>{row.blk}</td>
      <td>{row.ftMadeOverAttempted}</td>
      <td>{fmtPct(row.ftPct)}</td>
      <td>{row.plusMinus}</td>
      <td>{row.points}</td>
    </tr>
  );
}

export default function StatsTable({ state }: StatsTableProps) {
  const sfPlayers = state.roster.filter((p) => p.id !== "op");
  const teamRow = computeTeamRow(state);
  const opRow = computePlayerRow(state, "op");
  const sfOffRTG = computeOffRTG(state.sfPoints, state.sfPOSS);
  const opOffRTG = computeOffRTG(state.opPoints, state.opPOSS);
  const onCourt = new Set(state.lineup);
  const opName = state.roster.find((p) => p.id === "op")?.displayName || "OP";

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sfPlayers.map((p) => (
            <Row
              key={p.id}
              row={computePlayerRow(state, p.id)}
              className={onCourt.has(p.id) ? styles.onCourtRow : undefined}
            />
          ))}
          <Row row={teamRow} className={styles.teamRow} />
          <Row row={opRow} />
        </tbody>
      </table>

      <h3 className={styles.otherHeading}>Other Stats</h3>
      <table className={`${styles.table} ${styles.otherTable}`}>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">SF</th>
            <th scope="col">{opName}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Points off turnovers</td>
            <td>{state.sfPOT}</td>
            <td>{state.opPOT}</td>
          </tr>
          <tr>
            <td>Second Chance Points</td>
            <td>{state.sfSP}</td>
            <td>{state.opSP}</td>
          </tr>
          <tr>
            <td>Missed Layups</td>
            <td>{state.sfML ?? 0}</td>
            <td>{state.opML ?? 0}</td>
          </tr>
          <tr>
            <td>OffRTG</td>
            <td>{sfOffRTG}</td>
            <td>{opOffRTG}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
