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
