# Chamber assets notes (2026-09-24)

## What shipped
- Live `public/chamber/home.mp4` and `open.mp4` re-encoded to 1280x720 H.264 CRF 23, `+faststart`, no audio.
  - home: ~12.1s, ~3.0MB (was ~12.1MB @ 1080p)
  - open: ~8.5s, ~3.1MB (was ~14.2MB @ 1080p)
- Pre-reencode 1080p masters kept under `public/chamber/backup/` (gitignored; excluded from Vite dist).
- Still QA of re-encoded frames: closed codex with gold "THE IMMERSIVE BIBLE", seated table-down POV, candles/vase/tree-relief present; open mid = blank parchment spread; open end = full-frame parchment. No Holy Bible / Old Testament text in sampled frames.

## What was NOT regenerated
- No new Grok Imagine generation on this pass (no live Imagine workflow on the box this run).
- Prior vetted Imagine v2 winners remain at `/workspace/immersive-bible-assets/imagine/v2/`:
  - `home-loop-best.mp4` (~6.0s 720p)
  - `open-pull-best.mp4` (~10.0s 720p)
- If Joe wants a shorter true-forward flame loop or a cleaner physical-hinge open, swap after watching full clips (malfunction checklist: ping-pong flame, morph/rubber book, dissolve zoom, frozen secondary candles, lighting not reacting, gold text warp, fuzzy parchment, loop seams). Prefer forward seamless loop over ping-pong; prefer hinge + camera push over morph.

## App wiring
- Dual video crossfade in `chamber.tsx` (home held until open can play).
- Veil 850ms CSS; navigate on `transitionend` with 900ms failsafe (`NAV_AFTER_VEIL_MS`).
- Open failsafe still 11000ms.
