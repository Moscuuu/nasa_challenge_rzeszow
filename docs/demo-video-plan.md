# Demo video plan (30 s)

## Context
NASA Space Apps 2026 submission needs a demo video of at most 30 s. The project finds places on Earth where drilling into ground ice can be tested, as a stand-in for ground ice at seven candidate Mars sites. The analog does not have to be identical, and permafrost only has to be frozen for part of the year. Video: strong visual hook, value proposition, app walkthrough, voiceover and captions.

## Decisions
- Narration: AI voiceover plus burned-in captions.
- Hybrid approach: hook footage, real screen capture of `app/`, ffmpeg assembly.
- Higgsfield is deferred. First step is only the Playwright screen capture of the app. Hook, voiceover, music and captions come later.
- Defaults: English, 16:9 (1920x1080), about 70 words of voiceover.

## Structure (30 s)
| Time | Content | Source |
|---|---|---|
| 0-6 s | Hook: drill bit hits ice on Mars. "Before we drill for ice on Mars... where on Earth do we practice?" | later (Higgsfield); placeholder: app Mars-orbit dive |
| 6-12 s | Value: "We scored every permafrost cell on Earth, about 400,000, against seven Mars sites." | app globe |
| 12-25 s | Walkthrough: pick Mars site, Earth heat map, Peary Land analog card | Playwright capture |
| 25-30 s | Close: "Not a perfect twin, but a place to test the drill. Mars Analog Finder." | mix |

## Steps
1. Write `app/scripts/record_demo.mjs` using `@playwright/test` (already in `app/package.json`, same pattern as `app/scripts/shot.mjs`): launch Chromium with `recordVideo: { dir, size: 1920x1080 }`, drive the running app (`npm run dev`) through the shot list, save `.webm`.
2. Convert with ffmpeg to mp4, check duration and frame rate, review with the user. Retake until timing is right.
3. If WebGL drops frames in headless recording, try headed mode, then fall back to manual OBS or Windows Game Bar capture.

## Later
Higgsfield hook clip, voiceover (`higgsfield voices list`), music, captions (needs `faster_whisper` plus a local model), final assembly and QC.

## Verification
- `ffprobe` on the recorded file shows the expected resolution and a duration near the shot-list length.
- Watch the capture: no dev overlays, no console errors visible, UI text readable.
- User approves the capture before moving to later steps.
