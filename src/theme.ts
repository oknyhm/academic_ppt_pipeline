export const SLIDE_WIDTH = 13.333;
export const SLIDE_HEIGHT = 7.5;

export const SAFE_MARGINS = {
  left: 0.55,
  right: 0.55,
  top: 0.35,
  bottom: 0.35,
} as const;

export const THEME = {
  colors: {
    primary: "003B70",
    secondary: "2F6FA3",
    accent: "56A0D3",
    background: "F7F9FC",
    surface: "FFFFFF",
    textPrimary: "182230",
    textSecondary: "52606D",
    divider: "D7E0E8",
    warning: "C2413B",
  },
  fonts: {
    chinese: "Microsoft YaHei",
    english: "Aptos",
    code: "Consolas",
  },
  fontSizes: {
    coverTitle: 32,
    slideTitle: 26,
    sectionHeading: 20,
    body: 18,
    caption: 12,
    footer: 10,
    minimum: 11,
  },
} as const;
