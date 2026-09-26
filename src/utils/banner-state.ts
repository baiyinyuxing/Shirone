import type { FullscreenLayout, WallpaperMode } from "@/types/config";
import type { SidebarPage } from "@/types/sidebarConfig";

export type BannerViewport = "desktop" | "mobile";
export type BannerContentLayout = "banner" | "compact";

export type BannerCopyMode = "home" | "context" | null;

export interface BannerStateInput {
	mode: WallpaperMode;
	fullscreenLayout: FullscreenLayout;
	page: SidebarPage | undefined;
	viewport: BannerViewport;
	imageCount: number;
	carouselEnabled: boolean;
	reducedMotion: boolean;
}

export interface BannerState {
	visible: boolean;
	assetGroup: BannerViewport | null;
	copyMode: BannerCopyMode;
	rotate: boolean;
	transparentTopAppBar: boolean;
	contentLayout: BannerContentLayout;
}

export function resolveBannerState(input: BannerStateInput): BannerState {
	const isHome = input.page === "home";
	const visible =
		input.mode !== "none" &&
		input.imageCount > 0 &&
		(input.viewport === "desktop" || isHome);

	const copyMode: BannerCopyMode = !visible
		? null
		: isHome
			? "home"
			: "context";

	/*
	 * 内容是否要为背景图让出首屏高度：
	 * - `banner` 与 `fullscreen` + `classic` 是首屏 hero，内容从图片下方开始；
	 * - `fullscreen` + `hero` 与 `overlay` 把图片固定在视口，内容直接从顶部开始盖在图上。
	 */
	const heroLayout =
		visible && (input.mode === "banner" || input.mode === "fullscreen");

	return {
		visible,
		assetGroup: visible ? input.viewport : null,
		copyMode,
		rotate:
			visible &&
			input.carouselEnabled &&
			input.imageCount > 1 &&
			!input.reducedMotion,
		transparentTopAppBar: visible,
		contentLayout: heroLayout ? "banner" : "compact",
	};
}
