# TODOS

## Deferred v2 features (captured from /plan-eng-review on 2026-04-20)

### 1. Delay tracking ("you were 43ms behind the winner")

**What:** On each round, compute and display per-player delay relative to the winner. Show each contestant "you were Nms late" after every buzz-close with reason `winner`. Optionally show a mini-leaderboard of relative speeds.

**Why:** In the /office-hours design session this was called out as the single most original idea in the spec — the thing that turns a generic buzzer into Jeopardy-level theater. Watching someone say "oh my god I was 47ms behind you" is the moment the app becomes more than a toy.

**Pros:**
- The server already has the data: `Date.now()` on buzz receipt vs. `room.buzzer.openedAt`. No new measurement apparatus needed.
- Elevates the product from "functional buzzer" to "experience."
- Naturally pairs with the server-timestamp fairness caveat — exposing the numbers IS the fairness conversation.

**Cons:**
- UI surface: where does the delay go? Toast, overlay, permanent widget? Requires a mini design pass.
- Privacy: exposing latency can embarrass slower-network friends. Might want per-room opt-in.

**Context:** v1 ships without this but architecturally allows it: server stores per-buzz timestamps, clients only receive `buzz_winner` today. When implementing, extend `BuzzerClosedMessage` with an optional `buzzes: Array<{ playerId, deltaMs }>` populated on `reason: 'winner'` closes. UI: show in a small drawer below the winner overlay. Keep it opt-in per room in settings, default on.

**Depends on / blocked by:** Core buzz mechanics shipping first (Step 8 in the plan). No hard blockers.

---

### 2. Audio feedback

**What:** Add sounds at buzz events: (a) a "pew" when the buzzer OPENs, (b) a distinct "bzzt" the winner hears when they buzzed first, (c) a "click" when any active buzzer is hit, (d) per-player customization — each user can pick their own "I won" sound from a small library.

**Why:** Called out in the user's original "ideas for later" section. Audio is 80% of what makes Jackbox feel alive; a silent buzzer feels sterile. The per-player custom sound adds personality to a friend-group session.

**Pros:**
- Web Audio API is built in, no dependencies.
- Doesn't touch the state machine — pure presentation layer.
- High delight-per-effort ratio.

**Cons:**
- Mobile autoplay policies: first sound has to be user-gesture-initiated (tapping the buzzer counts, so probably fine).
- Custom sound library needs curation (royalty-free, short, not annoying).
- Accessibility: needs a mute toggle.

**Context:** Add a small `lib/audio.ts` on the frontend that pre-loads audio buffers on RoomPage mount, triggers on relevant WS events. Custom sounds: persist choice in localStorage keyed by clientToken. No server involvement.

**Depends on / blocked by:** Core buzz mechanics shipping first. No hard blockers.

---

### 3. Scoring tracker

**What:** After a winner is announced, the questioner sees "Correct / Incorrect" buttons. Correct awards a point to the winner; Incorrect reopens the buzzer for other contestants. Running score visible in PlayerListDrawer. Reset / end-game controls for admin.

**Why:** Pen-and-paper scoring works for v1, but in-app scoring removes friction — especially for Zoom play where nobody can see the host's notepad. Also unlocks "first to 10 points wins" game-end UX.

**Pros:**
- Removes a major coordination step from the game flow.
- Enables future additions: point-value-per-question, wager mode, team scoring.
- The data model is small: `scores: Record<PlayerId, number>` on the Room.

**Cons:**
- Scope creep into game mechanics the current spec explicitly avoided.
- Requires Incorrect flow (re-opens for others — currently the app is agnostic to right/wrong).
- Needs a settings layer: score to win? Reset behavior?

**Context:** Add `ScoringService` parallel to existing services. Add `award_point` / `reopen_for_others` gateway handlers (questioner-only). Persist per-round in the room. UI: small score badges in the roster + a confetti moment on someone hitting the win threshold.

**Depends on / blocked by:** Core buzz mechanics shipping first. Needs a Settings surface on RoomPage (lightweight, admin-only controls).
