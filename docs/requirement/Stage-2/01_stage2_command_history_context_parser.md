# Stage 2 Phase 1 — Download JSON Game Log from Existing Command History

## Goal

Add a **Download JSON** button to the existing game-tracking UI. The button should convert the current in-memory **Command History** into a Stage 2 JSON game log and download the JSON file locally.

This phase should **not** create a new import page, should **not** ask the user to upload a TXT file, and should **not** treat the command history as a generic external text document.

The game log already exists in the UI. Stage 2 Phase 1 only needs to export it in a better structured format for later Stage 2 video-processing phases.

## Existing UI Context

The current UI already has a row of buttons in the upper area, including:

```text
New Game | Roster | Download CSV | Download Log | Download Recap
```

Add one more button in the same button group:

```text
Download JSON
```

The UI already displays a `Command History` panel like this:

```text
1. +02:46 alden to
2. +02:41 op layup make
3. +02:33 james three make
4. +02:21 ---
5. +02:10 james layup make alden
6. +01:59 op two make
7. +01:52 ayaan layup miss
8. +01:43 op three make
9. +01:37 -p op
10. +01:36 -p op
11. +01:19 -t
12. +01:12 -s ayaan john
13. +01:05 -p op
14. +01:02 max to
15. +00:51 op to alden
16. +00:41 alden layup make wes
17. +00:26 op ft miss
18. +00:24 op ft make
19. +00:17 op or
20. +00:12 op three miss
21. +00:07 wes three make max
22. +00:00 tip
```

Stage 2 Phase 1 must export this existing command history directly from the UI state.

## Key Product Correction

The command history is already manually entered by the scorekeeper / assistant coach. Therefore, Phase 1 should be treated as deterministic command-history conversion, not AI inference.

Use `warnings` only for commands that cannot be interpreted or for UI control commands that Stage 2 does not yet understand.

Confidence fields belong in later computer-vision phases only, such as ball detection, hoop detection, shooter localization, and court mapping.

## Input

The input is the current UI command-history state.

The implementation should reuse the same data source currently used by:

```text
Download Log button
Download Recap button
```


## New UI Requirement

Add:

```text
Download JSON
```

Recommended button order:

```text
New Game | Roster | Download CSV | Download Log | Download Recap | Download JSON
```

Clicking `Download JSON` should:

1. Read command history from current UI state.
2. Convert the command history into Stage 2 JSON in the browser.
3. Create a local `.json` file with `Blob` / browser download logic.
4. Trigger a browser download.
5. Avoid any server request.

## Game ID Requirement

The exported JSON must include a `game_id`.

Format:

```text
game_YYYYMMDD_OPPONENT
```

If opponent is unavailable:

```text
game_YYYYMMDD
```

Examples:

```text
game_20260118_mountain_view
game_20260118_palo_alto
game_20260118
```

Implementation rules:

- `YYYYMMDD` comes from game date.
- `OPPONENT` comes from opponent name if available.
- Convert opponent name to lowercase.
- Replace spaces with underscores.
- Remove unsafe filename characters.
- Use the same value for the downloaded filename:

```text
game_20260118_mountain_view.json
```

If the UI does not currently store opponent name, implement the JSON export so it still works with only the date:

```text
game_YYYYMMDD.json
```

## Output JSON Schema

The downloaded JSON should follow this structure:

```json
{
  "game_id": "game_20260118_mountain_view",
  "source": "web_ui_command_history",
  "export_type": "stage2_json_game_log",
  "exported_at": "2026-01-18T20:15:30.000Z",
  "game_context": {
    "game_date": "2026-01-18",
    "opponent": "Mountain View",
    "opponent_alias": "op",
    "home_team_label": "sf"
  },
  "commands": [
    {
      "command_index": 0,
      "raw_command": "+02:46 alden to"
    }
  ],
  "events": [
    {
      "event_id": "evt_000001",
      "command_index": 0,
      "raw_command": "+02:46 alden to",
      "clock_text": "+02:46",
      "elapsed_sec": 166,
      "event_type": "turnover",
      "team": "home",
      "player": "alden",
      "shot_type": null,
      "result": null,
      "assist_player": null,
      "related_player": null,
      "warnings": []
    }
  ]
}
```

## Important Player / Team Interpretation

`op` means opponent team.

Player names such as:

```text
alden
james
ayaan
max
wes
john
```

should be treated as player names.



## Required Event Fields

Each event object should include:

