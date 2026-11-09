#!/usr/bin/env bash
# Claude Code SessionEnd hook: queue this session's transcript and start a detached journal tick.
# Reads hook JSON on stdin: {"session_id","transcript_path","cwd","reason",...}
# Must return at once and never fail the session exit.

# The tick's own headless claude runs end sessions too; don't journal those.
[ "${JOURNAL_TICK:-}" = "1" ] && exit 0

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$(cd "$DIR/../.." && pwd)/journey/.run"
mkdir -p "$RUN/queue" "$RUN/logs" 2>/dev/null || exit 0

input="$(cat 2>/dev/null || true)"
tp="$(printf '%s' "$input" | /usr/bin/jq -r '.transcript_path // empty' 2>/dev/null || true)"
[ -n "$tp" ] && printf '%s\n' "$tp" >>"$RUN/queue/sessions.txt"

nohup /bin/bash "$DIR/tick.sh" </dev/null >>"$RUN/logs/launcher.log" 2>&1 &
disown 2>/dev/null || true
exit 0
