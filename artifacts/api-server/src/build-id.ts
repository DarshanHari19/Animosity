// Replaced by esbuild, never taken from request input or runtime environment.
declare const __ANIMOSITY_BUILD_ID__: string;
export const BUILD_ID = typeof __ANIMOSITY_BUILD_ID__ === "undefined"
  ? "unbuilt" // Direct source imports in unit tests only.
  : __ANIMOSITY_BUILD_ID__;
