export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	AUTO_MODE = "auto";
export const DEFAULT_THEME = AUTO_MODE;
export const THEME_CHANGE_EVENT = "shirone:theme-change";

export const WALLPAPER_MODE_KEY = "wallpaper-mode";
export const WALLPAPER_MODE_CHANGE_EVENT = "wallpaper-mode:change";
export const WALLPAPER_MODE_OPTIONS = [
	"banner",
	"fullscreen",
	"overlay",
	"none",
] as const;

export const FULLSCREEN_LAYOUT_KEY = "wallpaper-fullscreen-layout";
export const FULLSCREEN_LAYOUT_OPTIONS = ["classic", "hero"] as const;

export const WALLPAPER_OVERLAY_OPACITY_KEY = "wallpaper-overlay-opacity";
export const WALLPAPER_OVERLAY_BLUR_KEY = "wallpaper-overlay-blur";
export const WALLPAPER_OVERLAY_CARD_OPACITY_KEY =
	"wallpaper-overlay-card-opacity";
export const WALLPAPER_OVERLAY_CHANGE_EVENT = "wallpaper-overlay:change";

export const BANNER_WAVES_KEY = "wallpaper-banner-waves";
export const BANNER_WAVES_CHANGE_EVENT = "banner-waves:change";

/** 覆盖率透明模式参数的钳位范围 */
export const WALLPAPER_OVERLAY_OPACITY_RANGE = [0, 1] as const;
export const WALLPAPER_OVERLAY_BLUR_RANGE = [0, 20] as const;
export const WALLPAPER_OVERLAY_CARD_OPACITY_RANGE = [0, 1] as const;

export const TEXTURE_PRESET_KEY = "texture-preset";
export const TEXTURE_OPACITY_KEY = "texture-opacity";
export const TEXTURE_CHANGE_EVENT = "texture:change";
export const TEXTURE_PRESETS = [
	"none",
	"starlight",
	"cyber-dots",
	"topography",
	"geometric",
	"sakura",
] as const;

// Banner height unit: vh
export const BANNER_HEIGHT = 100;
export const BANNER_HEIGHT_EXTEND = 0;
export const BANNER_HEIGHT_HOME = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem
// Keep a small overlap so the content frame meets the wave edge naturally.
export const MAIN_PANEL_OVERLAPS_BANNER_HEIGHT = 1;

// Page width: rem. Single sidebar uses PAGE_WIDTH; dual-column
// arrangement widens the frame one tier (resolved in responsive-utils).
export const PAGE_WIDTH = 85;
export const PAGE_WIDTH_DUAL = 96;
