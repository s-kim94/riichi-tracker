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
  const readyRef = useRef(false);

  useEffect(() => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "1px";
    container.style.height = "1px";
    container.style.opacity = "0";
    container.style.overflow = "hidden";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    let destroyed = false;
    void loadYouTubeApi().then((YT) => {
      if (destroyed) {
        return;
      }
      playerRef.current = new YT.Player(container, {
        events: {
          onReady: () => {
            readyRef.current = true;
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
      readyRef.current = false;
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
    if (playerRef.current && readyRef.current) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.playVideo();
      setNowPlayingSeat(ix);
    } else {
      // Player is still being created, or constructed but not yet past its
      // real onReady event — queue it, and onReady will play it once ready.
      pendingRef.current = { ix, videoId };
    }
  };

  return { nowPlayingSeat, playForSeat };
}
