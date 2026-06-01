import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "stage2"))
import _ball_hoop_core as core  # noqa: E402


class TestPickHoopCenter(unittest.TestCase):
    def test_returns_none_when_no_detections(self):
        self.assertIsNone(core.pick_hoop_center([]))

    def test_picks_median_of_highest_conf_per_frame(self):
        dets = [
            {"frame": 0, "x": 100, "y": 200, "confidence": 0.5},
            {"frame": 0, "x": 110, "y": 210, "confidence": 0.9},
            {"frame": 1, "x": 105, "y": 205, "confidence": 0.8},
        ]
        cx, cy = core.pick_hoop_center(dets)
        # Per-frame highest conf → frame 0 picks (110,210), frame 1 picks (105,205)
        # Median of [110,105] = 107, median of [210,205] = 207
        self.assertEqual((cx, cy), (107, 207))


class TestBallUsable(unittest.TestCase):
    def test_short_clip_needs_at_least_5_frames(self):
        self.assertTrue(core.ball_usable(detected=5, total=20))
        self.assertFalse(core.ball_usable(detected=4, total=20))

    def test_long_clip_uses_5pct_threshold(self):
        self.assertTrue(core.ball_usable(detected=20, total=400))
        self.assertFalse(core.ball_usable(detected=10, total=400))

    def test_zero_total_is_not_usable(self):
        self.assertFalse(core.ball_usable(detected=0, total=0))


class TestSelectDebugFrames(unittest.TestCase):
    def test_returns_first_peak_last(self):
        track = [
            {"frame": 5, "x": 1, "y": 1, "confidence": 0.4},
            {"frame": 10, "x": 1, "y": 1, "confidence": 0.95},
            {"frame": 30, "x": 1, "y": 1, "confidence": 0.6},
        ]
        idx = core.select_debug_frames(track)
        self.assertEqual(idx, [5, 10, 30])

    def test_empty_track_returns_empty(self):
        self.assertEqual(core.select_debug_frames([]), [])

    def test_dedup_when_first_equals_peak(self):
        track = [
            {"frame": 5, "x": 1, "y": 1, "confidence": 0.95},
            {"frame": 30, "x": 1, "y": 1, "confidence": 0.6},
        ]
        idx = core.select_debug_frames(track)
        self.assertEqual(idx, [5, 30])


class TestStubResult(unittest.TestCase):
    def test_dry_run_result_has_zero_detections_and_warning(self):
        clip = {
            "clip_id": "shot_000001",
            "event_id": "evt_000001",
            "raw_command": "+00:41 alden layup make wes",
            "clip_path": "clips/shot_000001.mp4",
        }
        r = core.stub_result(clip)
        self.assertFalse(r["hoop_detected"])
        self.assertEqual(r["ball_detected_frame_count"], 0)
        self.assertEqual(r["ball_track"], [])
        self.assertEqual(r["clip_id"], "shot_000001")
        self.assertEqual(r["event_id"], "evt_000001")
        self.assertEqual(r["raw_command"], "+00:41 alden layup make wes")
        self.assertIn("dry-run", " ".join(r["warnings"]).lower())


class TestEmptyFailureResult(unittest.TestCase):
    def test_failure_carries_message(self):
        clip = {
            "clip_id": "shot_000002",
            "event_id": "evt_000002",
            "raw_command": "+00:30 wes three make",
            "clip_path": "clips/shot_000002.mp4",
        }
        r = core.empty_failure_result(clip, "boom")
        self.assertEqual(r["clip_id"], "shot_000002")
        self.assertEqual(r["warnings"], ["clip failed: boom"])
        self.assertFalse(r["hoop_detected"])
        self.assertEqual(r["ball_track"], [])


class TestLoadManifest(unittest.TestCase):
    def test_loads_clip_manifest_fixture(self):
        fixture = (
            ROOT
            / "tests"
            / "fixtures"
            / "stage2"
            / "clip_manifest_for_detection.json"
        )
        manifest = core.load_manifest(fixture)
        self.assertEqual(manifest["game_id"], "game_test")
        self.assertEqual(len(manifest["clips"]), 1)


if __name__ == "__main__":
    unittest.main()
