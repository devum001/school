/*
 * GENERATED FILE — do not edit.
 * Source: scripts/generate-compass-keyframes.mjs
 *
 * Shared between the SVG markup and the baked keyframes so the drawing, the
 * compass pose and the ink path can never drift apart.
 */

/** Square viewBox; the scene is authored in these units. */
export const VIEW_BOX = "12 2 76 76";

/** Needle point — the pivot, and the centre of the drawn circle. */
export const CENTER = { x: 50, y: 63 } as const;

/** Hinge, directly above the needle on the axis of rotation (never moves). */
export const HINGE = { x: 50, y: 19 } as const;

/** Nominal pencil-leg length: hinge → tip before foreshortening. */
export const LEG_LENGTH = 52;

/** Ground-plane circle as projected into the 3/4 view. */
export const ELLIPSE = { rx: 25, ry: 8 } as const;

/**
 * The drawn circle, starting at the pencil's resting point and running
 * clockwise. pathLength is normalised to 100 so dash values are percentages.
 */
export const INK_PATH =
  "M 32.322 57.343 A 25 8 0 1 1 67.678 68.657" +
  " A 25 8 0 1 1 32.322 57.343 Z";
