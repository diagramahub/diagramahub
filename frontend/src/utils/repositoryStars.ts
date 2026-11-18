/** About page: how to talk about the repository's GitHub stars. */

/** Below this, the count isn't the hook: invite to be among the first. */
export const STARS_SPOTLIGHT_FROM = 50;

export function starsSpotlight(stars: number | null | undefined): boolean {
  return typeof stars === 'number' && stars >= STARS_SPOTLIGHT_FROM;
}

/** 1234 -> "1.2K" / "1,2 mil": compact from 10 000, exact below. */
export function formatStars(stars: number, locale: string): string {
  return new Intl.NumberFormat(locale, stars >= 10_000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(stars);
}
