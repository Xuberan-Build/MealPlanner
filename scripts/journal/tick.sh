#!/usr/bin/env bash
# Journal tick: turns finished Claude Code sessions into entries in journey/ (local only).
#
# Trigger: the SessionEnd hook (on-session-end.sh), or by hand.
# Flow: take queued transcripts -> skip trivial ones -> condense -> headless claude writes
#       journey/log/<date>-<slug>.md and folds durable items into decisions/learnings/...
# Headless claude gets Read/Write/Edit/Glob/Grep only, with journey/ as its working dir.
# No git, no network, no uploads. journey/ is gitignored.
#
# Usage: scripts/journal/tick.sh [--dry-run] [--session <transcript.jsonl>]...
#   --session  queue a transcript by hand (e.g. a session started outside this repo)
#   --dry-run  show what would run; the queue is left as it was
# Optional local settings: scripts/journal/journal.env (gitignored), e.g.
#   JOURNAL_MODEL=sonnet  JOURNAL_MAX_BUDGET_USD=2  JOURNAL_MIN_USER_TURNS=3

set -Eeuo pipefail
export JOURNAL_TICK=1

canon() { /bin/realpath "$1" 2>/dev/null || python3 -I -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"; }
SCRIPT_DIR="$(canon "$(dirname "${BASH_SOURCE[0]}")")"
APP_ROOT="$(canon "$SCRIPT_DIR/../..")"
if [ -f "$SCRIPT_DIR/journal.env" ]; then set -a; . "$SCRIPT_DIR/journal.env"; set +a; fi

JOURNEY="$APP_ROOT/journey"
RUN="$JOURNEY/.run"
QUEUE="$RUN/queue"
WORK="$RUN/work"
LOG_DIR="$RUN/logs"
LOCK="$RUN/lock"
PROMPTS="$SCRIPT_DIR/prompts"
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
MODEL="${JOURNAL_MODEL:-opus}"
MAX_TURNS="${JOURNAL_MAX_TURNS:-40}"
MAX_BUDGET_USD="${JOURNAL_MAX_BUDGET_USD:-3}"
MIN_USER_TURNS="${JOURNAL_MIN_USER_TURNS:-3}"
STALE_LOCK=$((2 * 3600))

DRY_RUN=0
MANUAL=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --session) shift; MANUAL+=("$(canon "${1:?--session needs a path}")") ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

