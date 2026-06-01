export function buildStage2JsonFromLines(rawLines, ctx, opts = {}) {
    const lines = rawLines.map(l => stripListPrefix(l).trimEnd());
    const commands = lines.map((raw_command, i) => ({ command_index: i, raw_command }));
    const events = [];
    let counter = 1;
    for (let i = 0; i < lines.length; i++) {
        const parsed = parseLineToEvents(lines[i], i);
        for (const e of parsed) {
            events.push({ ...e, event_id: padEventId(counter++) });
        }
    }
    return {
        game_id: ctx.game_id,
        source: "web_ui_command_history",
        export_type: "stage2_json_game_log",
        exported_at: opts.exportedAt ?? new Date().toISOString(),
        game_context: {
            game_date: ctx.game_date,
            opponent: ctx.opponent,
            opponent_alias: "op",
            home_team_label: "sf",
        },
        commands,
        events,
    };
}
export function buildStage2Json(state, opts = {}) {
    const lines = state.commandHistory.map(h => formatHistoryLine(h));
    const date = formatLocalDate(state.createdAt ?? Date.now());
    // Determine opponent: prefer raw opponentName; if blank, use roster[op] only
    // when its displayName is non-default ("OP" is the placeholder).
    const rawOpName = (state.opponentName ?? "").trim();
    const rosterOpName = (state.roster.find(p => p.id === "op")?.displayName ?? "").trim();
    const opponentDisplay = rawOpName !== ""
        ? rawOpName
        : rosterOpName !== "" && rosterOpName.toLowerCase() !== "op"
            ? rosterOpName
            : "";
    const slug = sanitizeSlug(opponentDisplay);
    const compactDate = date.replace(/-/g, "");
    const game_id = slug ? `game_${compactDate}_${slug}` : `game_${compactDate}`;
    return buildStage2JsonFromLines(lines, {
        game_id,
        game_date: date,
        opponent: opponentDisplay || null,
    }, opts);
}
export function deriveGameIdFromFilename(basenameNoExt) {
    return sanitizeSlug(basenameNoExt);
}
// ---------- parsing ----------
const CTRL_WARNING = "Preserved current UI control command without Stage 2 semantic interpretation";
export function parseLineToEvents(rawInput, command_index) {
    const raw_command = stripListPrefix(rawInput).trimEnd();
    // Optional +MM:SS prefix
    const clockMatch = raw_command.match(/^\+(\d{1,2}):(\d{2})(?:\s+(.*))?$/);
    let clock_text = null;
    let elapsed_sec = null;
    let body;
    if (clockMatch) {
        const mm = parseInt(clockMatch[1], 10);
        const ss = parseInt(clockMatch[2], 10);
        clock_text = `+${pad2(mm)}:${pad2(ss)}`;
        elapsed_sec = mm * 60 + ss;
        body = (clockMatch[3] ?? "").trim();
    }
    else {
        body = raw_command.trim();
    }
    const baseFields = {
        command_index,
        raw_command,
        clock_text,
        elapsed_sec,
        video_timestamp_sec: elapsed_sec,
    };
    const tokens = body.length === 0 ? [] : body.split(/\s+/);
    if (tokens.length === 0) {
        return [
            makeEvent(baseFields, {
                event_type: "control_or_unknown",
                warnings: [CTRL_WARNING],
            }),
        ];
    }
    // Special: tip
    if (tokens.length === 1 && tokens[0] === "tip") {
        return [makeEvent(baseFields, { event_type: "tip" })];
    }
    // UI control: ---, -t, -p, -s, -l ...
    if (tokens[0] === "---" || tokens[0].startsWith("-")) {
        return [
            makeEvent(baseFields, {
                event_type: "control_or_unknown",
                warnings: [CTRL_WARNING],
            }),
        ];
    }
    const isOp = tokens[0] === "op";
    const team = isOp ? "op" : "home";
    const player = isOp ? null : tokens[0];
    const rest = tokens.slice(1);
    // Rebound (single token)
    if (rest.length === 1 && (rest[0] === "or" || rest[0] === "dr" || rest[0] === "reb")) {
        const evType = rest[0] === "or"
            ? "offensive_rebound"
            : rest[0] === "dr"
                ? "defensive_rebound"
                : "rebound";
        return [makeEvent(baseFields, { event_type: evType, team, player })];
    }
    // Turnover
    if (rest[0] === "to") {
        const related = rest[1] ?? null;
        return [
            makeEvent(baseFields, {
                event_type: "turnover",
                team,
                player,
                related_player: related,
            }),
        ];
    }
    // Free throws: PLAYER ft RESULT [RESULT...]
    if (rest[0] === "ft") {
        const results = rest.slice(1);
        if (results.length === 0) {
            return [
                makeEvent(baseFields, {
                    event_type: "control_or_unknown",
                    warnings: ["Unrecognized command"],
                }),
            ];
        }
        return results.map(r => {
            const norm = normalizeResult(r);
            return makeEvent(baseFields, {
                event_type: "free_throw",
                team,
                player,
                shot_type: "free_throw",
                result: norm.result,
                warnings: norm.warning ? [norm.warning] : [],
            });
        });
    }
    // Shot: PLAYER SHOT RESULT [ASSIST_OR_BLOCKER]
    if (rest.length >= 2) {
        const shotTok = rest[0];
        const resultTok = rest[1];
        const fourth = rest[2] ?? null;
        const shot_type = normalizeShotType(shotTok);
        if (shot_type === null) {
            return [
                makeEvent(baseFields, {
                    event_type: "control_or_unknown",
                    warnings: ["Unrecognized command"],
                }),
            ];
        }
        const norm = normalizeResult(resultTok);
        let assist_player = null;
        let related_player = null;
        if (fourth) {
            if (norm.result === "make")
                assist_player = fourth;
            else
                related_player = fourth; // blocker on a miss
        }
        return [
            makeEvent(baseFields, {
                event_type: "shot",
                team,
                player,
                shot_type,
                result: norm.result,
                assist_player,
                related_player,
                warnings: norm.warning ? [norm.warning] : [],
            }),
        ];
    }
    return [
        makeEvent(baseFields, {
            event_type: "control_or_unknown",
            warnings: ["Unrecognized command"],
        }),
    ];
}
// ---------- helpers ----------
function makeEvent(base, overrides) {
    return {
        event_id: "evt_000000", // overwritten by buildStage2JsonFromLines
        ...base,
        team: null,
        player: null,
        shot_type: null,
        result: null,
        assist_player: null,
        related_player: null,
        warnings: [],
        ...overrides,
    };
}
function normalizeShotType(tok) {
    switch (tok) {
        case "two":
            return "two";
        case "three":
            return "three";
        case "3":
            return "three";
        case "layup":
            return "layup";
        case "jumper":
        case "midrange":
        case "paint":
        case "floater":
        case "hook":
            return "two";
        case "ft":
            return "free_throw";
        default:
            return null;
    }
}
function normalizeResult(tok) {
    switch (tok) {
        case "make":
        case "made":
        case "score":
            return { result: "make", warning: null };
        case "miss":
        case "missed":
            return { result: "miss", warning: null };
        default:
            return { result: null, warning: "Unrecognized result" };
    }
}
function stripListPrefix(s) {
    return s.replace(/^\s*\d+\.\s+/, "");
}
function pad2(n) {
    return n.toString().padStart(2, "0");
}
function padEventId(n) {
    return `evt_${n.toString().padStart(6, "0")}`;
}
function formatHistoryLine(entry) {
    if (entry.tMs === null)
        return entry.line;
    return `${formatElapsedLocal(entry.tMs)} ${entry.line}`;
}
// Local copy of clock.ts formatElapsed so this module has zero runtime
// dependency on src/core/* (only `import type` from core/types).
function formatElapsedLocal(tMs) {
    if (tMs === null)
        return "--:--";
    const safe = Math.max(0, Math.floor(tMs / 1000));
    const mm = Math.floor(safe / 60).toString().padStart(2, "0");
    const ss = (safe % 60).toString().padStart(2, "0");
    return `+${mm}:${ss}`;
}
function formatLocalDate(ts) {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    return `${yyyy}-${mm}-${dd}`;
}
export function sanitizeSlug(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
