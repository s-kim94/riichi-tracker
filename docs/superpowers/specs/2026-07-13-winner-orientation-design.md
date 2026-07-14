# Winner-orientation rotation — design

## Problem

The four-way compass view (`pages/Compass.tsx`) already lays players out around a
shared, tabletop-style device: each player's `ScoreDisplay` is drawn at a fixed
screen quadrant (bottom/right/top/left, by player index `ix` 0-3) and rotated so
that player can read their own score right-side up from their physical seat.

That rotation stops at the score display. When a player taps their tile to
declare a win, `WinnerDialog` opens (unrotated) and then navigates to the
full-page `Calculator` (also unrotated) to enter the hand and confirm the score.
Anyone not sitting at the bottom seat has to read those screens upside-down or
sideways.

## Goal

Rotate `WinnerDialog` and the `Calculator` page to match the winning seat's
orientation, so the whole win-declaration-through-scoring flow reads correctly
from that player's physical position — for all four seat orientations (0°,
90°, 180°, 270°), matching the existing four-way compass exactly.

## Scope

- Applies only when the four-way compass is active
  (`useFourWayCompass !== "false"`). The list layout has no physical seat
  concept, so winner dialogs opened from there stay unrotated (angle `0`).
- Covers `WinnerDialog` and the `Calculator` page reached via the "transfer"
  flow. Other dialogs (`ScoreUpdateDialog`, `DrawDialog`, `AdvancedDialog`) are
  unaffected.
- Rotation is always recomputed fresh from whoever opens the flow (the seat
  index of the winning tile that was tapped) — it is not a sticky/stored
  setting, so re-opening for a different seat naturally picks up that seat's
  angle.

## Rotation angle

The four-way compass places players at fixed screen quadrants by index:
`ix0` = bottom, `ix1` = right, `ix2` = top, `ix3` = left. Working out the
rotation already implicit in `ScoreDisplay`'s `vertical` + `rotate-180`
combination, the pattern is:

```
angle(ix) = (360 - 90 * ix) % 360
```

i.e. 0°, 270°, 180°, 90° for `ix` 0-3. Sanma games only ever use `ix` 0/1/2 (no
left seat), so only 0°/270°/180° are reachable there.

This becomes a shared helper, `seatRotationDegrees(ix: number): 0 | 90 | 180 | 270`,
in `lib/hand.ts`.

## Rotation wrapper

A new component, `components/layout/Rotated.tsx`:

```
<Rotated angle={0 | 90 | 180 | 270}>{children}</Rotated>
```

- `angle === 0`: renders `children` directly, no wrapper overhead.
- `angle === 180`: a simple `rotate-180` wrapper — no footprint change.
- `angle === 90 | 270`: the content's effective on-screen width/height swap.
  To guarantee it still fits the viewport regardless of device aspect ratio,
  the rotated box is bounded to a `vmin`-based square-ish area (capped by
  whichever of viewport width/height is smaller), centered via fixed
  positioning, and rotated around its own center. Scrolling still works
  inside it — the browser maps touch/mouse gesture coordinates through the
  CSS transform, so drag-to-scroll feels correct from the rotated viewer's
  perspective.

Fixed-position UI inside the rotated content (back arrow, settings gear, jump
buttons on the Calculator page) rotates along with everything else, since it's
all inside the same wrapper — from the winner's point of view those controls
still sit in the visually-correct corner.

## Data flow

1. `pages/Compass.tsx` already knows both whether four-way mode is active and
   which `ix` was tapped as the winner. It computes:
   ```
   rotationDeg = useFourWayCompass !== "false" ? seatRotationDegrees(ix) : 0
   ```
   and passes it into `WinnerDialog`.
2. `components/compass/WinnerDialog.tsx` accepts `rotationDeg` and:
   - passes it to `CustomDialog` (see below) so the dialog itself rotates.
   - includes it in the `CalculatorState` it builds when navigating to
     `/calculator`.
3. `lib/states.ts`: the `"transfer"` variant of `CalculatorState` gets a new
   optional field `rotationDeg?: 0 | 90 | 180 | 270`.
4. `pages/Calculator.tsx`: when `locState.t === "transfer"`, wraps its
   top-level page content in `<Rotated angle={locState.rotationDeg ?? 0}>`.

## CustomDialog change

`components/layout/CustomDialog.tsx` gets a new optional prop `rotationDeg`
(default `0`), and wraps its whole panel (title bar + close button + content)
in `<Rotated>`. The prop is optional and defaults to `0`, so every other
existing call site is unaffected.

## Out of scope

- No manual override/flip control — the four-way compass already assumes a
  fixed physical seat-to-quadrant mapping, and this feature just extends that
  same assumption through the winner flow.
- No changes to `ScoreUpdateDialog`, `DrawDialog`, or `AdvancedDialog`.
