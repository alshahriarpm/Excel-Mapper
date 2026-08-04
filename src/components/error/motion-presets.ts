import type { Variants } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export type MotionSet = { container: Variants; item: Variants };

export function makeMotionSet(still: boolean): MotionSet {
  if (still) {
    return {
      container: { hidden: {}, show: {} },
      item: { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } },
    };
  }
  return {
    container: {
      hidden: {},
      show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
    },
    item: {
      hidden: { opacity: 0, y: 10 },
      show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
    },
  };
}
