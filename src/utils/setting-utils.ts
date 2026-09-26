import {
	AUTO_MODE,
	BANNER_WAVES_CHANGE_EVENT,
	BANNER_WAVES_KEY,
	DARK_MODE,
	DEFAULT_THEME,
	FULLSCREEN_LAYOUT_KEY,
	FULLSCREEN_LAYOUT_OPTIONS,
	LIGHT_MODE,
	TEXTURE_CHANGE_EVENT,
	TEXTURE_OPACITY_KEY,
	TEXTURE_PRESET_KEY,
	TEXTURE_PRESETS,
	THEME_CHANGE_EVENT,
	WALLPAPER_MODE_CHANGE_EVENT,
	WALLPAPER_MODE_KEY,
	WALLPAPER_MODE_OPTIONS,
	WALLPAPER_OVERLAY_BLUR_KEY,
	WALLPAPER_OVERLAY_BLUR_RANGE,
	WALLPAPER_OVERLAY_CARD_OPACITY_KEY,
	WALLPAPER_OVERLAY_CARD_OPACITY_RANGE,
	WALLPAPER_OVERLAY_CHANGE_EVENT,
	WALLPAPER_OVERLAY_OPACITY_KEY,
	WALLPAPER_OVERLAY_OPACITY_RANGE,
} from "@constants/constants.ts";
import { applyCurrentScheme } from "@utils/theme-utils";
import { expressiveCodeConfig, siteConfig } from "@/config";
import type {
	FullscreenLayout,
	LIGHT_DARK_MODE,
	WallpaperMode,
} from "@/types/config";
import type { TexturePreset } from "@/types/textureConfig";

export function isTexturePreset(value: unknown): value is TexturePreset {
	return (
		typeof value === "string" &&
		(TEXTURE_PRESETS as readonly string[]).includes(value)
	);
}

export function getDefaultTexturePreset(): TexturePreset {
	const textureCfg =
		typeof siteConfig.texture === "object" ? siteConfig.texture : undefined;
	const fallback = textureCfg?.defaultPreset ?? "starlight";
	const value =
		document.getElementById("config-carrier")?.dataset.texturePreset;
	return isTexturePreset(value) ? value : fallback;
}

export function getStoredTexturePreset(): TexturePreset {
	const value = localStorage.getItem(TEXTURE_PRESET_KEY);
	return isTexturePreset(value) ? value : getDefaultTexturePreset();
}

export function setTexturePreset(preset: TexturePreset): void {
	localStorage.setItem(TEXTURE_PRESET_KEY, preset);
	document.documentElement.dataset.texturePreset = preset;
	window.dispatchEvent(
		new CustomEvent(TEXTURE_CHANGE_EVENT, {
			detail: { preset, opacity: getStoredTextureOpacity() },
		}),
	);
}

export function getDefaultTextureOpacity(): number {
	const textureCfg =
		typeof siteConfig.texture === "object" ? siteConfig.texture : undefined;
	const fallback = textureCfg?.defaultOpacity ?? 0.12;
	const carrier = document.getElementById("config-carrier");
	const val = carrier?.dataset.textureOpacity;
	if (val) {
		const parsed = Number.parseFloat(val);
		if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
			return parsed;
		}
	}
	return fallback;
}

export function getStoredTextureOpacity(): number {
	const value = localStorage.getItem(TEXTURE_OPACITY_KEY);
	if (value) {
		const parsed = Number.parseFloat(value);
		if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
			return parsed;
		}
	}
	return getDefaultTextureOpacity();
}

export function setTextureOpacity(opacity: number): void {
	const clamped = Math.min(Math.max(opacity, 0), 1);
	localStorage.setItem(TEXTURE_OPACITY_KEY, String(clamped));
	document.documentElement.style.setProperty(
		"--texture-opacity",
		String(clamped),
	);
	window.dispatchEvent(
		new CustomEvent(TEXTURE_CHANGE_EVENT, {
			detail: { preset: getStoredTexturePreset(), opacity: clamped },
		}),
	);
}

export function isWallpaperMode(value: unknown): value is WallpaperMode {
	return (
		typeof value === "string" &&
		(WALLPAPER_MODE_OPTIONS as readonly string[]).includes(value)
	);
}

export function getDefaultWallpaperMode(): WallpaperMode {
	const value =
		document.getElementById("config-carrier")?.dataset.wallpaperMode;
	return isWallpaperMode(value) ? value : "none";
}

