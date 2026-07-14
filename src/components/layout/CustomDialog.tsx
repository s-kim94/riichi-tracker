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
