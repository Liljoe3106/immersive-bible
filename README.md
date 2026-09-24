# The Immersive Bible

A cinematic, somber Bible reader — game-HUD chamber, vellum reader, English first.

## Run

```bash
npm install
npm run dev
```

Dev server defaults to http://localhost:5173

```bash
npm run typecheck
npm run build
npm run preview
```

Re-ingest Bible data:

```bash
npm run ingest
```

## Stack

Vite · React 19 · TanStack Router · Zustand · Tailwind CSS v4

## Audio credit

Chamber bed: **“Heart of Nowhere”** by [Kevin MacLeod](https://incompetech.com/) — [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Cellos, choir, no drums.

Page-turn SFX: **“Pages that turn #6”** by Joseph Sardin / [BigSoundBank (La Sonothèque)](https://bigsoundbank.com/pages-that-turn-6-s2213.html) — [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain).

## Brand

Cover / title lettering is only **The Immersive Bible** — never “Holy Bible” or “Old Testament” on the cover.

## Data

- English: KJV public domain (all 66 books)
- Originals: OSHB/WLC Hebrew OT + MorphGNT/SBLGNT Greek NT (as ingested)
- Strong’s: Open Scriptures dictionaries (subset + used entries)

Optional: set `VITE_XAI_API_KEY` for Name-it AI assist; curated + keyword fallback never crashes without it.
