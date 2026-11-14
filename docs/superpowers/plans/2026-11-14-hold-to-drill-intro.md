# Hold-to-Drill Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-visit opening where holding mouse/Space/touch scrubs a generated clip (Mars polygons → Earth twin → drill into ice), then hands over to the existing 3D intro.

**Architecture:** Assets generated with the Higgsfield CLI (3 stills → 2 Kling start/end-frame clips → ffmpeg all-intra MP4). A pure progress module (`src/motion/drill.ts`) drives a `HoldToDrill` React component that sets `video.currentTime` from progress each frame; it replaces `IntroVideo` and keeps the `motion.videoPlaying` hand-off to `useMotion`.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, Higgsfield CLI 1.2.2, ffmpeg.

**Spec:** `docs/superpowers/specs/2026-11-14-hold-to-drill-intro-design.md`

## Global Constraints

- Captions, exact copy: "Mars hides its water as ice, under the dust." / "Earth has places with the same frozen ground." / "Before we drill there, we practice here."
- Caption bands: 0–33 %, 33–66 %, 66–100 % of progress.
- Forward at 1× while held; rewind at 1.5× when released.
- First visit only (`readSeen()`); "Skip" always visible; silent; reduced motion → poster + Enter button.
- UI style: white accent only, 1px lines, existing tokens in `app/src/styles/tokens.css`.
- Assets: `app/public/intro/intro.mp4` (1280×720, H.264, `-g 1`, no audio, ≤ 6 MB), `app/public/intro/poster.jpg`.
- Credit budget: ≤ 60 of 280 credits including retries; check `higgsfield generate cost` before each job.

## Review Focus

- Pointer released outside the window or tab loses focus mid-hold → hold must stop (listen on `window` for `pointerup`/`pointercancel`/`blur`). Test in Task 3.
- Space key auto-repeat → `keydown` repeats must not toggle anything; only keydown/keyup set holding. Test in Task 3.
- Video fails to load (missing file, 404 HTML) → intro ends at once, app usable. Test in Task 3.
- Mobile: touch-hold must not trigger text selection / context menu / page scroll (`touch-action: none`, `user-select: none`, `contextmenu` prevented). Manual check in Task 4.
- Seeking a paused `<video>` on iOS Safari needs `muted playsInline preload="auto"`; component never calls `play()`. Covered by Task 3 implementation + manual check in Task 4.

---

### Task 1: Generate and encode intro assets

**Files:**
- Create: `app/public/intro/intro.mp4`, `app/public/intro/poster.jpg`
- Scratch (not committed): `<scratchpad>/intro/` for stills and raw clips

- [ ] **Step 1: Generate 3 stills** with `higgsfield generate create gpt_image_2` at 16:9, same top-down aerial framing and lighting for still 1 and 2:
  1. Mars: rust-ochre polygonal patterned ground, thermal-contraction cracks, thin frost in troughs, low sun, top-down aerial, photoreal.
  2. Earth: Arctic tundra polygon ground (Svalbard), same framing, cracks with ice in troughs, muted grey-green, low sun.
  3. Close-up: steel drill bit cutting into pale blue ground ice beneath frozen soil, ice core rising, cold light, dark surroundings.
- [ ] **Step 2: Show the stills to the user; regenerate any they reject.** Gate: no video spend before approval.
- [ ] **Step 3: Generate 2 clips** with `kling_o3_flf --mode pro --duration 5 --sound off`: clip A start=still 1 end=still 2 (slow aerial glide, ground morphs), clip B start=still 2 end=still 3 (camera descends to the ground, drill bites in). Download results.
- [ ] **Step 4: Encode** — concat A+B, scale 1280×720, `-c:v libx264 -g 1 -crf 26 -pix_fmt yuv420p -an -movflags +faststart` → `intro.mp4`; still 1 → `poster.jpg` (1280×720, q≈85).
- [ ] **Step 5: Verify** `ffprobe` shows ~10 s, 1280×720, no audio stream; file ≤ 6 MB (raise `-crf` if not).
- [ ] **Step 6: Commit** `app/public/intro/*` — "feat(app): hold-to-drill intro assets".

### Task 2: Progress logic

**Files:**
- Create: `app/src/motion/drill.ts`, Test: `app/src/motion/drill.test.ts`

**Interfaces:**
- Produces: `CAPTIONS: readonly [string, string, string]`; `stepProgress(p: number, holding: boolean, dt: number, duration: number): number` (clamped 0..1; +dt/duration when holding, −1.5·dt/duration when not); `captionIndex(p: number): 0 | 1 | 2` (bands < 1/3, < 2/3, else).

