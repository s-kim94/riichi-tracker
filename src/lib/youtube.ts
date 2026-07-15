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