```json
{
  "event_id": "evt_000001",
  "command_index": 0,
  "raw_command": "+00:41 alden layup make wes",
  "clock_text": "+00:41",
  "elapsed_sec": 41,
  "video_timestamp_sec": 41,
  "event_type": "shot",
  "team": "sf",
  "player": "alden",
  "shot_type": "layup",
  "result": "make",
  "assist_player": "wes",
  "related_player": null,
  "warnings": []
}
```

Do not include `parse_confidence`.

## Command Interpretation Rules

### Timestamp

Parse `+MM:SS` into elapsed seconds.

Examples:

```text
+02:46 -> 166
+00:41 -> 41
+00:07 -> 7
```

For now:

```text
video_timestamp_sec = elapsed_sec
```

If video offset is added later:

```text
video_timestamp_sec = video_offset_sec + elapsed_sec
```

### Home Team Shot With Shooter and Assist

Pattern:

```text
+MM:SS PLAYER SHOT_TYPE RESULT ASSIST_PLAYER
```

Example:

```text
+02:10 james layup make alden
```

Expected event:

```json
{
  "raw_command": "+02:10 james layup make alden",
  "event_type": "shot",
  "team": "home",
  "player": "james",
  "shot_type": "layup",
  "result": "make",
  "assist_player": "alden",
  "related_player": null,
  "warnings": []
}
```

Example:

```text
+00:41 alden layup make wes
```

Expected event:

```json
{
  "raw_command": "+00:41 alden layup make wes",
  "event_type": "shot",
  "team": "home",
  "player": "alden",
  "shot_type": "layup",
  "result": "make",
  "assist_player": "wes",
  "related_player": null,
  "warnings": []
}
```

### Home Team Shot Where Shooter Is `wes`

Example:

```text
+00:07 wes three make max
```

Expected meaning:

```text
wes made a three, max assisted
```

Expected event:

```json
{
  "raw_command": "+00:07 wes three make max",
  "event_type": "shot",
  "team": "home",
  "player": "wes",
  "shot_type": "three",
  "result": "make",
  "assist_player": "max",
  "related_player": null,
  "warnings": []
}
```

### Home Team Missed Shot

Pattern:

```text
+MM:SS PLAYER SHOT_TYPE miss
```

Example:

```text
+01:52 ayaan layup miss
```

Expected event:

```json
{
  "raw_command": "+01:52 ayaan layup miss",
  "event_type": "shot",
  "team": "home",
  "player": "ayaan",
  "shot_type": "layup",
  "result": "miss",
  "assist_player": null,
  "related_player": null,
  "warnings": []
}
```

### Opponent Shot

Commands beginning with `op` are opponent events.

Examples:

```text
+02:41 op layup make
+01:59 op two make
+01:43 op three make
+00:12 op three miss
+00:26 op ft miss
+00:24 op ft make
```

Expected event style:

```json
{
  "event_type": "shot",
  "team": "op",
  "player": null,
  "shot_type": "three",
  "result": "miss",
  "assist_player": null,
  "related_player": null,
  "warnings": []
}
```

### Shot Type Normalization

Recognize:

```text
two
three
3
layup
jumper
midrange
paint
floater
hook
ft
```

Normalize:

```text
two -> two
three -> three
3 -> three
ft -> free_throw
layup -> layup
```

### Result Normalization

Recognize:

```text
make
made
score
miss
missed
```

Normalize:

```text
make, made, score -> make
miss, missed -> miss
```

### Turnovers

Recognize:

```text
to
```

Examples:

```text
+02:46 alden to
+01:02 max to
+00:51 op to alden
```

Expected interpretations:

```text
+02:46 alden to -> home turnover by alden
+01:02 max to -> home turnover by max
+00:51 op to alden -> opponent turnover, alden related player
```

For `op to alden`:

```json
{
  "event_type": "turnover",
  "team": "op",
  "player": null,
  "related_player": "alden"
}
```

### Rebounds

Recognize:

```text
or -> offensive_rebound
dr -> defensive_rebound
reb -> rebound
```

Example:

```text
+00:17 op or
```

Expected event:

```json
{
  "event_type": "offensive_rebound",
  "team": "op",
  "player": null,
  "assist_player": null,
  "related_player": null,
  "warnings": []
}
```

### Special / UI Control Commands

Preserve commands that are part of the current UI command history but are not normal box-score events.

Examples:

```text
---
-p op
-t
-s ayaan john
tip
```

If these commands already have exact semantics in the current UI code, use those semantics.

If Stage 2 does not need the command yet, preserve it as:

```json
{
  "event_type": "control_or_unknown",
  "raw_command": "-p op",
  "warnings": ["Preserved current UI control command without Stage 2 semantic interpretation"]
}
```

For:

```text
+00:00 tip
```

Use:

