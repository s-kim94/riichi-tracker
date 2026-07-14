# Winner-Orientation Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rotate `WinnerDialog` and the `Calculator` page to match the winning seat's on-screen orientation in the four-way compass, so the whole win-declaration-through-scoring flow reads correctly from that player's physical position (0°/90°/180°/270°).

**Architecture:** A pure `seatRotationDegrees(ix)` helper reproduces the rotation already implicit in the four-way compass's score display. `Compass.tsx` computes the winner's angle and threads it through `WinnerDialog` (which applies it to `CustomDialog`, now rotation-aware) and into `CalculatorState`, which the `Calculator` page reads to wrap its content in a new `Rotated` component.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-router-dom. No test runner is configured in this repo (no jest/vitest, no `test` script) and this feature is UI layout/plumbing rather than business logic, so verification is via `npx tsc -b` (type-check), `npm run lint`, and manual browser verification through the dev server (per this repo's own `verify`/`run` conventions) rather than automated tests.

**Note on the design doc:** the design (`docs/superpowers/specs/2026-07-13-winner-orientation-design.md`) describes one shared `Rotated` wrapper used in both `CustomDialog` and `Calculator`. In practice the two need different layout strategies — the dialog must stay shrink-to-content (bounded by swapped `max-h`/`max-w`), while the Calculator page must fill the entire (swapped) viewport with its own scroll region. This plan implements that as: rotation classes added directly to `CustomDialog` (Task 3), and a small dedicated `Rotated` component used only by `Calculator` (Task 6). The externally-visible behavior matches the design doc exactly; only the internal code-sharing differs.

You are on branch `feature/winner-orientation` already (confirmed clean, diverged from `main` only by the design-doc commit). Stay on this branch for all tasks below; do not create a worktree.

---

### Task 1: Add `seatRotationDegrees` helper

**Files:**
- Modify: `src/lib/hand.ts:78-83` (right after `nextWind`)

- [ ] **Step 1: Add the function**

Insert immediately after the closing brace of `nextWind` (currently ending at line 83):

```ts
/**
 * Rotation (in degrees clockwise) needed for content at a fixed four-way
 * compass screen quadrant (ix 0 = bottom, 1 = right, 2 = top, 3 = left) to
 * read right-side up from that seat's physical position.
 */
export function seatRotationDegrees(ix: number): 0 | 90 | 180 | 270 {
  return ((360 - 90 * ix) % 360) as 0 | 90 | 180 | 270;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Verify the mapping by hand**

Confirm `seatRotationDegrees(0) === 0`, `seatRotationDegrees(1) === 270`,
`seatRotationDegrees(2) === 180`, `seatRotationDegrees(3) === 90` by reading
the formula (`(360 - 90*ix) % 360`) — there's no test runner in this repo to
automate this, so this is a manual arithmetic check before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hand.ts
git commit -m "Add seatRotationDegrees helper for four-way compass orientation"
```

---

### Task 2: Add `rotationDeg` to `CalculatorState`

**Files:**
- Modify: `src/lib/states.ts`

- [ ] **Step 1: Add the optional field**

Replace the full contents of `src/lib/states.ts` with:

```ts
import { type Wind } from "./hand";

export type CompassState = { t: "load"; id: string; oldScores?: number[] };

export type CalculatorState =
  | ({
      t: "transfer";
      id: string;
      roundWind: Wind;
      seatWind: Wind;
      winner: number;
      handleRotation: boolean;
      dealerRepeat: boolean;
      scoreRiichiSticks: boolean;
      scoreRepeatSticks: boolean;
      pao: number | null;
      rotationDeg?: 0 | 90 | 180 | 270;
    } & ({ agari: "tsumo" } | { agari: "ron"; dealtInPlayer: number }))
  | { t: "load"; id: string };
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors (the field is optional, so no existing call sites break).

- [ ] **Step 3: Commit**

```bash
git add src/lib/states.ts
git commit -m "Add optional rotationDeg field to CalculatorState"
```

---

### Task 3: Make `CustomDialog` rotation-aware

**Files:**
- Modify: `src/components/layout/CustomDialog.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `src/components/layout/CustomDialog.tsx` with:

```tsx
import { Dialog, DialogPanel } from "@headlessui/react";
import clsx from "clsx";
import { type ReactNode, type RefObject } from "react";
import { HiX } from "react-icons/hi";

import CircleButton from "../CircleButton";

export default function CustomDialog({
  onClose,
  initialFocus,
  title,
  rotationDeg = 0,
  children,
}: {
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  title?: ReactNode;
  rotationDeg?: 0 | 90 | 180 | 270;
  children?: ReactNode;
}) {
  // Rotating 90/270 swaps the panel's effective on-screen width/height, so
  // its own max-height/max-width bounds must swap too or it can overflow
  // off-screen post-rotation.
  const swapped = rotationDeg === 90 || rotationDeg === 270;
  const boundsClass = swapped
    ? "max-h-[100vw] max-w-[100vh]"
    : "max-h-screen max-w-[100vw]";
  return (
    <Dialog open onClose={onClose} initialFocus={initialFocus}>
      <div className="fixed inset-0 z-20 bg-black/70" aria-hidden="true" />
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <DialogPanel
            className={clsx(
              boundsClass,
              rotationDeg === 90 && "rotate-90",
              rotationDeg === 180 && "rotate-180",
              rotationDeg === 270 && "-rotate-90",
            )}
          >
            <div
              className={clsx(
                "flex flex-col px-4 py-8 text-black dark:text-white",
                boundsClass,
              )}
            >
              <div className="flex w-full flex-row items-center justify-between rounded-t-xl bg-slate-400 p-2 dark:bg-gray-700">
                <div className="ml-1 text-xl font-bold lg:ml-2 lg:text-3xl">
                  {title}
                </div>
                <CircleButton onClick={onClose}>
                  <HiX />
                </CircleButton>
              </div>
              <div className="overflow-auto rounded-b-xl bg-slate-200 px-4 py-4 shadow lg:px-8 dark:bg-gray-900">
                {children}
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open the printed local URL. Open any dialog that uses
`CustomDialog` (e.g. tap a score to open the score-update dialog from
`/compass`). Confirm it looks and behaves exactly as before — `rotationDeg`
defaults to `0`, so this step should be a no-op visually. This confirms the
change is backward-compatible before we start passing non-zero angles into
it.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/CustomDialog.tsx
git commit -m "Make CustomDialog rotation-aware"
```

---

### Task 4: Thread `rotationDeg` through `WinnerDialog`

**Files:**
- Modify: `src/components/compass/WinnerDialog.tsx`

- [ ] **Step 1: Accept the prop and use it**

In `src/components/compass/WinnerDialog.tsx`, change the function signature
(currently lines 15-25):

```tsx
export function WinnerDialog({
  winner,
  gameId,
  game,
  onClose,
}: {
  winner: number;
  gameId: string;
  game: Game;
  onClose: () => void;
}) {
```

to:

```tsx
export function WinnerDialog({
  winner,
  gameId,
  game,
  rotationDeg = 0,
  onClose,
}: {
  winner: number;
  gameId: string;
  game: Game;
  rotationDeg?: 0 | 90 | 180 | 270;
  onClose: () => void;
}) {
```

- [ ] **Step 2: Include it in the navigation state**

In `submitWinner` (currently lines 43-60), add `rotationDeg` to the `state`
object:

```tsx
  const submitWinner = () => {
    const state: CalculatorState = {
      t: "transfer",
      id: gameId,
      roundWind,
      seatWind,
      winner,
      handleRotation,
      dealerRepeat,
      scoreRiichiSticks,
      scoreRepeatSticks,
      pao: isPao ? paoPlayer : null,
      rotationDeg,
      ...(agari.t === "tsumo"
        ? { agari: "tsumo" }
        : { agari: "ron", dealtInPlayer: agari.dealIn }),
    };
    void navigate("/calculator", { state, replace: true });
  };
```

- [ ] **Step 3: Pass it to `CustomDialog`**

Change the `CustomDialog` opening tag (currently line 63):

```tsx
    <CustomDialog onClose={onClose} title={t("compass.transferPoints")}>
```

to:

```tsx
    <CustomDialog
      onClose={onClose}
      title={t("compass.transferPoints")}
      rotationDeg={rotationDeg}
    >
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/compass/WinnerDialog.tsx
git commit -m "Thread rotationDeg through WinnerDialog"
```

---

### Task 5: Compute and pass the angle from `Compass.tsx`

**Files:**
- Modify: `src/pages/Compass.tsx`

- [ ] **Step 1: Import the helper**

In the existing import from `../lib/hand` (currently line 17):

```tsx
import { getWindNameTranslated, nextWind } from "../lib/hand";
```

change to:

```tsx
import {
  getWindNameTranslated,
  nextWind,
  seatRotationDegrees,
} from "../lib/hand";
```

- [ ] **Step 2: Pass the angle in the four-way compass render**

The four-way compass branch (`useFourWayCompass !== "false"`) has one
`WinnerDialog` instance, currently:

```tsx
      {winner != null && (
        <WinnerDialog
          gameId={locState.id}
          game={game}
          winner={winner}
          onClose={() => setWinner(null)}
        />
      )}
```

This is the block directly followed by `{openDrawDialog && (`. Change it to:

```tsx
      {winner != null && (
        <WinnerDialog
          gameId={locState.id}
          game={game}
          winner={winner}
          rotationDeg={seatRotationDegrees(winner)}
          onClose={() => setWinner(null)}
        />
      )}
```

- [ ] **Step 3: Leave the list-mode `WinnerDialog` instance untouched**

The list-layout branch (`useFourWayCompass === "false"`) has its own
`WinnerDialog` instance further down the file. Do **not** pass `rotationDeg`
there — it should keep defaulting to `0`, since the list layout has no
physical seat concept. Confirm by reading the file that this second instance
still reads:

```tsx
      {winner != null && (
        <WinnerDialog
          gameId={locState.id}
          game={game}
          winner={winner}
          onClose={() => setWinner(null)}
        />
      )}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `/` and start a new game so you land on `/compass`
with the four-way compass active (this is the default; the toggle for it —
"Four-way compass" — lives in the new-game dialog opened from the home page,
`src/components/home/NewCompassDialog.tsx`, in case a previous local session
turned it off and it's persisted as `false` in localStorage under
`useFourWayCompass`). Tap the win tile (the seat-wind tile) for each of
the four positions in turn and confirm the `WinnerDialog` that pops up is
visually rotated: upright for the bottom seat, upside-down for the top seat,
and rotated a quarter-turn for the left/right seats. Close each without
submitting (tap the X).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Compass.tsx
git commit -m "Rotate WinnerDialog to match the winning seat in four-way compass"
```

---

### Task 6: Add the `Rotated` full-page wrapper component

**Files:**
- Create: `src/components/layout/Rotated.tsx`

- [ ] **Step 1: Write the component**

```tsx
import clsx from "clsx";
import { type ReactNode } from "react";

/**
 * Rotates full page content to match a seat's orientation. For 90/270 the
 * box's effective on-screen width/height are swapped (via 100vw/100vh) and
 * it's pinned to the viewport so it fills the screen at any aspect ratio;
 * scrolling still works since the browser maps gesture coordinates through
 * the CSS transform.
 */
export default function Rotated({
  angle,
  children,
}: {
  angle: 0 | 90 | 180 | 270;
  children: ReactNode;
}) {
  if (angle === 0) {
    return <>{children}</>;
  }
  const swapped = angle === 90 || angle === 270;
  return (
    <div
      className={clsx(
        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
        swapped ? "h-[100vw] w-[100vh]" : "h-screen w-screen",
        angle === 90 && "rotate-90",
        angle === 180 && "rotate-180",
        angle === 270 && "-rotate-90",
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors (component isn't used anywhere yet, so this only checks
the file itself is well-formed).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Rotated.tsx
git commit -m "Add Rotated full-page rotation wrapper"
```

---

### Task 7: Wrap the Calculator page in `Rotated`

**Files:**
- Modify: `src/pages/Calculator.tsx`

- [ ] **Step 1: Import `Rotated`**

Add to the imports near the top of `src/pages/Calculator.tsx` (alongside the
other `../components/...` imports, e.g. right after the `ScoreResult` import):

```tsx
import Rotated from "../components/layout/Rotated";
```

This repo uses `eslint-plugin-simple-import-sort`, which is strict about
import ordering. If `npm run lint` (Step 3 below) flags this import's
position, run `npx eslint --fix src/pages/Calculator.tsx` to auto-sort it
rather than hand-placing it.

- [ ] **Step 2: Wrap `CalculatorWithGame`'s returned JSX**

`CalculatorWithGame` currently returns (near the end of the function):

```tsx
  return (
    <div className="flex flex-row justify-center">
      <Toaster position="top-center" />
      ...
    </div>
  );
}
```

Change the `return` to wrap that whole `<div>` in `<Rotated>`, using the
rotation angle only when we're in the transfer flow:

```tsx
  const rotationDeg =
    locState.t === "transfer" ? (locState.rotationDeg ?? 0) : 0;

  return (
    <Rotated angle={rotationDeg}>
      <div className="flex flex-row justify-center">
        <Toaster position="top-center" />
        ...
      </div>
    </Rotated>
  );
}
```

(Keep everything currently inside the outer `<div className="flex flex-row
justify-center">...</div>` exactly as-is — only add the `Rotated` wrapper
around it and close the extra tag at the end.)

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification — non-transfer entry unaffected**

Run `npm run dev`, navigate to the calculator directly from the home page
(not via a compass win). Confirm it looks exactly as before (angle is `0`
since `locState.t !== "transfer"`).

- [ ] **Step 5: Manual verification — transfer flow rotates**

From `/compass` with the four-way compass active, tap the win tile at the
**top** seat position, go through `WinnerDialog`, and tap
"compass.calculateHand" (the button that navigates to `/calculator`).
Confirm the entire Calculator page — header, tile grid, buttons, the fixed
back-arrow/settings/jump buttons in the corners — appears upside-down as a
whole (i.e. still internally consistent/readable if you turn your phone
upside-down, not just individual pieces flipped). Enter a hand and confirm
scrolling and tapping tiles still works correctly. Repeat once for the
**left** or **right** seat position and confirm it's rotated a quarter-turn
and still scrollable/usable.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Calculator.tsx
git commit -m "Rotate the Calculator page to match the winning seat"
```

---

### Task 8: Final full-flow verification and build check

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `npm run build`
Expected: builds successfully with no TypeScript or bundling errors.

- [ ] **Step 2: Lint the whole repo**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: End-to-end manual walkthrough**

Using `npm run dev`, on a 4-player game with the four-way compass active,
for **each** of the four seats (bottom/right/top/left):
1. Tap that seat's win tile.
2. Confirm `WinnerDialog` is rotated correctly for that seat.
3. Fill in the point-distribution options and tap "compass.calculateHand".
4. Confirm the Calculator page is rotated correctly for that seat.
5. Enter a full hand (or use the han/fu quick mode) and tap "Transfer
   points" (or the equivalent transfer button).
6. Confirm you land back on `/compass` with scores updated correctly and
   the compass view itself unaffected (unrotated, as before — only the
   winner/calculator flow rotates).

Also repeat step 1-2 once with the four-way compass toggled off (list mode)
and confirm the `WinnerDialog` there is **not** rotated.

If a sanma (3-player) game is easy to set up, repeat for its three seats too
(bottom/right/top only — sanma has no left seat).

- [ ] **Step 4: Final commit if any fixups were needed**

If the walkthrough surfaced any issues and you fixed them, commit those
fixes with a descriptive message following the same pattern as the tasks
above. If everything passed with no changes needed, there's nothing to
commit here.
