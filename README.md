# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/sylaxai/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/sylaxai/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, tiny, vanilla-JS frontend for make.fun, made of static files with no build step. It reads make.fun's public API (read-only, no sign-in) and shows the live bounty board with each bounty's live pot, entry fee, time left and entries; a bounty's page with its summary, description, rules and live rewards table; that bounty's leaderboard; and an account's public profile — each reachable by a link and by its own URL (`#/`, `#/bounty/<slug>`, `#/bounty/<slug>/leaderboard`, `#/profile/<handle>`).

Speed and performance: the first load is only the shell, the API cache and the formatters — the views load on demand. API answers are cached and revalidated with ETags (a repeat inside the same minute is a 304 with no body), long lists are paginated client-side, and the time-left labels tick in place without refetching or rebuilding the page. The footer shows the live request count.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080

---

<sub>Entered on [make.fun](https://make.fun/?ref=wgbpxxkc&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