```json
{
  "event_type": "tip",
  "team": null,
  "player": null,
  "warnings": []
}
```

## UI Acceptance Criteria

Phase 1 is complete when:

- A `Download JSON` button exists next to the existing buttons.
- Clicking `Download JSON` downloads a local JSON file.
- No new upload page is added.
- No new `/stage2/import-command-history` route is added.
- No server request is required.
- The JSON includes `game_id` in `game_YYYYMMDD_OPPONENT` format when opponent is available.
- The JSON preserves every visible command-history line.
- The JSON preserves command order.
- The JSON includes both `commands` and parsed `events`.
- `+00:07 wes three make max` is parsed as player `wes`, shot type `three`, result `make`, assist player `max`.
- `+00:41 alden layup make wes` is parsed as player `alden`, shot type `layup`, result `make`, assist player `wes`.
- `op` commands are parsed as opponent-team events.
- No event contains `parse_confidence`.
- Unknown or UI control commands are preserved with warnings instead of being dropped.


## CLI Requirement — Convert Existing Game Log File to JSON

In addition to the browser `Download JSON` button, Stage 2 Phase 1 must provide a CLI tool that converts an already downloaded game log file into the same Stage 2 JSON format.

This CLI is needed for existing game log files that were previously exported through the current UI, such as files created by the existing `Download Log` button.

### CLI Input

The CLI input is an existing game log file on disk.



The game log file should contain the same command-history format used by the current web UI, for example:

```text
+02:46 alden to
+02:41 op layup make
+02:33 james three make
+02:21 ---
+02:10 james layup make alden
+01:59 op two make
+01:52 ayaan layup miss
+01:43 op three make
+01:37 -p op
+01:36 -p op
+01:19 -t
+01:12 -s ayaan john
+01:05 -p op
+01:02 max to
+00:51 op to alden
+00:41 alden layup make wes
+00:26 op ft miss
+00:24 op ft make
+00:17 op or
+00:12 op three miss
+00:07 wes three make max
+00:00 tip
```

If the existing downloaded log file includes line numbers such as `1. +02:46 alden to`, the CLI must strip the line number and preserve the actual raw command as `+02:46 alden to`.

### CLI Game ID Rule

When converting an existing game log file, `game_id` must be derived from the input log file name.

Examples:

```text
./logs/game_20260118_mountain_view.log -> game_id = "game_20260118_mountain_view"
./logs/game_20260118_palo_alto.txt -> game_id = "game_20260118_palo_alto"
./logs/game_20260118.log -> game_id = "game_20260118"
```

Rules:

- Use the base filename only.
- Remove the file extension.
- Do not generate a new game ID from the current date when a log file is provided.
- Do not require opponent name separately for CLI conversion.
- Preserve the filename-derived `game_id` exactly after sanitizing unsafe characters.

### CLI Output

By default, the CLI should write the JSON file next to the input log file.

Example:

```text
Input:  ./logs/game_20260118_mountain_view.log
Output: ./logs/game_20260118_mountain_view.json
```

The CLI should also support an optional output path:

```bash
node scripts/stage2/convert_game_log_to_json.js \
  ./logs/game_20260118_mountain_view.log \
  --output ./stage2/game_20260118_mountain_view.json
```

The output JSON schema must be identical to the browser `Download JSON` output schema.

### CLI Required Behavior

The CLI must:

1. Read the input log file from disk.
2. Derive `game_id` from the log file basename.
3. Parse command-history lines using the same parser as the browser `Download JSON` feature.
4. Preserve every valid command-history line in `commands`.
5. Generate parsed `events` using the same interpretation rules as the UI export.
6. Write a local JSON file.
7. Exit with non-zero status if the input file does not exist or cannot be read.
8. Print a short summary after success.

Example success output:

```text
Converted game log to Stage 2 JSON
Input:  ./logs/game_20260118_mountain_view.log
Output: ./logs/game_20260118_mountain_view.json
Game ID: game_20260118_mountain_view
Commands: 22
Events: 22
Warnings: 4
```

### CLI Acceptance Criteria

The CLI requirement is complete when:

- A CLI script exists under `scripts/stage2/`.
- The CLI can convert an existing log file to JSON without opening the web UI.
- `game_id` is derived from the input log file name.
- The output JSON schema matches the browser `Download JSON` schema.
- The CLI and browser export share the same parsing/conversion logic instead of maintaining two separate parsers.
- A log file containing `+00:07 wes three make max` is parsed as player `wes`, shot type `three`, result `make`, and assist player `max`.
- A log file containing line numbers like `21. +00:07 wes three make max` is handled correctly.
- The CLI does not add `parse_confidence`.
