# Chamber assets notes (2026-09-24)

## What shipped
- Live `public/chamber/home.mp4` and `open.mp4` re-encoded to 1280x720 H.264 CRF 23, `+faststart`, no audio.
  - home: ~10.0s, ~4.3MB (v3c all-flames; in-app dual-video loop crossfade). Previous 12.1s 720p kept under `public/chamber/backup/home-pre-v3c-20260924.mp4`.
  - open: ~8.9s, ~2.4MB stills-v2 (was ~14.2MB @ 1080p)
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
- Dual **home** loop: two `.chamber-video-home` layers, `.is-front` at opacity 1, ~1.6s CSS xfade; opening still uses `.is-fading` to hide both under open.
- Veil 850ms CSS; navigate on `transitionend` with 900ms failsafe (`NAV_AFTER_VEIL_MS`).
- Open failsafe still 11000ms.

## OPEN stills rebuild v2 (2026-09-24 evening, Europe/London)
Rebuilt chamber OPEN from locked stills as `immersive-bible-assets/imagine/v3/open-pull-stills-v2.mp4` (~8.92s, 1280x720, H.264 yuv420p +faststart, no audio). Prior `open-pull-stills.mp4` rejected for 0.8s xfade ghosting/double-exposure of cover text (“THE IMMERSIVE BIBLE”) and a slideshow feel. New recipe: hold closed-best ~1.4s with very gentle zoom → **hard cut** to half-best ~1.0s gentle zoom → **hard cut** to open-best → continuous zoompan dolly into page center ~3.4s (same geometry, no xfade) → soft ≤0.30s xfade only into blank-parchment-best (matched cream framing) then ease to full-frame blank cream ~3.4s. No long xfades between different book geometries; no AI morph. QA frames in `imagine/v3/qa-stills-v2/`. **Not installed** into `public/chamber`.

## 2026-09-24 open install
- Live open.mp4 = open-pull-stills-v2 (hard cuts, PASS watch). Cache ?v=stills2

## 2026-09-24 home v3c + in-app loop crossfade
- Live home.mp4 = `imagine/v3/home-loop-v3c.mp4` re-encoded 1280x720 H.264 yuv420p CRF 23 +faststart, no audio (~10.04s, ~4.3MB). All 3 candles flicker, book closed, gold title THE IMMERSIVE BIBLE, light breathes. Mid-frame poster at `public/chamber/poster.jpg`.
- File-only xfade blends (`home-loop-v3c-blend*.mp4`) rejected — first/last SSIM ~0.86 still popped. Do **not** use as the live home.
- In-app dual home `<video>` (same src, no native `loop`). When the front clip has ~1.65s left, the back clip starts at 0 and CSS-crossfades (~1.6s opacity); then the old clip is paused/reset. A fading ref guards double-triggers. Opening pauses **both** homes. `persistHomeTime` / resume use the currently visible home layer. `mediaReady` stays on the primary home `canplay`.
- `prefers-reduced-motion` keeps a single native-looping home video.
- Cache `HOME_SRC` / `POSTER` `?v=v3c1`. Open remains stills-v2 (`?v=stills2`).

## 2026-09-24 chamber HUD + open play fix
- HUD: frosted dark tiles under top brand/Sound row (`.chamber-topbar`) and `.chamber-room` (rgba 8,6,2 / blur 14px). Soft scrim on `.chamber-more`. Text-shadow kept as backup only. No full-screen wash. No Imagine regen.
- Open ritual: removed `play().then(show).catch(() => goRead())`. Always show open once `readyState>=2` / canplay; retry play on rejection; navigate only on `ended` or FAILSAFE. `openReady` + aggressive preload (`canplay` / `canplaythrough`). CTA soft-prefers open buffer (Preparing until home+open ready; click still allowed once home ready).
- Cache `OPEN_SRC ?v=stills2b`. Re-encoded live open.mp4 CRF 26 (~1.2MB, same stills-v2 content). Prior CRF23 kept under `public/chamber/backup/open-pre-stills2b-20260924.mp4`.
- z-index unchanged: open `.is-on` at 3 above homes at 1.

## 2026-09-24 open blob + stills fallback (tunnel cancel fix)
- Prefetch `open.mp4?v=stills2c` as Blob on mount → `URL.createObjectURL`; revoke on unmount. Prefer blob src when ready.
- If open never reaches `readyState>=2` / play within ~2.5s of click → image-sequence ritual from `public/chamber/open-stills/` (closed → half → open CSS zoom 3.4s → parchment), then cream veil + navigate. Works with zero open.mp4 bytes.
- FAILSAFE armed only after open film shown OR stills started; wall-clock 20s.
- Continue hard-blocked (Preparing…) until openReady (blob+canplay) OR stills preloaded.
- Second home `<video>` deferred until open blob ready (or fetch failed) to stop dual-home vs open bandwidth fight over Cloudflare tunnel.
- No Imagine. Frosted HUD unchanged. stills2 open.mp4 remains preferred path when blob works.

## 2026-09-25 open-pull-v4 + last-frame handoff
- Live `open.mp4` replaced with continuous closed→hinge→parchment from `imagine/v2/open-pull-best.mp4`, re-encoded with last 0.8s soft xfade to solid `#efe6d8` (`imagine/v4/open-pull-v4.mp4`, ~10.04s, ~6.3MB). Cache `OPEN_SRC ?v=pullv4`.
- Rejected for ship: `open-pull-v3.mp4` (morph/jump), `open-pull-stills-v3` (Ken Burns). Recipe: `imagine/v4/open-pull-v4-recipe.txt`. Notes: `imagine/v4/NOTES.md`.
- Video Continue path: capture last decoded frame → session `openHandoffFrame`; `goRead({ seamless: true })` skips cream veil; reader shows fixed full-bleed underlay then soft-fades to live vellum (~1.2s + 1.1s fade). Stills/cream-only and `softLeave` still use the soft veil.


## 2026-09-25 open-pull-v4b (iteration 2 — full-bleed cream)
- PASS 1 QA failed on pullv4: ending not true full-bleed (gutter/edges); center ~231,221,202 vs #efe6d8; frozen candles / page-turn morph noted on source.
- Rebuilt from `imagine/v2/open-pull-alt-1.mp4` (cleaner full-bleed push than best) with aggressive ease-in zoompan from ~7.5s into right-page center, 1.15s xfade to solid `#efe6d8`, ≥0.6s cream hold → `imagine/v4/open-pull-v4b.mp4` (~12.92s, ~6.35MB). Last-frame mean/center RGB (238,229,216).
- Installed `public/chamber/open.mp4?v=pullv4b`. Handoff capture only in cream tail (`currentTime > duration-0.35` / `ended`); cream CSS/dataURL fallback if capture fails.
- Recipe: `imagine/v4/open-pull-v4b-recipe.txt`. Notes: `imagine/v4/NOTES.md`.
