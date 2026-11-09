# Task: journal one working session

A condensed transcript of one Claude Code working session on MealPlanner is at the path under
**Run context**. It holds user and assistant text only; tool results were dropped, and lines like
`[Edit path]` / `[Bash: …]` mark actions that were taken, and `--- YYYY-MM-DD ---` lines mark the local date where a new day starts. Date each entry by the day its work happened.

## Steps
1. Read `README.md` for the purpose, file list and entry template, and follow them exactly.
2. Read the transcript. Decide whether it's **journal-worthy**: something was built, fixed,
   deployed, decided, learned, broken or discovered. A quick question, a trivial edit or an
   abandoned start is not. In that case write nothing and reply `NO_CHANGES: trivial session`.
3. Check `log/` for an entry covering the same session (same session id in its header, or same
   date and topic). If there is one, update it instead of creating a duplicate.
4. Write `log/<session-date>-<short-kebab-slug>.md` using the template. Take the date from the
   transcript timestamps (local date, YYYY-MM-DD). Put the session id in the `session:` line.
   Be specific: name files, commits, branches, Firebase projects (dev vs production) and what was
   or was not deployed. Record approaches that failed and why. A long session that covered several
   unrelated pieces of work may get one entry per piece (at most 4).
5. Fold the durable items into the shared files, following each file's format and ordering:
   - `decisions.md`: real decisions with the why and the alternatives rejected
   - `learnings.md`: reusable lessons grouped by theme, each linking its source log entry
   - `incidents.md`: failures, outages and near-misses, with impact and the guardrail now in place
   - `open-questions.md`: unanswered questions and pending follow-ups (for example a deploy still
     waiting to run); mark ones this session answered as resolved, with the date
   - `timeline.md`: only when a milestone happened (a production release, a new major feature)
6. Never copy secrets, env values, keys, user data or long code blocks from the transcript.
