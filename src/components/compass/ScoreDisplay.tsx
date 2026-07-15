import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMusicNote } from "react-icons/hi";

import { type Wind } from "../../lib/hand";
import TileButton from "../calculator/TileButton";
import H from "../text/H";

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
  const { t } = useTranslation();
  const [animDone, setAnimDone] = useState(false);
  useEffect(() => {
    if (oldScore !== score) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimDone(false);
    }
  }, [score, oldScore]);
  const dices = isSanma
    ? [
        [1, 4, 7, 10],
        [2, 5, 8, 11],
        [3, 6, 9, 12],
      ][Number(seatWind) - 1]
    : [
        [1, 5, 9],
        [2, 6, 10],
        [3, 7, 11],
        [4, 8, 12],
      ][Number(seatWind) - 1];
  return (
    <div
      className={clsx(
        vertical
          ? "flex h-full w-31 flex-row-reverse tablet:w-45"
          : "flex h-31 w-full flex-col tablet:h-45",
        "items-center justify-center gap-1",
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center gap-2",
          vertical ? "flex-col" : "flex-row",
        )}
      >
        <button
          onClick={onRiichiClick}
          aria-label={
            nowPlaying
              ? `${t("compass.riichi")} - ${t("compass.nowPlaying")}`
              : t("compass.riichi")
          }
          className={clsx(
            "relative rounded-xl border border-gray-800 text-center text-sm shadow tablet:text-2xl",
            vertical
              ? "h-40 w-9 px-1.5 py-8 tablet:h-80 tablet:w-14"
              : "h-9 w-40 px-8 py-1.5 tablet:h-14 tablet:w-80",
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
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow tablet:h-7 tablet:w-7 dark:bg-slate-100 dark:text-black"
              title={t("compass.nowPlaying")}
              aria-hidden="true"
            >
              <HiMusicNote className="text-xs tablet:text-base" />
            </span>
          )}
        </button>
        {playerLabel && (
          <div className={clsx(vertical ? "w-9 text-center tablet:w-14" : "")}>
            <span
              className={clsx(
                "text-sm font-bold tablet:text-2xl",
                vertical ? "[writing-mode:vertical-rl]" : "",
              )}
            >
              {playerLabel}
            </span>
          </div>
        )}
      </div>
      <div
        className={clsx(
          vertical
            ? "flex h-full w-fit flex-col p-1.5 tablet:px-4 tablet:py-2"
            : "flex h-fit w-full flex-row p-1.5 tablet:px-2 tablet:py-4",
          "items-center justify-between rounded-xl bg-slate-300 shadow dark:bg-sky-900",
        )}
      >
        <span
          className={clsx(
            isSanma
              ? vertical
                ? "h-5 w-16 [writing-mode:vertical-rl] tablet:w-20"
                : "h-16 w-5 tablet:h-20"
              : vertical
                ? "h-5 w-12 [writing-mode:vertical-rl] tablet:w-20"
                : "h-12 w-5 tablet:h-20",
            isSanma ? "tablet:text-sm" : "tablet:text-lg",
            "text-center text-xs font-semibold text-slate-900 dark:text-slate-400",
          )}
        >
          {dices.map((x, i, a) => (
            <>
              {x}
              {i !== a.length && <br />}
            </>
          ))}
        </span>
        <button
          className={clsx(
            "text-4xl font-bold tablet:text-6xl",
            vertical ? "h-52 w-12 tablet:w-20" : "h-12 w-52 tablet:h-20",
          )}
          onClick={onScoreClick}
        >
          <span className={clsx(vertical ? "[writing-mode:vertical-rl]" : "")}>
            {animDone || oldScore === score ? (
              <H>{score}</H>
            ) : oldScore > score ? (
              <H.Red>
                <AnimatedIncrement
                  start={oldScore / 100}
                  end={score / 100}
                  map={(x) => x * 100}
                  duration={1000}
                  onDone={() => setAnimDone(true)}
                />
              </H.Red>
            ) : (
              <H>
                <AnimatedIncrement
                  start={oldScore / 100}
                  end={score / 100}
                  map={(x) => x * 100}
                  duration={1000}
                  onDone={() => setAnimDone(true)}
                />
              </H>
            )}
          </span>
        </button>
        <div
          className={clsx(
            vertical ? "mx-2 -my-2 rotate-90" : "",
            "flex flex-col items-center justify-center",
          )}
        >
          <TileButton
            onClick={onTileClick}
            red={seatWind === "1"}
            tile={`${seatWind}z`}
          ></TileButton>
        </div>
      </div>
    </div>
  );
}

function AnimatedIncrement({
  start,
  end,
  map = (x) => x,
  duration,
  onDone,
}: {
  start: number;
  end: number;
  map?: (n: number) => number;
  duration: number;
  onDone?: () => void;
}) {
  const [value, setValue] = useState(start);
  const startTimestamp = useRef<number | null>(null);
  const step = (timestamp: number) => {
    if (!startTimestamp.current) startTimestamp.current = timestamp;
    const progress = Math.min(
      (timestamp - startTimestamp.current) / duration,
      1,
    );
    setValue(map(Math.floor(progress * (end - start) + start)));
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };
  // eslint-disable-next-line react-hooks/refs
  window.requestAnimationFrame(step);
  return <span>{value}</span>;
}
