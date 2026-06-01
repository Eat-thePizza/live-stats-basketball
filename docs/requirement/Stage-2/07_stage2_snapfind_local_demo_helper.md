# Stage 2 Phase 7 Optional — SnapFind Local Demo Helper

## Goal

Document and optionally integrate the local SnapFind demo as a helper tool for semantic video search and debugging.

## Local SnapFind location

```text
/Users/tiliu5/proj-e/snapfind
```

## Intended use

SnapFind should be used as an optional local helper, not as the required core basketball recognition engine.

Potential uses:

- search full game video for candidate moments
- find missed or ambiguous shots
- search phrases such as `player shooting`, `ball near hoop`, `free throw`, `basketball in the air`, `crowded paint`
- compare SnapFind candidate timestamps with command-history timestamps
- collect failure-case examples for evaluation

## Output

Optional candidate timestamp list:

```json
{
  "source": "SnapFind local demo",
  "local_path": "/Users/tiliu5/proj-e/snapfind",
  "candidates": [
    {
      "query": "player shooting",
      "timestamp_sec": 41,
      "confidence": 0.62,
      "notes": "Matches command-history shot event evt_000001"
    }
  ]
}
```

## Acceptance criteria

- local SnapFind path is documented exactly as `/Users/tiliu5/proj-e/snapfind`
- Stage 2 works without SnapFind
- SnapFind candidates can be imported or compared manually
- SnapFind is clearly labeled optional helper/debug tool
