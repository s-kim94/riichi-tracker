# Player Profiles & Riichi Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each physical seat around the table have an editable name and a YouTube link; when that seat calls riichi, their song plays from the device, always editable mid-round, with the most recent riichi call's song taking over from whatever was playing.

**Architecture:** A localStorage-backed `usePlayerProfiles` hook stores `{ name, youtubeUrl }` per seat index (0-3), edited live via a new `PlayerProfilesDialog`. A single shared `useRiichiMusicPlayer` hook owns one hidden YouTube IFrame Player instance for the whole Compass session; `Compass.tsx`'s existing `toggleRiichiStick` calls into it exactly once, on the false→true (declare) transition. A small badge on the riichi button shows who's currently playing.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-i18next, the YouTube IFrame Player API (loaded at runtime, no new npm dependency). No test runner is configured in this repo (no jest/vitest, no `test` script), so verification is via `npx tsc -b`, `npm run lint`, `npm run build`, and manual device verification for anything that depends on real browser/network behavior (loading the YouTube API, actual autoplay).

**Known limitation to flag, not solve, in this pass:** the hidden player is created inside `CompassWithGame`, which unmounts when navigating away from `/compass` (e.g. to `/calculator` to score a hand) — so music stops if you navigate away mid-song. This matches ordinary embedded-media behavior (leaving a page stops its media) and is treated as an acceptable boundary, not a bug — call it out to the user after implementation rather than solving it here (it would require lifting the player to an app-wide context, out of scope for what was asked).

---

### Task 1: `usePlayerProfiles` hook

**Files:**
- Create: `src/hooks/usePlayerProfiles.ts`

- [ ] **Step 1: Write the hook**

```ts
import useLocalStorage from "./useLocalStorage";

export interface PlayerProfile {
  name: string;
  youtubeUrl: string;
}

const emptyProfile: PlayerProfile = { name: "", youtubeUrl: "" };

function parseProfiles(raw: string | null): PlayerProfile[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((p: unknown) =>
      p != null &&
      typeof p === "object" &&
      "name" in p &&
      "youtubeUrl" in p
        ? {
            name: String((p as { name: unknown }).name),
            youtubeUrl: String((p as { youtubeUrl: unknown }).youtubeUrl),
          }
        : emptyProfile,
    );
  } catch {
    return [];
  }
}

/**
 * Per-seat (index 0-3, matching the four-way compass's fixed screen
 * quadrants) name/riichi-music profile, persisted in localStorage across
 * games on this device. Always returns a 4-length array, padding any
 * unset seat with an empty profile.
 */
export default function usePlayerProfiles(): [
  PlayerProfile[],
  (ix: number, profile: PlayerProfile) => void,
] {
  const [raw, setRaw] = useLocalStorage("playerProfiles");
  const parsed = parseProfiles(raw);
  const profiles = [0, 1, 2, 3].map((i) => parsed[i] ?? emptyProfile);

  const setProfile = (ix: number, profile: PlayerProfile) => {
    const next = profiles.slice();
    next[ix] = profile;
    setRaw(JSON.stringify(next));
  };

  return [profiles, setProfile];
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePlayerProfiles.ts
git commit -m "Add usePlayerProfiles hook for per-seat name/riichi-music storage"
```

## Context

This is Task 1 of an 8-task plan (docs/superpowers/plans/2026-07-13-player-profiles-riichi-music.md) adding per-seat player names and riichi-triggered YouTube playback to this riichi mahjong scorekeeping app's four-way compass UI. This hook is the storage layer — nothing reads or writes it yet (Tasks 5 and 7 wire it into the UI). It wraps the existing string-only `useLocalStorage` hook (`src/hooks/useLocalStorage.ts`, already used elsewhere for things like `useFourWayCompass`/`prefersQuick`) with JSON parsing, always normalizing to exactly 4 entries regardless of how many are actually stored (so callers never need to check array length or handle `undefined`).

Note: this repo has no test runner configured — expected, not a gap. Verification here is `npx tsc -b && npm run lint` only, since nothing uses this hook yet.

## Before You Begin

If anything is unclear, ask now.

## Your Job

1. Create `src/hooks/usePlayerProfiles.ts` exactly as specified above.
2. Run `npx tsc -b && npm run lint` and confirm both pass.
3. Commit with the exact message given, touching only the new file.
4. Self-review.
5. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If anything is unclear, report BLOCKED or NEEDS_CONTEXT rather than guessing.

## Before Reporting Back: Self-Review

- Does the file match the target exactly?
- Does it type-check and lint clean?
- Did you commit only the new file?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- tsc/lint results
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 2: YouTube URL parser

**Files:**
- Create: `src/lib/youtube.ts`

- [ ] **Step 1: Write the utility**

```ts
/**
 * Extracts a video ID from common YouTube URL shapes
 * (youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/embed/<id>,
 * youtube.com/shorts/<id>), tolerating a missing protocol and extra query
 * params (e.g. timestamps). Returns null for anything unparseable — there's
 * no error shown to the user for a bad link, it just won't play.
 */
export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }
    const match = /^\/(?:embed|shorts)\/([^/]+)/.exec(parsed.pathname);
    if (match) {
      return match[1];
    }
  }
  return null;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

There's no test runner in this repo, so verify by hand-tracing these cases
against the code above (don't skip this — a URL parser is exactly the kind
of code with easy off-by-one/edge-case mistakes):

- `"https://www.youtube.com/watch?v=dQw4w9WgXcQ"` → `"dQw4w9WgXcQ"`
- `"https://youtu.be/dQw4w9WgXcQ?t=30"` → `"dQw4w9WgXcQ"`
- `"youtube.com/watch?v=dQw4w9WgXcQ"` (no protocol) → `"dQw4w9WgXcQ"`
- `"https://www.youtube.com/embed/dQw4w9WgXcQ"` → `"dQw4w9WgXcQ"`
- `"https://www.youtube.com/shorts/dQw4w9WgXcQ"` → `"dQw4w9WgXcQ"`
- `""` → `null`
- `"not a url at all"` → `null` (fails the `new URL(...)` construction even
  with the `https://` prefix added, since it contains spaces)
