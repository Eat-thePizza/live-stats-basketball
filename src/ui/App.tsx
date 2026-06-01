import { useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import NewGameModal from "./NewGameModal";
import RosterEditor from "./RosterEditor";
import StatsTable from "./StatsTable";
import CommandHistory from "./CommandHistory";
import CommandInput from "./CommandInput";
import ShotPanel from "./panels/ShotPanel";
import FreeThrowPanel from "./panels/FreeThrowPanel";
import ReboundPanel from "./panels/ReboundPanel";
import TurnoverPanel from "./panels/TurnoverPanel";
import LineupPanel from "./panels/LineupPanel";
import PossessionPanel from "./panels/PossessionPanel";
import TimeoutQuarterPanel from "./panels/TimeoutQuarterPanel";
import { useGameStore, loadGame } from "@/store/gameStore";
import { toCSV, toGameLogTxt, toMarkdownRecap } from "@/core/export";
import { buildStage2Json } from "@/stage2/exportJson";
import { buildZip } from "@/core/zip";
import { useHashRoute, matchClipsRoute, matchProjectRoute } from "./useHashRoute";
import ClipsView from "./ClipsView";
import { getViewMode } from "./getViewMode";
import ProjectLandingPage from "./ProjectLandingPage";
import { formatElapsed } from "@/core/clock";
import styles from "./App.module.css";

type MobileTab = "panels" | "stats" | "history";

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadBytes(filename: string, bytes: Uint8Array, mime: string) {
  // Wrap in ArrayBuffer slice to keep TS Blob ctor happy.
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestampStr(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const mode = getViewMode(
    typeof window !== "undefined" ? window.location.hostname : "",
    typeof window !== "undefined" ? window.location.search : "",
  );
  if (mode === "landing") {
    return <ProjectLandingPage />;
  }
  return <MainApp />;
}

// Note: the #/project hash route is matched inside MainApp so the React
// hooks order stays consistent across renders. See MainApp below.

function MainApp() {
  const { state, submit, newGameWithLineup, setRoster, endGame } = useGameStore();
  const [mobileTab, setMobileTab] = useState<MobileTab>("stats");
  const [newGameOpen, setNewGameOpen] = useState<boolean>(() => {
    const loaded = loadGame();
    return loaded === null || loaded.lineup.length !== 5;
  });
  const [rosterEditorOpen, setRosterEditorOpen] = useState<boolean>(false);
  // Left panel collapsed state (PC default: collapsed). Ignored on tablet/phone via CSS.
  const [panelsCollapsed, setPanelsCollapsed] = useState<boolean>(true);
  // Controls whether each <details> section (Shot, Free Throw, …) is open.
  // Default: all sections open ("Collapse sections" is the action shown).
  const [sectionsOpen, setSectionsOpen] = useState<boolean>(true);
  // Game-over state lives in GameState so it survives reloads.
  const endedAtMs = state.endedAtMs;
  const gameEnded = endedAtMs !== null;

  const handleEndGame = () => {
    if (!state.tipoff || state.startTime === null) return;
    if (!window.confirm("End the game? This will stop the clock and finalize stats.")) return;
    // Mark the game ended FIRST so the persisted state is safe even if the
    // export below throws — game data is never lost.
    endGame(Date.now() - state.startTime);
    // Build & download a single zip with all artifacts.
    try {
      const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP";
      const date = todayStr();
      const json = buildStage2Json(state);
      const csvName = `${opLabel}_${date}.csv`;
      const logName = `${opLabel}_${date}.txt`;
      const recapName = `${opLabel}_${date}.md`;
      const jsonName = `${json.game_id}.json`;
      const zipName = `game_export_${timestampStr()}.zip`;
      const bytes = buildZip([
        { name: csvName, content: toCSV(state) },
        { name: logName, content: toGameLogTxt(state) },
        { name: recapName, content: toMarkdownRecap(state) },
        { name: jsonName, content: JSON.stringify(json, null, 2) },
      ]);
      downloadBytes(zipName, bytes, "application/zip");
    } catch (err) {
      console.error("End-Game export failed:", err);
      window.alert(
        "End-Game export failed. The game has been ended and your data is saved — try the individual Download CSV / Log / Recap / JSON buttons.",
      );
    }
  };

  // Ticking re-render while the game clock is running; does not touch GameState,
  // so the localStorage auto-save effect is not retriggered by ticks.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!state.tipoff || gameEnded) return;
    const id = setInterval(() => setClockTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.tipoff, gameEnded]);

  const onCourt = state.lineup;
  const elapsedMs = gameEnded
    ? endedAtMs
    : state.tipoff && state.startTime !== null
      ? Date.now() - state.startTime
      : null;
  const gameClockLabel = `Clock: ${formatElapsed(elapsedMs)}${gameEnded ? " (Final)" : ""}`;

  const handleDownloadCSV = () => {
    const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP";
    downloadFile(`${opLabel}_${todayStr()}.csv`, toCSV(state), "text/csv");
  };

  const handleDownloadLog = () => {
    const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP";
    downloadFile(`${opLabel}_${todayStr()}.txt`, toGameLogTxt(state), "text/plain");
  };

  const handleDownloadRecap = () => {
    const opLabel = state.roster.find(p => p.id === "op")?.displayName || "OP";
    downloadFile(`${opLabel}_${todayStr()}.md`, toMarkdownRecap(state), "text/markdown");
  };

  const handleDownloadJSON = () => {
    const json = buildStage2Json(state);
    downloadFile(
      `${json.game_id}.json`,
      JSON.stringify(json, null, 2),
      "application/json",
    );
  };

  const route = useHashRoute();
  const clipsRoute = matchClipsRoute(route);

  const handleOpenClips = () => {
    const json = buildStage2Json(state);
    window.location.hash = `#/games/${encodeURIComponent(json.game_id)}/stage2/clips`;
  };

  if (clipsRoute) {
    return <ClipsView gameId={clipsRoute.gameId} />;
  }
  if (matchProjectRoute(route)) {
    return <ProjectLandingPage />;
  }

  return (
    <div className={styles.app}>
      <Header
        opponentName={state.roster.find(p => p.id === "op")?.displayName || state.opponentName}
        sfPoints={state.sfPoints}
        opPoints={state.opPoints}
        gameClockLabel={gameClockLabel}
        onNewGame={() => setNewGameOpen(true)}
        onOpenRosterEditor={() => setRosterEditorOpen(true)}
        onDownloadCSV={handleDownloadCSV}
        onDownloadLog={handleDownloadLog}
        onDownloadRecap={handleDownloadRecap}
        onDownloadJSON={handleDownloadJSON}
        onOpenClips={handleOpenClips}
      />

      <main className={`${styles.main} ${panelsCollapsed ? styles.panelsCollapsed : ""}`}>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setPanelsCollapsed((c) => !c)}
          aria-expanded={!panelsCollapsed}
          aria-controls="panels-region"
          aria-label="Toggle event logging panel"
          title={panelsCollapsed ? "Show event panels (Shot, Free Throws, …)" : "Hide event panels to widen stats"}
        >
          {panelsCollapsed ? "› Show Event Logging Panel" : "‹ Hide Event Logging Panel"}
        </button>
        <div id="panels-region" className={`${styles.region} ${styles.regionPanels} ${mobileTab === "panels" ? styles.active : ""}`}>
          <section className={styles.panelsSlot} aria-label="Event panels">
            <div className={styles.panelsHeader}>
              <button
                type="button"
                className={styles.sectionsToggle}
                onClick={() => setSectionsOpen((o) => !o)}
                aria-expanded={sectionsOpen}
              >
                {sectionsOpen ? "Collapse sections" : "Expand sections"}
              </button>
            </div>
            {!state.tipoff && !gameEnded && (
              <p className={styles.preTipoffNotice} role="status">
                Game has not started — only Lineup / Sub and Tipoff are
                available until you press Tipoff.
              </p>
            )}
            <fieldset
              className={styles.eventFieldset}
              disabled={!state.tipoff || gameEnded}
            >
              <details open={sectionsOpen}>
                <summary>Shot</summary>
                <ShotPanel roster={state.roster} onCourt={onCourt} onSubmit={submit} />
              </details>
              <details open={sectionsOpen}>
                <summary>Free Throw</summary>
                <FreeThrowPanel roster={state.roster} onCourt={onCourt} onSubmit={submit} />
              </details>
              <details open={sectionsOpen}>
                <summary>Rebound</summary>
                <ReboundPanel roster={state.roster} onCourt={onCourt} onSubmit={submit} />
              </details>
              <details open={sectionsOpen}>
                <summary>Turnover</summary>
                <TurnoverPanel roster={state.roster} onCourt={onCourt} onSubmit={submit} />
              </details>
              <details open={sectionsOpen}>
                <summary>Possession</summary>
                <PossessionPanel roster={state.roster} onCourt={onCourt} onSubmit={submit} />
              </details>
            </fieldset>
            <details open={sectionsOpen}>
              <summary>Lineup</summary>
              <LineupPanel roster={state.roster} onCourt={onCourt} onSubmit={submit} />
            </details>
            <details open={sectionsOpen}>
              <summary>Timeout / Quarter</summary>
              <TimeoutQuarterPanel
                roster={state.roster}
                onCourt={onCourt}
                onSubmit={submit}
                tipoffDone={state.tipoff}
                gameEnded={gameEnded}
                onEndGame={handleEndGame}
              />
            </details>
          </section>
        </div>
        <div className={`${styles.region} ${styles.regionStats} ${mobileTab === "stats" ? styles.active : ""}`}>
          <section className={styles.statsSlot} aria-label="Stats">
            <StatsTable state={state} />
          </section>
        </div>
        <div className={`${styles.region} ${styles.regionHistory} ${mobileTab === "history" ? styles.active : ""}`}>
          <section className={styles.historySlot} aria-label="History and input">
            <CommandInput
              onSubmit={submit}
              disabled={gameEnded}
              placeholder={
                !state.tipoff
                  ? "Type 'tip' or '-l p1 p2 p3 p4 p5' to start the game"
                  : undefined
              }
            />
            <CommandHistory history={state.commandHistory} />
          </section>
        </div>
      </main>

      <nav className={styles.tabbar} role="tablist" aria-label="Sections">
        {(["panels", "stats", "history"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={mobileTab === t}
            className={mobileTab === t ? styles.tabActive : styles.tab}
            onClick={() => setMobileTab(t)}
            type="button"
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <Footer />

      <NewGameModal
        open={newGameOpen}
        roster={state.roster}
        onConfirm={(opponentName, startingLineup, customRoster, showPanels) => {
          if (customRoster) setRoster(customRoster);
          newGameWithLineup(opponentName, startingLineup);
          if (showPanels !== undefined) setPanelsCollapsed(!showPanels);
          setNewGameOpen(false);
        }}
        onCancel={() => setNewGameOpen(false)}
      />

      <RosterEditor
        open={rosterEditorOpen}
        roster={state.roster}
        onSave={(r) => {
          setRoster(r);
          setRosterEditorOpen(false);
        }}
        onCancel={() => setRosterEditorOpen(false)}
      />
    </div>
  );
}