export function getStoredWallpaperMode(): WallpaperMode {
	const value = localStorage.getItem(WALLPAPER_MODE_KEY);
	return isWallpaperMode(value) ? value : getDefaultWallpaperMode();
}

export function setWallpaperMode(mode: WallpaperMode): void {
	localStorage.setItem(WALLPAPER_MODE_KEY, mode);
	document.documentElement.dataset.wallpaperMode = mode;
	applyCardTransparent();
	window.dispatchEvent(
		new CustomEvent(WALLPAPER_MODE_CHANGE_EVENT, { detail: { mode } }),
	);
}

/* ---------- 全屏壁纸子布局 ---------- */

export function isFullscreenLayout(value: unknown): value is FullscreenLayout {
	return (
		typeof value === "string" &&
		(FULLSCREEN_LAYOUT_OPTIONS as readonly string[]).includes(value)
	);
}

export function getDefaultFullscreenLayout(): FullscreenLayout {
	const fallback = siteConfig.wallpaperMode.defaultFullscreenLayout ?? "classic";
	const value =
		document.getElementById("config-carrier")?.dataset.fullscreenLayout;
	return isFullscreenLayout(value) ? value : fallback;
}

export function getStoredFullscreenLayout(): FullscreenLayout {
	const value = localStorage.getItem(FULLSCREEN_LAYOUT_KEY);
	return isFullscreenLayout(value) ? value : getDefaultFullscreenLayout();
}

export function setFullscreenLayout(layout: FullscreenLayout): void {
	localStorage.setItem(FULLSCREEN_LAYOUT_KEY, layout);
	document.documentElement.dataset.fullscreenLayout = layout;
	applyCardTransparent();
	window.dispatchEvent(
		new CustomEvent(WALLPAPER_MODE_CHANGE_EVENT, {
			detail: { mode: getStoredWallpaperMode() },
		}),
	);
}

/**
 * 半透明卡片是**派生**状态，不由访客直接设置：覆盖透明模式恒开启；
 * 全屏壁纸只在 `hero` 子布局下开启（`classic` 是揭幕式 hero，内容仍在不透明卡片上）。
 * 与首屏内联脚本中的同一判定保持一致。
 */
export function shouldUseTransparentCards(
	mode: WallpaperMode,
	layout: FullscreenLayout,
): boolean {
	return mode === "overlay" || (mode === "fullscreen" && layout === "hero");
}

function applyCardTransparent(): void {
	document.documentElement.dataset.cardTransparent = String(
		shouldUseTransparentCards(
			getStoredWallpaperMode(),
			getStoredFullscreenLayout(),
		),
	);
}

/* ---------- 覆盖透明参数 ---------- */

