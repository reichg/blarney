// Shared cap for how many variants a single marketplace listing may have.
// Pure constant module (no server-only imports) so it is safe to import from
// both server modules and client components.
export const MAX_LISTING_VARIANTS = 8;
