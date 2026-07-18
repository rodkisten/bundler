/** Shared semantic value tokens used by normalization and authoring helpers. */
export const TEXT_SIZE_TOKENS = new Set([
  'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
])

export const RADIUS_TOKENS = new Set([
  'none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full', 'pill',
])

export const SHADOW_TOKENS = new Set([
  'none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'glow', 'panel', 'neon',
])

export const TRANSITION_PRESETS: Readonly<Record<string, string>> = {
  colors: 'color 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
  transform: 'transform 160ms ease',
  opacity: 'opacity 160ms ease',
  all: 'all 160ms ease',
  fast: '120ms ease',
  normal: '180ms ease',
  slow: '320ms ease',
}

export const ANIMATION_PRESETS: Readonly<Record<string, string>> = {
  'fade-in': 'fade-in 180ms ease-out both',
  'fade-out': 'fade-out 180ms ease-in both',
  'slide-up': 'slide-up 220ms ease-out both',
  'scale-in': 'scale-in 160ms ease-out both',
}
