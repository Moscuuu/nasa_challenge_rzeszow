# Hold-to-drill opening intro — design

Date: 2026-11-14 · Status: approved in conversation · Size: small change

## Intent

Set the tone for the challenge before the app opens: future Mars crews need water, it is locked as
ice under the ground, and we must find places on Earth with the same frozen ground to test drilling
first. Analog Finder finds those places. The opening should make the visitor *do* the drilling.

## Goals / non-goals / anti-goals

- Goal: a short interactive opening on the first visit; the visitor holds to drive a generated clip
  (Mars polygon ground → its Earth twin → drill bit into ice), then lands in the live 3D intro.
- Non-goals: sound, narration, astronauts/people, text rendered inside the video.
- Anti-goals: blocking the app (skip must always be visible), a heavy page (clip stays small),
  repeating the 3D intro's Mars→Earth globe move.

## Approaches considered

1. Wipe between twins (cursor splits Mars|Earth loops) — cheapest, most "analog", less drama.
2. **Hold to drill (picked by user)** — video plays only while held, rewinds on release; physical,
   puts water stakes first.
3. Click-through chapters — simplest, least interactive.

## Decided

- Story: aerial over Mars polygon ground → dissolves into matching Arctic polygon ground → drill bit
  bites into pale blue ice, ice core. Landscapes only.
- Interaction: hold mouse / key (Space) / touch → playback forward at 1×; release → rewinds at ~1.5×.
  Thin progress line. Reaching the end: white flash, fade into the existing 3D intro.
- Captions (page text, fade in at progress points):
  1. "Mars hides its water as ice, under the dust." (0–33 %)
  2. "Earth has places with the same frozen ground." (33–66 %)
  3. "Before we drill there, we practice here." (66–100 %)
- First visit only; "Skip" always visible; footer "Replay intro" link; silent.
- Reduced motion: show the first still + an Enter button, no scrubbing.

## Asset pipeline (my call, budget ~40 of 280 credits)

- 3 stills with `gpt_image_2` (~6.5 cr each): Mars polygons, Earth polygons (same framing),
  drill into ice. Review stills before any video spend.
- 2 clips with `kling_o3_flf` pro, 5 s, start+end frame (~9 cr each): Mars→Earth, Earth→drill.
- ffmpeg: concat, 1280×720, H.264, all-intra (`-g 1`) so scrubbing is smooth, no audio,
  plus the first still as poster JPG. Target ≤ 6 MB.
- Files: `app/public/intro/intro.mp4`, `app/public/intro/poster.jpg`.

## Left to the builder

- Exact prompts, caption timing polish, progress-line styling within the existing tokens
  (white accent only, thin 1px lines, Sora/Inter).
- Replaces the current auto-playing `IntroVideo` component (same file, same hand-off via
  `motion.videoPlaying`).