- [ ] **Step 1: Failing tests** — `stepProgress(0, true, 1, 10) === 0.1`; `stepProgress(0.5, false, 1, 10) === 0.35`; clamps: `stepProgress(0.99, true, 1, 10) === 1`, `stepProgress(0.05, false, 1, 10) === 0`; `duration <= 0` returns p unchanged; `captionIndex(0) === 0`, `captionIndex(0.34) === 1`, `captionIndex(0.67) === 2`, `captionIndex(1) === 2`; `CAPTIONS` equals the spec copy.
- [ ] **Step 2: Run** `npx vitest run src/motion/drill.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** in `drill.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "feat(app): drill progress logic".

### Task 3: HoldToDrill component (replaces IntroVideo)

**Files:**
- Create: `app/src/ui/HoldToDrill.tsx`, Test: `app/src/ui/HoldToDrill.test.tsx`
- Delete: `app/src/ui/IntroVideo.tsx`
- Modify: `app/src/App.tsx` (render `<HoldToDrill />` where `<IntroVideo />` was), `app/src/ui/ui.css` (replace `.intro-video*` rules with `.drill*`), `app/src/motion/intro.ts` (add `clearSeen(): void`)

**Interfaces:**
- Consumes: Task 2 exports; `readSeen`, `prefersReducedMotion` from `motion/intro.ts`; `motion.videoPlaying` from `motion/registry.ts`.
- Produces: `HoldToDrill()` component; `clearSeen()` in `motion/intro.ts` (removes `af-intro-seen`, try/catch like `markSeen`).

Behaviour: on mount, if `!readSeen()` set `motion.videoPlaying = true` and show overlay (z-index 60) with `<video src=intro.mp4 poster=poster.jpg muted playsInline preload="auto">` (never `play()`), caption `CAPTIONS[captionIndex(p)]`, button "◉ Hold to drill" (pointerdown/up + Space keydown/keyup on window; ignore `e.repeat`), 1px progress line width `p*100%`, button "Skip". rAF loop: `p = stepProgress(...)`, `video.currentTime = p * video.duration`. On `p === 1`: add `.drill--flash`, after 600 ms finish. Finish = `motion.videoPlaying = false` + fade out 700 ms + unmount. Skip button, video `error` event → finish. Reduced motion: poster + "Enter" button → finish. Stop the window-level `skip` handler in `useMotion` from firing on overlay interactions: overlay calls `e.stopPropagation()` is not enough (capture listener) — instead `useMotion`'s `skip` must ignore events while `motion.videoPlaying` is true.

- [ ] **Step 1: Failing tests** (jsdom; stub `HTMLMediaElement.prototype` duration = 10, rAF via `vi.useFakeTimers` or manual stepping):
  - `renders nothing when the intro was seen` (localStorage `af-intro-seen=1`).
  - `shows the first caption and Hold button on first visit` → text "Mars hides its water as ice, under the dust." and button /hold to drill/i; `motion.videoPlaying === true`.
  - `Skip ends it` → after click + 700 ms, overlay gone and `motion.videoPlaying === false`.
  - `video error ends it` → fire `error` on the video → `motion.videoPlaying === false`.
  - `window blur stops holding` → pointerdown on button, fire `blur` on window, advance frames → progress line width does not increase.
  - `Space repeat does not restart hold` → keydown Space, keydown Space `{repeat:true}`, keyup Space → holding false (progress stops).
  - `reduced motion shows Enter instead of Hold` (mock `matchMedia` reduce) → button "Enter", click → `motion.videoPlaying === false`.
- [ ] **Step 2: Run** `npx vitest run src/ui/HoldToDrill.test.tsx` → FAIL.
- [ ] **Step 3: Implement** component, CSS (`.drill` fixed overlay black, `touch-action:none; user-select:none`, `contextmenu` prevented; caption Sora 300 1.5rem centred; progress 1px white at bottom; `.drill--flash` white flash keyframe), `clearSeen`, `useMotion` skip guard, App swap, delete `IntroVideo.tsx`.
- [ ] **Step 4: Run** full `npx vitest run` and `npx tsc -b` → all pass, no type errors.
- [ ] **Step 5: Commit** "feat(app): hold-to-drill intro".

### Task 4: Replay link + browser check

**Files:**
- Modify: `app/src/ui/Footer.tsx` (append button "Replay intro" → `clearSeen(); location.reload()`), `app/src/ui/ui.css` (`.footer-replay` styled like footer links)

- [ ] **Step 1: Implement** the footer button.
- [ ] **Step 2: Browser check** (Playwright, desktop only): clear localStorage, load app → overlay with caption 1; hold (mouse down 4 s) → caption 2 visible; release → progress shrinks; hold to end → flash → app 3D intro; "Replay intro" → overlay returns; Skip works. One screenshot of the overlay mid-hold.
- [ ] **Step 3: Run** `npx vitest run` → pass.
- [ ] **Step 4: Commit** "feat(app): replay intro link".