- `"https://open.spotify.com/track/abc123"` → `null` (wrong host, falls
  through to the final `return null`)

Confirm each by reading the code path, not by running it (no test runner
available) — state your reasoning for each case in your report.

- [ ] **Step 4: Commit**

```bash
git add src/lib/youtube.ts
git commit -m "Add YouTube URL video ID parser"
```

## Context

This is Task 2 of the player-profiles/riichi-music plan. This is a small, pure, standalone utility with no dependencies on the rest of the app — Task 3 will use it inside the music-player hook. No callers yet.

## Before You Begin

If anything is unclear, ask now.

## Your Job

1. Create `src/lib/youtube.ts` exactly as specified above.
2. Run `npx tsc -b && npm run lint`.
3. Do the manual trace verification in Step 3 and include your reasoning in the report.
4. Commit with the exact message given, touching only the new file.
5. Self-review.
6. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If anything is unclear, report BLOCKED or NEEDS_CONTEXT rather than guessing.

## Before Reporting Back: Self-Review

- Does the file match the target exactly?
- Did you actually trace all 8 test cases, not just assert they pass?
- Does it type-check and lint clean?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- Your trace of all 8 cases from Step 3, with reasoning
- tsc/lint results
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 3: `useRiichiMusicPlayer` hook

**Files:**
- Create: `src/hooks/useRiichiMusicPlayer.ts`

- [ ] **Step 1: Write the hook**

```tsx
import { useEffect, useRef, useState } from "react";

import { extractYouTubeVideoId } from "../lib/youtube";

interface YTPlayer {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  destroy: () => void;
}

interface YTPlayerStateChangeEvent {
  data: number;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      events?: {
        onReady?: () => void;
        onStateChange?: (event: YTPlayerStateChangeEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  apiLoadPromise ??= new Promise((resolve) => {
    if (window.YT) {
      resolve(window.YT);
      return;
    }
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

/**
 * Owns a single hidden YouTube IFrame Player for the whole Compass session.
 * The player is created eagerly on mount (not on first play) so that by the
 * time any riichi is actually declared, `playForSeat` can call
 * `loadVideoById`/`playVideo` synchronously within the click handler's own
 * call stack — this matters because strict mobile browser autoplay policies
 * are far more likely to allow playback with sound when it's a direct,
 * synchronous consequence of a user gesture, rather than following an
 * intervening network/async gap (like the IFrame API script loading).
 *
 * A single shared instance also means calling `playForSeat` for a new seat
 * naturally replaces whatever was previously loaded — this is what makes
 * "the later riichi call takes over" work with no extra bookkeeping.
 */
export default function useRiichiMusicPlayer(): {
  nowPlayingSeat: number | null;
  playForSeat: (ix: number, youtubeUrl: string) => void;
} {
  const [nowPlayingSeat, setNowPlayingSeat] = useState<number | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pendingRef = useRef<{ ix: number; videoId: string } | null>(null);

  useEffect(() => {
    const container = document.createElement("div");
    container.style.display = "none";
    document.body.appendChild(container);

    let destroyed = false;
    void loadYouTubeApi().then((YT) => {
      if (destroyed) {
        return;
      }
      playerRef.current = new YT.Player(container, {
        events: {
          onReady: () => {
            const pending = pendingRef.current;
            if (pending) {
              playerRef.current?.loadVideoById(pending.videoId);
              playerRef.current?.playVideo();
              setNowPlayingSeat(pending.ix);
              pendingRef.current = null;
            }
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              setNowPlayingSeat(null);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      container.remove();
    };
  }, []);

  const playForSeat = (ix: number, youtubeUrl: string) => {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      return;
    }
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.playVideo();
      setNowPlayingSeat(ix);
    } else {
      // Player is still being created (loadYouTubeApi hasn't resolved yet,
      // e.g. very first riichi of the session before the script has
      // loaded) — queue it, and onReady above will play it once ready.
      pendingRef.current = { ix, videoId };
    }
  };

  return { nowPlayingSeat, playForSeat };
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

No browser automation tool is available in this environment, and this hook
depends on real browser APIs (`document`, dynamic script loading, the
YouTube IFrame API, actual media playback) that can't be meaningfully
exercised without a live browser anyway. Verify by careful reading instead:

- Confirm the `useEffect` cleanup correctly destroys the player and removes
  the container on unmount, and that `destroyed` guards against the
  `loadYouTubeApi().then(...)` callback running after unmount (e.g. if the
  Compass page is navigated away from before the script finishes loading).
- Confirm `playForSeat` handles both the "player already exists" case
  (direct, synchronous `loadVideoById`/`playVideo`) and the "player not
  ready yet" case (queues into `pendingRef`, consumed by `onReady`).
- Confirm nothing here has a callers yet — this task doesn't wire anything
  into the UI, that's Task 7.
- Real device testing (does audio actually play, does autoplay work
  reliably on the first riichi of a session) will happen in Task 8's final
  manual walkthrough, once this is actually wired up and reachable.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRiichiMusicPlayer.ts
git commit -m "Add useRiichiMusicPlayer hook for shared hidden YouTube playback"
```

