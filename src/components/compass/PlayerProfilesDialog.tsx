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
