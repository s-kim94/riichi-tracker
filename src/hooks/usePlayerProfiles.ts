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
