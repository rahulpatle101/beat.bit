// Feature flags (V3.1). BEAT.BIT is a living music toy; the V3.0 Arcade layer (Wake the City,
// XP, stars, ranks, F/J timing controls) is kept in the codebase but switched off.
// Developers can re-enable it locally with VITE_FEATURE_ARCADE=true (e.g. in .env.local).

export const FEATURES = {
  arcade: import.meta.env.VITE_FEATURE_ARCADE === 'true',
} as const
