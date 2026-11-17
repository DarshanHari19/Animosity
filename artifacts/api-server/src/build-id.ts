// Replaced by esbuild, never taken from request input or runtime environment.
declare const __ANIMOSITY_BUILD_ID__: string;
declare const __ANIMOSITY_COMMIT__: string;
export const BUILD_ID = typeof __ANIMOSITY_BUILD_ID__ === "undefined"
  ? "unbuilt" // Direct source imports in unit tests only.
  : __ANIMOSITY_BUILD_ID__;
/** Git commit SHA of the build, or undefined when the host did not provide one. */
export const COMMIT: string | undefined = typeof __ANIMOSITY_COMMIT__ === "undefined" || !__ANIMOSITY_COMMIT__
  ? undefined : __ANIMOSITY_COMMIT__;
