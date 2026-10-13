import unittest

from tools.protocol_watch import (
    SOURCES,
    changes,
    issue_body,
    read_snapshot,
    relevant_notes,
)


class WatchTests(unittest.TestCase):
    def test_snapshot_roundtrip(self):
        versions = {repo: "v1.0.0" for repo in SOURCES}
        records = {
            repo: {"url": f"https://github.com/{repo}", "notes": ""}
            for repo in SOURCES
        }
        self.assertEqual(read_snapshot(issue_body(versions, records)), versions)

    def test_only_existing_changes_reported(self):
        self.assertEqual(
            changes({"A": "v1", "B": "v2"}, {"A": "v2", "B": "v2", "C": "v1"}),
            {"A": ("v1", "v2")},
        )

    def test_relevant_release_notes(self):
        notes = "Documentation updated\n- Add AnyTLS option\n- Fix XHTTP transport\nRandom typo"
        self.assertEqual(
            relevant_notes(notes),
            ["Add AnyTLS option", "Fix XHTTP transport"],
        )

    def test_missing_snapshot_is_empty(self):
        self.assertEqual(read_snapshot("legacy issue text"), {})


if __name__ == "__main__":
    unittest.main()