function clampToRange(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function readStoredNumber(key: string, min: number, max: number): number | null {
	const raw = localStorage.getItem(key);
	if (raw === null) return null;
	const parsed = Number.parseFloat(raw);
	if (Number.isNaN(parsed)) return null;
	return clampToRange(parsed, min, max);
}

function readDatasetNumber(
	name: string,
	fallback: number,
	min: number,
	max: number,
): number {
	const raw = document.getElementById("config-carrier")?.dataset[name];
	if (raw === undefined || raw === "") return clampToRange(fallback, min, max);
	const parsed = Number.parseFloat(raw);
	return Number.isNaN(parsed)
		? clampToRange(fallback, min, max)
		: clampToRange(parsed, min, max);
}

export function getDefaultOverlayOpacity(): number {
	return readDatasetNumber(
		"overlayOpacity",
		siteConfig.wallpaperMode.overlay?.opacity ?? 0.8,
		...WALLPAPER_OVERLAY_OPACITY_RANGE,
	);
}

export function getDefaultOverlayBlur(): number {
	return readDatasetNumber(
		"overlayBlur",
		siteConfig.wallpaperMode.overlay?.blur ?? 0,
		...WALLPAPER_OVERLAY_BLUR_RANGE,
	);
}

export function getDefaultOverlayCardOpacity(): number {
	return readDatasetNumber(
		"overlayCardOpacity",
		siteConfig.wallpaperMode.overlay?.cardOpacity ?? 0.6,
		...WALLPAPER_OVERLAY_CARD_OPACITY_RANGE,
	);
}

export function getStoredOverlayOpacity(): number {
	return (
		readStoredNumber(WALLPAPER_OVERLAY_OPACITY_KEY, 0, 1) ??
		getDefaultOverlayOpacity()
	);
}

export function getStoredOverlayBlur(): number {
	return (
		readStoredNumber(
			WALLPAPER_OVERLAY_BLUR_KEY,
			...WALLPAPER_OVERLAY_BLUR_RANGE,
		) ?? getDefaultOverlayBlur()
	);
}

export function getStoredOverlayCardOpacity(): number {
	return (
		readStoredNumber(
			WALLPAPER_OVERLAY_CARD_OPACITY_KEY,
			...WALLPAPER_OVERLAY_CARD_OPACITY_RANGE,
		) ?? getDefaultOverlayCardOpacity()
	);
}

/** 三个覆盖透明参数一次性落位（与 setTextureOpacity 同构，变量名跟随上游契约） */
export function setWallpaperOverlay(params: {
	opacity: number;
	blur: number;
	cardOpacity: number;
}): void {
	const opacity = clampToRange(params.opacity, 0, 1);
	const blur = clampToRange(params.blur, 0, 20);
	const cardOpacity = clampToRange(params.cardOpacity, 0, 1);
	localStorage.setItem(WALLPAPER_OVERLAY_OPACITY_KEY, String(opacity));
	localStorage.setItem(WALLPAPER_OVERLAY_BLUR_KEY, String(blur));
	localStorage.setItem(WALLPAPER_OVERLAY_CARD_OPACITY_KEY, String(cardOpacity));
	const root = document.documentElement;
	root.style.setProperty("--overlay-opacity", String(opacity));
	root.style.setProperty("--overlay-blur", `${blur}px`);
	root.style.setProperty("--card-transparent-opacity", String(cardOpacity));
	window.dispatchEvent(
		new CustomEvent(WALLPAPER_OVERLAY_CHANGE_EVENT, {
			detail: { opacity, blur, cardOpacity },
		}),
	);
}

/* ---------- 横幅水波纹访客开关 ---------- */

export function getDefaultBannerWavesEnabled(): boolean {
	const raw =
		document.getElementById("config-carrier")?.dataset.bannerWavesEnabled;
	if (raw === "true") return true;
	if (raw === "false") return false;
	return siteConfig.banner.waves.enable;
}

export function getStoredBannerWavesEnabled(): boolean {
	const raw = localStorage.getItem(BANNER_WAVES_KEY);
	if (raw === "true") return true;
	if (raw === "false") return false;
	return getDefaultBannerWavesEnabled();
}

export function setBannerWavesEnabled(enabled: boolean): void {
	localStorage.setItem(BANNER_WAVES_KEY, String(enabled));
	document.documentElement.dataset.bannerWavesEnabled = String(enabled);
	window.dispatchEvent(
		new CustomEvent(BANNER_WAVES_CHANGE_EVENT, { detail: { enabled } }),
	);
}

export function getDefaultHue(): number {
	const fallback = "250";
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getHue(): number {
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
	applyCurrentScheme();
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE) {
	switch (theme) {
		case LIGHT_MODE:
			document.documentElement.classList.remove("dark");
			break;
		case DARK_MODE:
			document.documentElement.classList.add("dark");
			break;
		case AUTO_MODE:
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			break;
	}

	// Set the theme for Expressive Code based on current mode
	// (light/dark code block themes)
	const isDark = document.documentElement.classList.contains("dark");
	document.documentElement.setAttribute(
		"data-theme",
		isDark
			? (expressiveCodeConfig.darkTheme ?? expressiveCodeConfig.theme)
			: (expressiveCodeConfig.lightTheme ?? expressiveCodeConfig.theme),
	);

	// 广播明暗状态变化，供按需加载的第三方组件（如 giscus iframe）同步主题
	window.dispatchEvent(
		new CustomEvent(THEME_CHANGE_EVENT, { detail: { isDark } }),
	);

	// Dark mode affects the resolved M3/M3E scheme
	applyCurrentScheme();
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	localStorage.setItem("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}

const MOTION_KEY = "mc-motion";

/** 是否开启「减少动态效果」（手动覆盖 prefers-reduced-motion） */
export function getMotionPreference(): boolean {
	return localStorage.getItem(MOTION_KEY) === "reduced";
}

export function applyMotionPreference(reduced: boolean): void {
	document.documentElement.classList.toggle("motion-reduced", reduced);
}

export function setMotionPreference(reduced: boolean): void {
	localStorage.setItem(MOTION_KEY, reduced ? "reduced" : "full");
	applyMotionPreference(reduced);
}