## Context

This is Task 3 of the player-profiles/riichi-music plan. This hook is the playback engine — it has no UI and no callers yet (Task 7 wires `playForSeat` into `Compass.tsx`'s existing `toggleRiichiStick`). It depends on Task 2's `extractYouTubeVideoId` (already committed).

Per the design doc (`docs/superpowers/specs/2026-07-13-player-profiles-riichi-music-design.md`): no Spotify support, no manual stop control, no auto-stop on un-riichi or round end — a song just plays until it ends naturally or gets replaced by the next riichi call. That's why this hook has no "stop" function at all, only `playForSeat`.

There is no `@types/youtube` (or similar) package installed, and adding one just for a handful of method signatures we use would be unnecessary — the small local `YTPlayer`/`YTNamespace` interfaces above cover exactly what's used and keep this dependency-free.

Note: this repo has no test runner configured — expected, not a gap.

## Before You Begin

If anything about the eager-initialization strategy, the pending-video queue, or the YouTube API types is unclear, ask now.

## Your Job

1. Create `src/hooks/useRiichiMusicPlayer.ts` exactly as specified above.
2. Run `npx tsc -b && npm run lint` and confirm both pass.
3. Do the substitute verification in Step 3.
4. Commit with the exact message given, touching only the new file.
5. Self-review.
6. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If anything is unclear, report BLOCKED or NEEDS_CONTEXT rather than guessing.

## Before Reporting Back: Self-Review

- Does the file match the target exactly?
- Does it type-check and lint clean?
- Did you commit only the new file?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- tsc/lint results
- Findings from the substitute verification step
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 4: Add i18n keys

**Files:**
- Modify: `public/locales/en/translation.json`

- [ ] **Step 1: Add five new keys under the existing `"compass"` block**

This file's `"compass"` section keys are kept in alphabetical order. Currently
(reading top to bottom) it goes: `abort`, `calculateHand`, `chombo`,
`dealerRepeat`, `dealtinPlayer`, `drawType`, `editScore`, `exhaust`,
`gameIdDoesNotExist`, `handleDraws`, `otherActions`, `pao`,
`paysOutReverseMangan`, `playerInViolation`, `pointDistribution`,
`readyPlayers`, `redoesTheRound`, `repeatRound`, `repeats`,
`responsiblePlayer`, `riichi`, `riichiSticks`, `rotateSeats`,
`scoreRepeatSticks`, `scoreRiichiSticks`, `seatRotation`, `transferPoints`.

Add these five keys, each in its alphabetically correct spot:

1. `"nowPlaying": "Now Playing",` — insert between `"handleDraws"` and
   `"otherActions"`.
2. `"player": "Player {{n}}",` — insert immediately before
   `"playerInViolation"` (so the order becomes `player`,
   `playerInViolation`, ...).
3. `"playerName": "Name",` — insert between `"playerInViolation"` and
   `"playerProfiles"` (next key below).
4. `"playerProfiles": "Player Profiles",` — insert between the new
   `"playerName"` and the existing `"pointDistribution"`.
5. `"riichiMusicUrl": "Riichi Music (YouTube Link)",` — insert between the
   existing `"riichi"` and `"riichiSticks"`.

After this step, the relevant slice of the `"compass"` block should read
(showing only the affected region, `...` meaning unchanged surrounding
content):

```json
    "gameIdDoesNotExist": "Error: Game {{id}} does not exist.",
    "handleDraws": "Handle Draws",
    "nowPlaying": "Now Playing",
    "otherActions": "Other Actions",
    "pao": "Pao",
    "paysOutReverseMangan": "Pays out a <H>reverse mangan</H>.",
    "player": "Player {{n}}",
    "playerInViolation": "Player in Violation",
    "playerName": "Name",
    "playerProfiles": "Player Profiles",
    "pointDistribution": "Point Distribution",
    "readyPlayers": "Ready Players",
    "redoesTheRound": "Redoes the round from the start.",
    "repeatRound": "Repeat Round",
    "repeats": "Repeats ({{repeats}})",
    "responsiblePlayer": "Responsible Player",
    "riichi": "Riichi",
    "riichiMusicUrl": "Riichi Music (YouTube Link)",
    "riichiSticks": "Riichi ({{riichiSticks}})",
    "rotateSeats": "Rotate Seats",
```

Do not touch any other part of this file, and do not add these keys to
`public/locales/ja/translation.json` or `public/locales/weeb/translation.json`
— this repo's i18n setup already has `fallbackLng: "en"` (see the recent "Set
fallbackLng to en" commit), so missing keys in those locales fall back to
English automatically. Adding partial/placeholder translations there would be
worse than just relying on the fallback.

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json', 'utf8')); console.log('valid JSON')"`
Expected output: `valid JSON`

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors (this file isn't TypeScript, but running both is cheap
and confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add public/locales/en/translation.json
git commit -m "Add i18n keys for player profiles and riichi music"
```

## Context

This is Task 4 of the player-profiles/riichi-music plan. These strings will
be used by Task 5's `PlayerProfilesDialog` (`playerProfiles`, `player`,
`playerName`, `riichiMusicUrl`) and Task 6's now-playing badge
(`nowPlaying`). Nothing references these keys yet — this task only adds the
strings.

## Before You Begin

If anything about the exact insertion points is unclear, ask now — get this
right rather than guessing at alphabetical order.

## Your Job

1. Read the current `public/locales/en/translation.json`'s `"compass"`
   block to confirm it still matches what's described above (it was last
   touched by an unrelated commit, "Set fallbackLng to en", which is about
   a different config file, not this one — but confirm anyway before
   editing).
2. Insert the five keys at their exact alphabetical positions.
3. Run the JSON validation command and confirm it prints `valid JSON`.
4. Run `npx tsc -b && npm run lint`.
5. Commit with the exact message given, touching only this one file.
6. Self-review.
7. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If the file doesn't match what's described, report BLOCKED or NEEDS_CONTEXT
rather than guessing at placement.

## Before Reporting Back: Self-Review

- Are all five keys present, each in the correct alphabetical position?
- Does the JSON still parse validly?
- Did you leave the `ja`/`weeb` locale files untouched?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- JSON validation, tsc, and lint results
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 5: `PlayerProfilesDialog` component

**Files:**
- Create: `src/components/compass/PlayerProfilesDialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useTranslation } from "react-i18next";

import { type PlayerProfile } from "../../hooks/usePlayerProfiles";
import CustomDialog from "../layout/CustomDialog";

export default function PlayerProfilesDialog({
  profiles,
  isSanma,
  onProfileChange,
  onClose,
}: {
  profiles: PlayerProfile[];
  isSanma: boolean;
  onProfileChange: (ix: number, profile: PlayerProfile) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const seatCount = isSanma ? 3 : 4;
  const seats = Array.from({ length: seatCount }, (_, ix) => ix);

  return (
    <CustomDialog title={t("compass.playerProfiles")} onClose={onClose}>
      <div className="flex flex-col items-center justify-center gap-y-4">
        {seats.map((ix) => (
          <div
            key={ix}
            className="flex w-72 flex-col items-stretch gap-y-2 border-b-2 border-dashed border-gray-800 pb-4 last:border-none last:pb-0 lg:w-96"
          >
            <span className="text-lg font-semibold lg:text-xl">
              {t("compass.player", { n: ix + 1 })}
            </span>
            <label className="flex flex-col gap-y-1">
              <span className="text-sm lg:text-base">
                {t("compass.playerName")}
              </span>
              <input
                className="rounded-lg border border-gray-800 bg-slate-100 px-2 py-1 text-black lg:text-lg dark:bg-gray-800 dark:text-white"
                type="text"
                value={profiles[ix].name}
                onChange={(e) => {
                  onProfileChange(ix, {
                    ...profiles[ix],
                    name: e.target.value,
                  });
                }}
              />
            </label>
            <label className="flex flex-col gap-y-1">
              <span className="text-sm lg:text-base">
                {t("compass.riichiMusicUrl")}
              </span>
              <input
                className="rounded-lg border border-gray-800 bg-slate-100 px-2 py-1 text-black lg:text-lg dark:bg-gray-800 dark:text-white"
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                value={profiles[ix].youtubeUrl}
                onChange={(e) => {
                  onProfileChange(ix, {
                    ...profiles[ix],
                    youtubeUrl: e.target.value,
                  });
                }}
              />
            </label>
          </div>
        ))}
      </div>
    </CustomDialog>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

No browser automation tool is available in this environment. Verify by
reading: confirm the component renders exactly `seatCount` rows (3 for
sanma, 4 otherwise), each row's inputs are controlled (`value=` +
`onChange=`) and call `onProfileChange` with the right seat index and an
updated copy of that seat's profile (not accidentally mutating/overwriting
the other field). Confirm it imports `CustomDialog` and the `PlayerProfile`
type correctly, and that it doesn't yet have a caller (Task 7 renders it
from `Compass.tsx`).

- [ ] **Step 4: Commit**

```bash
git add src/components/compass/PlayerProfilesDialog.tsx
git commit -m "Add PlayerProfilesDialog for editing per-seat name and riichi music"
```

## Context

This is Task 5 of the player-profiles/riichi-music plan. This dialog is the
UI for editing the data Task 1's `usePlayerProfiles` hook stores. It follows
the same shape as other dialogs in `src/components/compass/` (e.g.
`AdvancedDialog.tsx`) — wraps its content in the shared `CustomDialog`. It
has no caller yet; Task 7 wires it into `Compass.tsx`, opened from a new
button, passing `profiles`/`setProfile` from `usePlayerProfiles()` as
`profiles`/`onProfileChange` here.

There's no "save" button — every keystroke calls `onProfileChange`, which
(once wired in Task 7) writes straight to localStorage via
`usePlayerProfiles`'s setter. This is what makes profiles "always editable,
mid-round" per the design doc — there's no separate save/cancel state to
manage.

Note: this repo has no test runner configured — expected, not a gap.

## Before You Begin

If anything is unclear, ask now.

## Your Job

1. Create `src/components/compass/PlayerProfilesDialog.tsx` exactly as
   specified above.
2. Run `npx tsc -b && npm run lint` and confirm both pass.
3. Do the substitute verification in Step 3.
4. Commit with the exact message given, touching only the new file.
5. Self-review.
6. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If anything is unclear, report BLOCKED or NEEDS_CONTEXT rather than guessing.

## Before Reporting Back: Self-Review

- Does the file match the target exactly?
- Does it correctly handle both sanma (3 rows) and yonma (4 rows)?
- Does it type-check and lint clean?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- tsc/lint results
- Findings from the substitute verification step
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 6: Now-playing badge on `ScoreDisplay`

**Files:**
- Modify: `src/components/compass/ScoreDisplay.tsx`

- [ ] **Step 1: Add the `nowPlaying` prop and badge**

Add `HiMusicNote` to the `react-icons/hi` import (currently there is no
`react-icons/hi` import in this file — add a new one):

```tsx
import { HiMusicNote } from "react-icons/hi";
```

Add `nowPlaying` to the component's props (currently lines 9-31):

```tsx
export default function ScoreDisplay({
  score,
  oldScore = score,
  seatWind,
  isSanma,
  vertical = false,
  riichi = false,
  nowPlaying = false,
  onScoreClick,
  onTileClick,
  onRiichiClick,
  playerLabel,
}: {
  score: number;
  oldScore?: number;
  seatWind: Wind;
  isSanma: boolean;
  vertical?: boolean;
  riichi?: boolean;
  nowPlaying?: boolean;
  onScoreClick?: () => void;
  onTileClick?: () => void;
  onRiichiClick?: () => void;
  playerLabel?: string;
}) {
```

Change the riichi `<button>` (currently around lines 62-77) to add
`relative` to its className and render the badge as an extra child after the
existing `<span>`:

```tsx
        <button
          onClick={onRiichiClick}
          className={clsx(
            "relative rounded-xl border border-gray-800 text-center text-sm shadow md:text-lg lg:text-2xl",
            vertical
              ? "h-40 w-9 px-1.5 py-8 lg:h-80 lg:w-14"
              : "h-9 w-40 px-8 py-1.5 lg:h-14 lg:w-80",
            riichi
              ? "bg-amber-500 enabled:hover:bg-amber-600 dark:bg-amber-700 dark:enabled:hover:bg-amber-800"
              : "bg-gray-50 enabled:hover:bg-gray-200 dark:bg-gray-500 dark:enabled:hover:bg-gray-600",
          )}
        >
          <span className={clsx(vertical ? "[writing-mode:vertical-rl]" : "")}>
            {t("compass.riichi")}
          </span>
          {nowPlaying && (
            <span
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow lg:h-7 lg:w-7 dark:bg-slate-100 dark:text-black"
              title={t("compass.nowPlaying")}
            >
              <HiMusicNote className="text-xs lg:text-base" />
            </span>
          )}
        </button>
```

Only these two regions change — the rest of the file (score display, dice
pips, `TileButton`, `AnimatedIncrement`) is untouched.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

No browser automation tool is available. Verify by reading: confirm
`nowPlaying` defaults to `false`, so every existing caller (there are two,
in `src/pages/Compass.tsx`'s `ScoreDisplayInCompass` wrapper, not yet
updated to pass it — that's Task 7) renders identically to before this
change. Confirm the badge only renders when `nowPlaying` is `true`, and
sits visually in a corner of the riichi button regardless of `vertical`
(check that `absolute` positioning combined with `relative` on the parent
button works the same whether the button's own dimensions are the
`vertical` variant or not — it should, since `absolute -top-1.5 -right-1.5`
positions relative to the button's own box in either case, independent of
the button's width/height).

- [ ] **Step 4: Commit**

```bash
git add src/components/compass/ScoreDisplay.tsx
git commit -m "Add now-playing badge to ScoreDisplay's riichi button"
```

## Context

This is Task 6 of the player-profiles/riichi-music plan. `ScoreDisplay` is
the shared component rendering one seat's score/riichi-button/wind-tile in
both the four-way compass and list layouts (via the `ScoreDisplayInCompass`
wrapper in `src/pages/Compass.tsx`). This task only adds the visual badge
and its prop — nothing passes `nowPlaying={true}` yet (Task 7 wires
`useRiichiMusicPlayer`'s `nowPlayingSeat` through to here).

Note: this repo has no test runner configured — expected, not a gap.

## Before You Begin

If anything is unclear, ask now.

## Your Job

1. Make the two changes to `src/components/compass/ScoreDisplay.tsx` exactly
   as specified (read the current file first to confirm it still matches
   the described structure/line numbers).
2. Run `npx tsc -b && npm run lint` and confirm both pass.
3. Do the substitute verification in Step 3.
4. Commit with the exact message given, touching only this one file.
5. Self-review.
6. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If the current file doesn't match what's described closely enough to apply
these changes confidently, report BLOCKED or NEEDS_CONTEXT rather than
guessing.

## Before Reporting Back: Self-Review

- Does `nowPlaying` default to `false`, preserving existing behavior for
  both current callers?
- Is the badge only rendered when `nowPlaying` is true?
- Does it type-check and lint clean?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented
- tsc/lint results
- Findings from the substitute verification step
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 7: Wire everything into `Compass.tsx`

**Files:**
- Modify: `src/pages/Compass.tsx`

This is the integration task — it touches many places in one file. Read the
whole current file first (it's ~479 lines) before making any change, since
several edits below are repeated across both the four-way branch and the
list-layout branch (8 `ScoreDisplayInCompass` call sites total, 4 per
branch), and it's easy to miss one.

- [ ] **Step 1: Add imports**

Add to the imports (alongside the existing `react-icons/hi` import, which
currently reads `import { HiArrowLeft, HiArrowUp, HiCog } from "react-icons/hi";`):

```tsx
import { HiArrowLeft, HiArrowUp, HiCog, HiUserGroup } from "react-icons/hi";
```

Add two new hook imports and the new dialog component (in their
alphabetically-sorted positions among the existing imports — run
`npx eslint --fix src/pages/Compass.tsx` after this task's edits if
`simple-import-sort` flags the ordering, rather than hand-placing them).
`PlayerProfilesDialog` (Task 5) is a **default** export
(`export default function PlayerProfilesDialog(...)`), so this is a default
import, not a named one:

```tsx
import PlayerProfilesDialog from "../components/compass/PlayerProfilesDialog";
import usePlayerProfiles from "../hooks/usePlayerProfiles";
import useRiichiMusicPlayer from "../hooks/useRiichiMusicPlayer";
```

- [ ] **Step 2: Add state and hooks inside `CompassWithGame`**

Right after the existing:

```tsx
  const [openAdvancedDialog, setOpenAdvancedDialog] = useState(false);
```

add:

```tsx
  const [openPlayerProfilesDialog, setOpenPlayerProfilesDialog] =
    useState(false);
  const [profiles, setProfile] = usePlayerProfiles();
  const { nowPlayingSeat, playForSeat } = useRiichiMusicPlayer();
```

- [ ] **Step 3: Trigger playback when riichi is declared**

Change `toggleRiichiStick` (currently lines 95-119) so the `else` branch
(the "declaring riichi", i.e. going from not-riichi to riichi, branch) calls
`playForSeat` **before** the `await`, so it stays within the same
synchronous call-stack as the click that triggered it:

```tsx
  const toggleRiichiStick = async (ix: number) => {
    if (riichi[ix]) {
      const scores_ = scores.slice();
      scores_[ix] = scores[ix] + 1000;
      const riichi_ = riichi.slice();
      riichi_[ix] = false;
      await db.setGame(locState.id, {
        ...game,
        scores: scores_,
        riichiSticks: riichiSticks - 1,
        riichi: riichi_,
      });
    } else {
      if (profiles[ix].youtubeUrl) {
        playForSeat(ix, profiles[ix].youtubeUrl);
      }
      const scores_ = scores.slice();
      scores_[ix] = scores[ix] - 1000;
      const riichi_ = riichi.slice();
      riichi_[ix] = true;
      await db.setGame(locState.id, {
        ...game,
        scores: scores_,
        riichiSticks: riichiSticks + 1,
        riichi: riichi_,
      });
    }
  };
```

(Only the `if (profiles[ix].youtubeUrl) { playForSeat(ix, profiles[ix].youtubeUrl); }`
block is new, inserted as the first statement of the `else` branch. Nothing
else in this function changes.)

- [ ] **Step 4: Pass `playerLabel`/`nowPlaying` at all 8 `ScoreDisplayInCompass` call sites**

For **each** of the 8 call sites (4 in the four-way branch around lines
125-171, 4 in the list-layout branch around lines 361-403), add
`playerLabel={profiles[ix].name || \`P${ix + 1}\`}` and
`nowPlaying={nowPlayingSeat === ix}`, where `ix` is that call site's own
literal seat number (0/1/2/3 respectively — use the actual number, not a
variable, matching how `ix={0}` etc. are already hardcoded at each site).

The four-way branch's four call sites, in full (each one's `ix`,
`setScoreUpdater`/`setWinner`/`toggleRiichiStick` argument, and fallback
label number must all agree with each other — e.g. the `ix={2}` site uses
`profiles[2]`, `setScoreUpdater(2)`, `"P3"`, and `nowPlayingSeat === 2`, not
a mismatched number):

```tsx
          <ScoreDisplayInCompass
            ix={0}
            oldScores={oldScores}
            game={game}
            onScoreClick={() => setScoreUpdater(0)}
            onTileClick={() => setWinner(0)}
            onRiichiClick={() => void toggleRiichiStick(0)}
            playerLabel={profiles[0].name || "P1"}
            nowPlaying={nowPlayingSeat === 0}
          />
```

```tsx
          <ScoreDisplayInCompass
            vertical
            ix={1}
            oldScores={oldScores}
            game={game}
            onScoreClick={() => setScoreUpdater(1)}
            onTileClick={() => setWinner(1)}
            onRiichiClick={() => void toggleRiichiStick(1)}
            playerLabel={profiles[1].name || "P2"}
            nowPlaying={nowPlayingSeat === 1}
          />
```

```tsx
          <ScoreDisplayInCompass
            ix={2}
            oldScores={oldScores}
            game={game}
            onScoreClick={() => setScoreUpdater(2)}
            onTileClick={() => setWinner(2)}
            onRiichiClick={() => void toggleRiichiStick(2)}
            playerLabel={profiles[2].name || "P3"}
            nowPlaying={nowPlayingSeat === 2}
          />
```

```tsx
            <ScoreDisplayInCompass
              vertical
              ix={3}
              oldScores={oldScores}
              game={game}
              onScoreClick={() => setScoreUpdater(3)}
              onTileClick={() => setWinner(3)}
              onRiichiClick={() => void toggleRiichiStick(3)}
              playerLabel={profiles[3].name || "P4"}
              nowPlaying={nowPlayingSeat === 3}
            />
```

(The 4th one is indented one level deeper and has no `vertical`→no wait —
check the current file directly: it's wrapped in the
`{settings.sanma == null && (...)}` conditional, keeps its existing
`vertical` prop, and its surrounding indentation is deeper than the other
three because of that wrapper. Preserve whatever indentation the existing
call site already has — only add the two new props, don't reformat
anything else.)

The list-layout branch's four call sites already have a hardcoded
`playerLabel="P1"` (or `"P2"`/`"P3"`/`"P4"`) — **replace** that hardcoded
string with the profile-based expression (don't add alongside it), and add
`nowPlaying`, for all four:

```tsx
            <ScoreDisplayInCompass
              ix={0}
              oldScores={oldScores}
              game={game}
              onScoreClick={() => setScoreUpdater(0)}
              onTileClick={() => setWinner(0)}
              onRiichiClick={() => void toggleRiichiStick(0)}
              playerLabel={profiles[0].name || "P1"}
              nowPlaying={nowPlayingSeat === 0}
            />
```

```tsx
            <ScoreDisplayInCompass
              ix={1}
              oldScores={oldScores}
              game={game}
              onScoreClick={() => setScoreUpdater(1)}
              onTileClick={() => setWinner(1)}
              onRiichiClick={() => void toggleRiichiStick(1)}
              playerLabel={profiles[1].name || "P2"}
              nowPlaying={nowPlayingSeat === 1}
            />
```

```tsx
            <ScoreDisplayInCompass
              ix={2}
              oldScores={oldScores}
              game={game}
              onScoreClick={() => setScoreUpdater(2)}
              onTileClick={() => setWinner(2)}
              onRiichiClick={() => void toggleRiichiStick(2)}
              playerLabel={profiles[2].name || "P3"}
              nowPlaying={nowPlayingSeat === 2}
            />
```

```tsx
              <ScoreDisplayInCompass
                ix={3}
                oldScores={oldScores}
                game={game}
                onScoreClick={() => setScoreUpdater(3)}
                onTileClick={() => setWinner(3)}
                onRiichiClick={() => void toggleRiichiStick(3)}
                playerLabel={profiles[3].name || "P4"}
                nowPlaying={nowPlayingSeat === 3}
              />
```

(Again, the 4th one is inside the `{settings.sanma == null && (...)}`
conditional and is indented one level deeper in the current file — preserve
that, only add the two new props.)

- [ ] **Step 5: Update `ScoreDisplayInCompass` itself to forward the new prop**

`ScoreDisplayInCompass` (the small wrapper function at the bottom of the
file, currently lines 444-478) needs to accept and forward `nowPlaying`
(it already accepts and forwards `playerLabel`, no change needed there):

```tsx
function ScoreDisplayInCompass({
  game,
  ix,
  oldScores,
  vertical = false,
  onScoreClick,
  onTileClick,
  onRiichiClick,
  playerLabel,
  nowPlaying,
}: {
  game: Game;
  ix: number;
  oldScores?: number[];
  vertical?: boolean;
  onScoreClick?: () => void;
  onTileClick?: () => void;
  onRiichiClick?: () => void;
  playerLabel?: string;
  nowPlaying?: boolean;
}) {
  const { bottomWind, scores, riichi, settings } = game;
  return (
    <ScoreDisplay
      vertical={vertical}
      score={scores[ix]}
      oldScore={oldScores?.[ix]}
      riichi={riichi[ix]}
      isSanma={settings.sanma != null}
      seatWind={nextWind(bottomWind, ix, settings.sanma != null)}
      onScoreClick={onScoreClick}
      onTileClick={onTileClick}
      onRiichiClick={onRiichiClick}
      playerLabel={playerLabel}
      nowPlaying={nowPlaying}
    />
  );
}
```

- [ ] **Step 6: Add the new button and dialog in both layout branches**

In the **four-way branch**, find the header controls block (currently
around lines 272-304) — the `<div className={clsx("flex gap-2", ...)}>`
containing the back-arrow buttons and the `HiCog` "Advanced" button. Add a
new `CircleButton` for player profiles right before the existing `HiCog`
one:

```tsx
            <CircleButton
              onClick={() => {
                setOpenPlayerProfilesDialog(true);
              }}
            >
              <HiUserGroup />
            </CircleButton>
            <CircleButton
              onClick={() => {
                setOpenAdvancedDialog(true);
              }}
            >
              <HiCog />
            </CircleButton>
```

And add the dialog render, alongside the existing
`{openAdvancedDialog && (<AdvancedDialog .../>)}` block in that same branch
(right after it):

```tsx
      {openPlayerProfilesDialog && (
        <PlayerProfilesDialog
          profiles={profiles}
          isSanma={settings.sanma != null}
          onProfileChange={setProfile}
          onClose={() => setOpenPlayerProfilesDialog(false)}
        />
      )}
```

The **list-layout branch** has its own, separate header controls block
(currently around lines 342-357, the `<div className="flex flex-col
gap-2">` containing the back and gear buttons). Add the same new
`CircleButton`, right before that branch's own `HiCog` button:

```tsx
                <CircleButton
                  onClick={() => {
                    setOpenPlayerProfilesDialog(true);
                  }}
                >
                  <HiUserGroup />
                </CircleButton>
                <CircleButton
                  onClick={() => {
                    setOpenAdvancedDialog(true);
                  }}
                >
                  <HiCog />
                </CircleButton>
```

And add the same dialog render, alongside that branch's own
`{openAdvancedDialog && (<AdvancedDialog .../>)}` block (right after it):

```tsx
      {openPlayerProfilesDialog && (
        <PlayerProfilesDialog
          profiles={profiles}
          isSanma={settings.sanma != null}
          onProfileChange={setProfile}
          onClose={() => setOpenPlayerProfilesDialog(false)}
        />
      )}
```

There are now two `{openPlayerProfilesDialog && (...)}` blocks in the file
in total — one per branch — matching the existing pattern where
`{openAdvancedDialog && (<AdvancedDialog .../>)}` and
`{winner != null && (<WinnerDialog .../>)}` are each already duplicated once
per branch.

(This duplication across both branches matches the existing pattern already
used for `AdvancedDialog`, `WinnerDialog`, etc. in this file — it's
consistent with how the file is already structured, not a new pattern being
introduced.)

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors. If lint flags import ordering, run
`npx eslint --fix src/pages/Compass.tsx`.

- [ ] **Step 8: Manual verification**

No browser automation tool is available in this environment. Verify by
reading the final file:

- Confirm all 8 `ScoreDisplayInCompass` call sites (4 + 4) now pass both
  `playerLabel` (derived from `profiles[ix].name`, falling back to the
  right `"P1"`-style string) and `nowPlaying={nowPlayingSeat === ix}`, each
  using that call site's own correct seat number.
- Confirm both layout branches got the new `HiUserGroup` button and the new
  `PlayerProfilesDialog` render.
- Confirm `toggleRiichiStick`'s `playForSeat` call is in the correct branch
  (declaring riichi, not cancelling it) and happens before the `await`.
- Confirm `ScoreDisplayInCompass` forwards `nowPlaying` through to
  `ScoreDisplay`.

Real device testing (does music actually play when riichi is declared, does
the badge appear/disappear correctly, do names persist and stay editable
mid-round) happens in Task 8.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Compass.tsx
git commit -m "Wire player profiles and riichi music into Compass"
```

## Context

This is Task 7 (the integration task) of the player-profiles/riichi-music
plan. Everything up to this point (Tasks 1-6) was standalone, uncalled code.
This task is the highest-risk one in the plan because of the sheer number of
repeated edits (8 near-identical `ScoreDisplayInCompass` call sites, 2
near-identical header-controls blocks, 2 near-identical dialog-render
blocks) — the risk isn't subtlety, it's simply missing one of the 8/2/2
spots. Go through the file systematically rather than trying to hold all of
it in your head at once.

Note: this repo has no test runner configured — expected, not a gap.

## Before You Begin

If you're not confident you've found all 8 `ScoreDisplayInCompass` call
sites, or either of the two header-controls blocks, or either of the two
`{openAdvancedDialog && (...)}` blocks, after reading the file, ask before
guessing.

## Your Job

1. Read the full current `src/pages/Compass.tsx`.
2. Make all the changes in Steps 1-6 above.
3. Run `npx tsc -b && npm run lint` (Step 7), fixing import order with
   `eslint --fix` if needed.
4. Do the substitute verification in Step 8 — explicitly enumerate all 8
   call sites and both pairs of blocks in your report to prove you found
   all of them, don't just assert it.
5. Commit with the exact message given, touching only this one file.
6. Self-review.
7. Report back.

Work from: `/Users/sk/code/riichi-tracker`

## When You're in Over Your Head

If the file's structure doesn't match what's described closely enough for
you to be confident, or you can't account for all 8 call sites / 2+2
blocks, report BLOCKED or NEEDS_CONTEXT rather than guessing — a missed
call site would silently mean one seat never shows its name or badge.

## Before Reporting Back: Self-Review

- List all 8 `ScoreDisplayInCompass` call sites you touched, with their
  seat numbers, and confirm each has both new props.
- Confirm both layout branches got the new button and dialog render.
- Confirm `toggleRiichiStick`'s new `playForSeat` call is correctly placed
  (declare branch, before the `await`).
- Does it type-check and lint clean?

## Report Format

Report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented, explicitly listing all 8 call sites and both pairs
  of blocks you touched
- tsc/lint results
- Findings from the substitute verification step
- Files changed
- Git commit SHA
- Self-review findings (if any)

---

### Task 8: Final verification and build check

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `npm run build`
Expected: builds successfully with no TypeScript or bundling errors.

- [ ] **Step 2: Lint the whole repo**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: End-to-end manual walkthrough (on a real device/browser)**

This feature depends entirely on real browser behavior (localStorage
persistence, dynamic script loading, actual YouTube playback, mobile
autoplay policy) that cannot be verified through static analysis. Using
`npm run dev` on a real device:

1. Start a 4-player game, open the player-profiles dialog (new
   person/group icon) from both the four-way compass and the list layout,
   and set a name + a YouTube link for at least two seats.
2. Confirm the names appear on both layouts' score displays, replacing the
   generic `P1`-style labels.
3. Tap a seat's riichi button to declare riichi. Confirm: their song starts
   playing with audio, and the music-note badge appears on their riichi
   button.
4. While that's playing, declare riichi for a different seat that also has
   a link set. Confirm the first song stops and the second one starts, and
   the badge moves to the second seat.
5. Cancel a riichi (tap the button again to un-declare) — confirm the
   currently-playing song, if it belongs to that seat, is **not**
   interrupted (per the design, only round-end or being superseded by
   another riichi call stops it — cancelling riichi does nothing to
   playback).
6. Reopen the player-profiles dialog mid-round and change a name or link —
   confirm the change takes effect immediately (visible name change; a
   subsequent riichi call uses the new link).
7. Let a song play to completion (or manually seek near the end, if your
   test song is long) and confirm the badge disappears once it ends.
8. Specifically note whether the very *first* riichi music of a fresh page
   load actually autoplays with sound, or whether the browser blocks it —
   this is the one behavior the plan flagged as uncertain (mobile autoplay
   policy). If it's blocked, that's useful to know but is an acceptable
   known limitation to report back, not something to fix blindly in this
   pass.
9. Navigate away to `/calculator` while a song is playing and confirm it
   stops (expected — the player is scoped to the Compass page; this is the
   documented, accepted limitation from this plan's header, not a bug).

- [ ] **Step 4: Report findings**

Summarize what worked and what didn't from Step 3 (especially the
first-riichi-autoplay question) back to the user — don't just say
"everything passed" if something in Step 3 behaved unexpectedly on the
actual device.