mkdir -p "$QUEUE" "$WORK" "$LOG_DIR" "$JOURNEY/log"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/tick-$TS.log"
exec > >(tee -a "$LOG") 2>&1
log()  { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
warn() { log "WARN: $*"; }
now()  { date +%s; }
dry()  { [ "$DRY_RUN" = "1" ]; }

# ---------------------------------------------------------------- lock
if ! mkdir "$LOCK" 2>/dev/null; then
  age=$(( $(now) - $(stat -f %m "$LOCK" 2>/dev/null || now) ))
  if [ "$age" -gt "$STALE_LOCK" ]; then
    warn "clearing stale lock (${age}s old)"; rm -rf "$LOCK"; mkdir "$LOCK"
  else
    # leave any --session paths queued for the running tick
    for p in "${MANUAL[@]+"${MANUAL[@]}"}"; do printf '%s\n' "$p" >>"$QUEUE/sessions.txt"; done
    log "another tick is running (lock ${age}s old); exiting"; exit 0
  fi
fi
echo $$ >"$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

log "journal tick start (dry_run=$DRY_RUN model=$MODEL budget=\$$MAX_BUDGET_USD)"

# ---------------------------------------------------------------- gather the queue
# sessions.txt -> inflight file, so new sessions can queue while this tick runs.
# Leftover inflight/failed files (crashed or failed ticks) are retried.
INFLIGHT="$QUEUE/inflight-$TS.txt"
shopt -s nullglob
pending=("$QUEUE"/inflight-*.txt)
shopt -u nullglob
[ -f "$QUEUE/failed.txt" ] && pending+=("$QUEUE/failed.txt")
if [ -f "$QUEUE/sessions.txt" ]; then
  mv "$QUEUE/sessions.txt" "$QUEUE/taken-$TS.txt"; pending+=("$QUEUE/taken-$TS.txt")
fi
{
  for f in "${pending[@]+"${pending[@]}"}"; do cat "$f"; done
  for p in "${MANUAL[@]+"${MANUAL[@]}"}"; do printf '%s\n' "$p"; done
} | awk 'NF && !seen[$0]++' >"$INFLIGHT.tmp"
if dry; then
  [ -f "$QUEUE/taken-$TS.txt" ] && mv "$QUEUE/taken-$TS.txt" "$QUEUE/sessions.txt"
else
  for f in "${pending[@]+"${pending[@]}"}"; do rm -f "$f"; done
fi
mv "$INFLIGHT.tmp" "$INFLIGHT"

if [ ! -s "$INFLIGHT" ]; then
  rm -f "$INFLIGHT"; log "queue empty"; exit 0
fi

# ---------------------------------------------------------------- headless claude
LAST_RESULT=""
run_claude() { # name prompt_file context
  local name="$1" prompt="$2" ctx="$3"
  local full="$WORK/prompt-$name.md" out="$WORK/out-$name.json"
  { cat "$PROMPTS/_rules.md"; printf '\n---\n\n'; cat "$prompt"
    printf '\n## Run context\n- Today: %s\n- Working directory (journey root): %s\n%s\n' "$(date +%F)" "$JOURNEY" "$ctx"; } >"$full"
  # Least privilege: cwd = journey/, file tools only, anything not pre-approved is refused,
  # --restricted ignores user/project settings and hooks and keeps file tools in the cwd.
  local args=(-p --restricted --strict-mcp-config --no-session-persistence
    --model "$MODEL" --max-turns "$MAX_TURNS" --max-budget-usd "$MAX_BUDGET_USD"
    --permission-mode dontAsk --output-format json
    --tools "Read,Write,Edit,Glob,Grep" --allowedTools "Read,Write,Edit,Glob,Grep"
    --disallowedTools Bash WebFetch WebSearch)
  if dry; then
    log "[dry-run] claude $name: cd $JOURNEY && $CLAUDE_BIN ${args[*]} < $full"
    LAST_RESULT="(dry-run)"; return 0
  fi
  log "claude $name: running"
  if ! ( cd "$JOURNEY" && "$CLAUDE_BIN" "${args[@]}" <"$full" ) >"$out"; then
    warn "claude $name: exited non-zero"
  fi
  local subtype is_error
  subtype="$(jq -r '.subtype // "unknown"' "$out" 2>/dev/null || echo unknown)"
  is_error="$(jq -r 'if has("is_error") then (.is_error|tostring) else "true" end' "$out" 2>/dev/null || echo true)"
  LAST_RESULT="$(jq -r '.result // ""' "$out" 2>/dev/null || true)"
  log "claude $name: subtype=$subtype is_error=$is_error cost=\$$(jq -r '.total_cost_usd // 0' "$out" 2>/dev/null) turns=$(jq -r '.num_turns // "?"' "$out" 2>/dev/null)"
  printf '%s\n' "$LAST_RESULT" | head -n 12 | sed 's/^/    /' || true
  [ "$is_error" = "false" ] && [ "$subtype" = "success" ]
}

# ---------------------------------------------------------------- journal each session
n=0 written=0 failed=0
while IFS= read -r tr; do
  n=$((n + 1))
  if [ ! -f "$tr" ]; then warn "transcript missing, skipping: $tr"; continue; fi
  stats="$(python3 -I "$SCRIPT_DIR/extract-transcript.py" "$tr" --stats)"
  ut="$(jq -r .user_turns <<<"$stats")"; ed="$(jq -r .edits <<<"$stats")"
  sid="$(jq -r '.session_id // "unknown"' <<<"$stats")"
  if [ "$ut" -lt "$MIN_USER_TURNS" ] || { [ "$ed" -eq 0 ] && [ "$ut" -lt $((MIN_USER_TURNS * 2)) ]; }; then
    log "skip trivial session $sid (user_turns=$ut edits=$ed)"; continue
  fi
  cond="$WORK/session-$sid.md"
  python3 -I "$SCRIPT_DIR/extract-transcript.py" "$tr" --out "$cond"
  log "session $sid user_turns=$ut edits=$ed chars=$(wc -c <"$cond" | tr -d ' ')"
  if run_claude "journal-$sid" "$PROMPTS/journal.md" "- Condensed transcript: $cond
- Session id: $sid"; then
    case "$LAST_RESULT" in NO_CHANGES*) ;; *) written=$((written + 1)) ;; esac
  else
    failed=$((failed + 1))
    dry || printf '%s\n' "$tr" >>"$QUEUE/failed.txt"   # retried by the next tick
  fi
done <"$INFLIGHT"
rm -f "$INFLIGHT"
log "done: $n queued, $written journaled, $failed failed (kept for retry)"

# ---------------------------------------------------------------- housekeeping
find "$WORK" -type f -mtime +14 -delete 2>/dev/null || true
find "$LOG_DIR" -type f -name 'tick-*.log' -mtime +30 -delete 2>/dev/null || true
