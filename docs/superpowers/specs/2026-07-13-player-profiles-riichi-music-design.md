# Player profiles & riichi music — design

## Problem

This app is used as a shared, pass-around scorekeeper for a physical mahjong
table (the four-way compass already treats each screen quadrant as a fixed
physical seat). Right now players are anonymous — the list layout shows
hardcoded "P1"-"P4" labels, and the four-way compass shows no name at all.

The user wants two related things:

1. Each physical seat can have a name, set once and editable any time.
2. Each seat can also have a YouTube link. When that seat calls riichi (taps
   the riichi button, going from not-in-riichi to in-riichi), their chosen
   song plays from the device. If multiple players are in riichi, whoever
   called it most recently is the one whose song is currently playing.

## Scope

- Applies to **both** the four-way compass and the list layout (riichi is
  riichi regardless of layout).
- YouTube only. Spotify would require a Developer app registration, OAuth
  login per player, and a Premium account for playback to work at all — out
  of scope for this pass.
- Names and links are edited from a single dialog on the Compass page,
  listing every seat (3 rows for sanma, 4 for yonma). This dialog is reachable
  any time during play, not a one-time setup step — reopening it and changing
  a name or link takes effect immediately, including mid-round.
- Storage is localStorage, keyed by physical seat quadrant (index 0-3, the
  same indexing already used throughout `Compass.tsx`), persisting across
  games on this device — matching how players physically keep the same seat
  for a whole session.
- No manual stop/mute control in the app. No auto-stop on un-riichi or round
  end either — once a song starts, it plays to completion, or gets replaced
  the moment another seat calls riichi. (The user can mute the device itself
  if they want silence sooner.)
- A small "now playing" indicator (a music-note badge on the riichi button)
  shows which seat's song is currently playing, clearing when replaced or
  when the video ends naturally.

## Data model

New localStorage key, `playerProfiles`, holding a JSON-encoded array of up to
4 entries:

```ts
interface PlayerProfile {
  name: string;
  youtubeUrl: string;
}
```

Indexed the same way every other per-seat array in this codebase already is
(`ix` 0-3, matching `game.riichi`, `game.scores`, etc.) — entry `i` is "the
profile for whoever is physically sitting in screen quadrant `i`", independent
of that seat's current wind (which rotates every hand) or which specific game
is active.

A small hook, `usePlayerProfiles()` (in `src/hooks/usePlayerProfiles.ts`),
wraps the existing string-only `useLocalStorage("playerProfiles")` hook with
JSON parse/stringify and a sensible default (empty name/link per seat) so
callers work with a typed array directly.

## Profile editing dialog

New component, `src/components/compass/PlayerProfilesDialog.tsx`, opened via
a new icon button on the Compass page (alongside the existing gear/Advanced
icon). One row per seat (respecting `isSanma`, same as `AdvancedDialog` and
others already do), each row has:

- A text input for the name.
- A text input for the YouTube link.

Saves go straight to `usePlayerProfiles()`'s setter — there's no separate
"save" step, changes are live localStorage writes, same pattern as
`PreferencesDialog`. This is what makes it "always editable" — reopening the
dialog mid-round and changing a link takes effect the next time that seat
calls riichi.

No URL validation beyond what's needed to extract a video ID at playback
time (see below) — an unparseable link just means nothing plays for that
seat, no error shown.

## YouTube playback

A small utility, `src/lib/youtube.ts`, exports
`extractYouTubeVideoId(url: string): string | null`, handling the common URL
shapes (`youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/embed/<id>`,
tolerating extra query params like timestamps).

A new hook, `src/hooks/useRiichiMusicPlayer.ts`, owns a **single** YouTube
IFrame Player instance (loading the IFrame Player API script once, lazily,
on first use) for the whole Compass session — not one per seat. It exposes:

```ts
function useRiichiMusicPlayer(): {
  nowPlayingSeat: number | null;
  playForSeat: (ix: number, youtubeUrl: string) => void;
};
```

`playForSeat` extracts the video ID and loads/plays it on the shared player
instance, autoplaying — this is allowed by browser autoplay-gesture rules
since it's called synchronously from the riichi button's own click handler.
Because there's only one shared instance, calling `playForSeat` for a new
seat naturally replaces whatever was previously loaded — this is what
satisfies "later riichi call takes over" for free, with no extra
bookkeeping. `nowPlayingSeat` updates to the new seat immediately, and clears
to `null` when the underlying player reports the video has ended (there is
no other way it clears — no un-riichi/round-end/manual stop, per scope
above).

The player itself is visually hidden (not meant to be watched, just heard).

## Integration point

`Compass.tsx`'s existing `toggleRiichiStick(ix)` (shared by both the
four-way and list layout branches already) is the single place this hooks
in: when the transition is false→true (declaring riichi, not cancelling
it), look up `profiles[ix].youtubeUrl` and call `playForSeat(ix, url)` if
it's non-empty. No changes needed for the false transition (cancelling
riichi) — per scope, cancelling doesn't affect playback.

## Name display

Both layouts read from `usePlayerProfiles()` and pass the seat's name as
`playerLabel` into `ScoreDisplayInCompass`/`ScoreDisplay`, falling back to
the existing "P1"-style default when a seat's name is empty. This replaces
the currently-hardcoded `playerLabel="P1"` etc. in the list layout, and adds
a label to the four-way compass layout, which currently has none.

## Now-playing indicator

`ScoreDisplay.tsx` gets a new optional prop (e.g. `nowPlaying?: boolean`).
When true, a small music-note badge renders on the riichi button (the same
button already used to declare/cancel riichi and shown highlighted amber
when that seat is in riichi). `Compass.tsx` passes
`nowPlaying={nowPlayingSeat === ix}` down for each seat, in both layouts.

## Out of scope

- Spotify support of any kind.
- Any manual stop/mute control in the app.
- Auto-stopping playback on un-riichi or round end.
- Per-game or per-round overrides of the name/link — it's a single,
  device-wide profile per seat.
