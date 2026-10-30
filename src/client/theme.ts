/**
 * Skin tokens. Everything here is an alias-token override folded into the
 * active theme snapshot by ui-theme, so the palette keeps working in both
 * schemes and the skin never patches a component's stylesheet.
 *
 * Values are measured from `reference/screenshot.png` (2604x1480 at DPR 2):
 * the sidebar edge sits at x=483, the hero tile at 1465..1620 / 465..609, the
 * suggestion chips at 854..921, the workspace tray at 807..2278 / 1188..1297.
 */
export const SKIN_TOKENS = {
  // Surfaces
  '--dsw-alias-bg-base': { light: '#FFFFFF', dark: '#141414' },
  '--dsw-alias-bg-layer-1': { light: '#FFFFFF', dark: '#1C1C1C' },
  '--dsw-alias-bg-layer-2': { light: '#FFFFFF', dark: '#232323' },
  '--dsw-alias-bg-layer-3': { light: '#F3F3F3', dark: '#2A2A2A' },
  '--dsw-alias-bg-module-platform': { light: '#F3F3F3', dark: '#2A2A2A' },
  // Labels
  '--dsw-alias-label-primary': { light: '#0D0D0D', dark: '#F5F5F5' },
  '--dsw-alias-label-secondary': { light: '#5F5F5A', dark: '#A3A3A0' },
  '--dsw-alias-label-tertiary': { light: '#8A8A85', dark: '#7A7A76' },
  // Borders
  '--dsw-alias-border-l1': { light: '#EFEFEF', dark: '#2E2E2E' },
  '--dsw-alias-border-l2': { light: '#EBEBEB', dark: '#333333' },
  '--dsw-alias-border-l3': { light: '#E3E3E3', dark: '#3A3A3A' },
  '--dsw-alias-border-l4': { light: '#D8D8D8', dark: '#444444' },
  // Geometry
  '--dsw-radius-sm': { light: '8px', dark: '8px' },
  '--dsw-radius-md': { light: '12px', dark: '12px' },
  '--dsw-radius-lg': { light: '16px', dark: '16px' },
  '--dsw-radius-xl': { light: '24px', dark: '24px' },
  '--dsw-radius-panel': { light: '28px', dark: '28px' },
  // Elevation
  '--dsw-shadow-lv1': { light: '0 2px 4px 0 rgba(0,0,0,0.04)', dark: '0 2px 4px 0 rgba(0,0,0,0.4)' },
  '--dsw-shadow-lv2': {
    light: '0 8px 24px 0 rgba(0,0,0,0.06), 0 2px 8px 0 rgba(0,0,0,0.04)',
    dark: '0 8px 24px 0 rgba(0,0,0,0.5), 0 2px 8px 0 rgba(0,0,0,0.4)',
  },
  '--dsw-shadow-lv3': {
    light: '0 18px 48px 0 rgba(0,0,0,0.08), 0 4px 12px 0 rgba(0,0,0,0.04)',
    dark: '0 18px 48px 0 rgba(0,0,0,0.6), 0 4px 12px 0 rgba(0,0,0,0.4)',
  },
}
