import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { buildClipManifest } from "@/stage2/clipManifest";
import type { ClipSettings } from "@/stage2/clipManifestTypes";
import type { Stage2Json } from "@/stage2/types";
import styles from "./ClipsView.module.css";

interface ClipsViewProps {
  gameId: string;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ClipsView({ gameId }: ClipsViewProps) {
  const [timeline, setTimeline] = useState<Stage2Json | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ClipSettings>({
    tipoff_time_sec: 10,
    clip_before_sec: 4,
    clip_after_sec: 3,
    include_free_throws: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const manifest = useMemo(
    () => (timeline ? buildClipManifest(timeline, settings) : null),
    [timeline, settings],
  );

  const readFileText = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsText(f);
    });

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await readFileText(f);
      const json = JSON.parse(text) as Stage2Json;
      if (json?.export_type !== "stage2_json_game_log") {
        throw new Error("Not a Stage 2 JSON file");
      }
      setTimeline(json);
    } catch (err) {
      setError((err as Error).message);
      setTimeline(null);
    }
  };

  const onDownload = () => {
    if (!manifest) return;
    downloadJson(`${manifest.game_id}.clips.json`, manifest);
  };

  const update = (k: keyof ClipSettings, v: number | boolean) =>
    setSettings(s => ({ ...s, [k]: v }));

  const clipCount = manifest?.clips.length ?? 0;
  const clipNoun = clipCount === 1 ? "clip" : "clips";

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Stage 2 Clip Extraction</h2>
      <p className={styles.gameId}>
        Game: <code>{gameId}</code>
      </p>

      <div className={styles.fieldRow}>
        <label htmlFor="timeline-file" className={styles.label}>
          Timeline JSON
        </label>
        <input
          id="timeline-file"
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
        />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Clip settings</legend>
        <label>
          Tipoff time (sec)
          <input
            type="number"
            min={0}
            value={settings.tipoff_time_sec}
            onChange={e => update("tipoff_time_sec", Number(e.target.value))}
          />
        </label>
        <label>
          Before (sec)
          <input
            type="number"
            min={0}
            value={settings.clip_before_sec}
            onChange={e => update("clip_before_sec", Number(e.target.value))}
          />
        </label>
        <label>
          After (sec)
          <input
            type="number"
            min={0}
            value={settings.clip_after_sec}
            onChange={e => update("clip_after_sec", Number(e.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!settings.include_free_throws}
            onChange={e => update("include_free_throws", e.target.checked)}
          />
          Include free throws
        </label>
      </fieldset>

      {timeline === null ? (
        <p className={styles.empty}>Load a timeline JSON to compute clips.</p>
      ) : (
        <p className={styles.summary}>{`${clipCount} ${clipNoun} planned.`}</p>
      )}

      {manifest && manifest.clips.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>clip_id</th>
              <th>event</th>
              <th>start</th>
              <th>end</th>
              <th>duration</th>
            </tr>
          </thead>
          <tbody>
            {manifest.clips.map(c => (
              <tr key={c.clip_id}>
                <td>{c.clip_id}</td>
                <td>{c.raw_command}</td>
                <td>{c.video_start_sec}</td>
                <td>{c.video_end_sec}</td>
                <td>{c.duration_sec}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onDownload}
          disabled={manifest === null}
        >
          Download manifest
        </button>
        <a className={styles.back} href="#/">
          ← Back to live tracking
        </a>
      </div>
    </div>
  );
}
