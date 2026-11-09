#!/usr/bin/env python3
"""
Condense a Claude Code session transcript (.jsonl) for the MealPlanner journal.

Keeps only the human's text turns and the assistant's text replies, plus a one-line
marker for each file-changing tool call (so the journal can tell "something was built"
from "just chatted"). Drops tool results, thinking, attachments, system reminders and
any large blob. Truncates to ~60k characters, keeping the start and the end.

Usage:
  python3 -I extract-transcript.py <transcript.jsonl> [--max-chars 60000] [--out FILE]
  python3 -I extract-transcript.py <transcript.jsonl> --stats   # JSON stats only

Stats JSON: {"user_turns", "assistant_turns", "edits", "chars", "truncated", "session_id", "first_ts", "last_ts"}
Standard library only.
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

NOISE = re.compile(
    r"<(system-reminder|command-name|command-message|command-args|local-command-stdout|"
    r"local-command-stderr|user-prompt-submit-hook|bash-stdout|bash-stderr)>.*?</\1>",
    re.S,
)
BLOB = 4000          # any single turn longer than this is clipped in the middle
FILE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}


def clean(text: str) -> str:
    text = NOISE.sub("", text)
    text = re.sub(r"data:[\w/+.-]+;base64,[A-Za-z0-9+/=]{100,}", "[base64 blob]", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) > BLOB:
        text = text[: BLOB // 2] + "\n[... clipped ...]\n" + text[-BLOB // 2 :]
    return text


def tool_marker(block: dict) -> str | None:
    name = block.get("name", "")
    inp = block.get("input") or {}
    if name in FILE_TOOLS:
        return f"[{name} {inp.get('file_path') or inp.get('notebook_path') or ''}]"
    if name == "Bash" and inp.get("description"):
        return f"[Bash: {str(inp['description'])[:120]}]"
    return None


def local_date(ts: str) -> str | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone().date().isoformat()
    except ValueError:
        return None


def extract(path: Path) -> tuple[list[str], dict]:
    turns: list[str] = []
    last_day: str | None = None
    stats = {"user_turns": 0, "assistant_turns": 0, "edits": 0, "session_id": None,
             "first_ts": None, "last_ts": None}
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = rec.get("type")
            if kind not in ("user", "assistant") or rec.get("isMeta") or rec.get("isSidechain"):
                continue
            stats["session_id"] = stats["session_id"] or rec.get("sessionId")
            ts = rec.get("timestamp")
            if ts:
                stats["first_ts"] = stats["first_ts"] or ts
                stats["last_ts"] = ts
            content = (rec.get("message") or {}).get("content")
            parts: list[str] = []
            markers: list[str] = []
            if isinstance(content, str):
                parts.append(content)
            elif isinstance(content, list):
                for b in content:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "text":
                        parts.append(b.get("text", ""))
                    elif b.get("type") == "tool_use" and kind == "assistant":
                        m = tool_marker(b)
                        if m:
                            markers.append(m)
                            if b.get("name") in FILE_TOOLS:
                                stats["edits"] += 1
            text = clean("\n".join(parts))
            if kind == "user":
                if not text or text.startswith("[Request interrupted"):
                    continue
                stats["user_turns"] += 1
                day = local_date(ts) if ts else None
                if day and day != last_day:
                    turns.append(f"--- {day} ---")   # lets the journal date each piece of work
                    last_day = day
                turns.append(f"### USER\n{text}")
            else:
                if text:
                    stats["assistant_turns"] += 1
                    turns.append(f"### ASSISTANT\n{text}")
                if markers:
                    turns.append(" ".join(markers))
    return turns, stats


def truncate(body: str, limit: int) -> tuple[str, bool]:
    if len(body) <= limit:
        return body, False
    head = int(limit * 0.4)
    tail = limit - head
    return body[:head] + "\n\n[... middle of session omitted ...]\n\n" + body[-tail:], True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("--max-chars", type=int, default=60000)
    ap.add_argument("--out")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    path = Path(args.transcript)
    if not path.is_file():
        print(f"no such transcript: {path}", file=sys.stderr)
        return 2
    turns, stats = extract(path)
    body, truncated = truncate("\n\n".join(turns), args.max_chars)
    stats.update(chars=len(body), truncated=truncated)
    if args.stats:
        print(json.dumps(stats))
        return 0
    header = (f"<!-- condensed transcript: session={stats['session_id']} "
              f"{stats['first_ts']} -> {stats['last_ts']} user_turns={stats['user_turns']} "
              f"edits={stats['edits']} truncated={truncated} -->\n\n")
    out = header + body + "\n"
    if args.out:
        Path(args.out).write_text(out, encoding="utf-8")
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
