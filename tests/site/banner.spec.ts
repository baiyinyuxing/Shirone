import { expect, test } from "@playwright/test";
import {
	BANNER_BLEED_SCALE,
	BANNER_MAX_BLUR_PX,
	resolveBannerScrollEffect,
} from "../../src/utils/banner-scroll";
import { resolveBannerState } from "../../src/utils/banner-state";

function isBannerAsset(value: string): boolean {
	return /\/assets\/(?:images\/)?banner\//.test(decodeURIComponent(value));
}

function isBannerVariant(
	value: string,
	variant: "desktop" | "mobile",
): boolean {
	return decodeURIComponent(value).includes(`/banner/${variant}/`);
}

async function waitForBannerState(
	page: import("@playwright/test").Page,
	visible: boolean,
) {
	await page.waitForFunction(
		(expected) => document.body.dataset.bannerVisible === String(expected),
		visible,
	);
}

async function expectSubtitleTyping(page: import("@playwright/test").Page) {
	const subtitle = page.locator("#banner-wrapper [data-banner-home-copy] p");
	const expected = "特別なことはないけど、君がいると十分です";
	await expect(subtitle).toHaveAttribute("data-subtitle-state", "typing");
	const typingText = await subtitle.textContent();
	expect(typingText).toBeTruthy();
	expect(expected.startsWith(typingText ?? "")).toBe(true);
	await expect(subtitle).toHaveAttribute("data-subtitle-state", "complete", {
		timeout: 7_500,
	});
	await expect(subtitle).toHaveText(expected);
}

async function expectBannerOverlap(page: import("@playwright/test").Page) {
	const geometry = await page.evaluate(() => {
		const banner = document.getElementById("banner-wrapper");
		const categoryBar = document.getElementById("category-bar-region");
		if (!banner || !categoryBar) return null;

		const rootStyle = getComputedStyle(document.documentElement);
		const resolveLength = (property: string): number => {
			let value = rootStyle.getPropertyValue(property).trim();
			const variable = value.match(/^var\((--[^,)]+)/);
			if (variable) value = rootStyle.getPropertyValue(variable[1]).trim();
			const numericValue = Number.parseFloat(value);
			return value.endsWith("rem")
				? numericValue * Number.parseFloat(rootStyle.fontSize)
				: numericValue;
		};

		return {
			actual:
				banner.getBoundingClientRect().bottom -
				categoryBar.getBoundingClientRect().top,
			expected: resolveLength("--banner-panel-overlap"),
		};
	});

	expect(geometry).not.toBeNull();
	expect(geometry?.actual).toBeCloseTo(geometry?.expected ?? 0, 0);
}

async function expectWaveGeometry(
	page: import("@playwright/test").Page,
	expectedScale: string,
) {
	const geometry = await page.locator(".banner-waves").evaluate((waves) => {
		const rootStyle = getComputedStyle(document.documentElement);
		const layer = waves.querySelector<HTMLElement>(".banner-waves__layer");
		if (!layer) return null;
		const overlapProperty = rootStyle
			.getPropertyValue("--banner-panel-overlap")
			.trim();
		const overlapVariable = overlapProperty.match(/^var\((--[^,)]+)/);
		const overlapValue = overlapVariable
			? rootStyle.getPropertyValue(overlapVariable[1]).trim()
			: overlapProperty;
		const overlap = Number.parseFloat(overlapValue);
		return {
			height: waves.getBoundingClientRect().height,
			overlap: overlapValue.endsWith("rem")
				? overlap * Number.parseFloat(rootStyle.fontSize)
				: overlap,
			scale: getComputedStyle(layer)
				.getPropertyValue("--banner-wave-scale-y")
				.trim(),
		};
	});

	expect(geometry).not.toBeNull();
	expect(geometry?.height).toBeGreaterThan(geometry?.overlap ?? 0);
	expect(Number(geometry?.scale)).toBe(Number(expectedScale));
}

async function expectWavesAnimated(
	page: import("@playwright/test").Page,
	animated: boolean,
) {
	await expect(page.locator(".banner-waves")).toBeVisible();
	const animationCount = await page
		.locator(".banner-waves")
		.evaluate((waves) => waves.getAnimations({ subtree: true }).length);
	expect(animationCount > 0).toBe(animated);
}

async function expectRouteProgressAtAppBarBottom(
	page: import("@playwright/test").Page,
) {
	const rootSize = await page.evaluate(() =>
		Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
	);
	await expect(page.locator(".route-progress")).toHaveCSS(
		"top",
		`${rootSize * 4}px`,
	);
}

async function expectCompactTop(page: import("@playwright/test").Page) {
	const rootSize = await page.evaluate(() =>
		Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
	);
	await expect(page.locator("#main-layout")).toHaveCSS(
		"top",
		`${rootSize * 5.5}px`,
	);
}

test.describe("banner wallpaper", () => {
	test("uses mutually exclusive home and contextual copy modes", () => {
		const base = {
			mode: "banner" as const,
			fullscreenLayout: "classic" as const,
			viewport: "desktop" as const,
			imageCount: 1,
			carouselEnabled: false,
			reducedMotion: false,
		};
		expect(resolveBannerState({ ...base, page: "home" }).copyMode).toBe("home");
		expect(resolveBannerState({ ...base, page: "post" }).copyMode).toBe(
			"context",
		);
		expect(resolveBannerState({ ...base, page: "notFound" }).copyMode).toBe(
			"context",
		);
		expect(
			resolveBannerState({ ...base, viewport: "mobile", page: "post" })
				.copyMode,
		).toBeNull();
	});

	test("reserves the first viewport only for hero-style backgrounds", () => {
		const base = {
			page: "home" as const,
			viewport: "desktop" as const,
			imageCount: 1,
			carouselEnabled: false,
			reducedMotion: false,
		};
		const layout = (
			mode: "banner" | "fullscreen" | "overlay" | "none",
			fullscreenLayout: "classic" | "hero",
		) =>
			resolveBannerState({ ...base, mode, fullscreenLayout }).contentLayout;

		// 首屏 hero：内容从图片下方开始
		expect(layout("banner", "classic")).toBe("banner");
		expect(layout("fullscreen", "classic")).toBe("banner");
		// 固定背景：内容从顶部开始直接盖在图上
		expect(layout("fullscreen", "hero")).toBe("banner");
		expect(layout("overlay", "classic")).toBe("compact");
		expect(layout("none", "classic")).toBe("compact");
	});

	test("renders the stage for every background mode except solid", () => {
		const base = {
			page: "home" as const,
			viewport: "desktop" as const,
			imageCount: 1,
			carouselEnabled: false,
			reducedMotion: false,
			fullscreenLayout: "classic" as const,
		};
		for (const mode of ["banner", "fullscreen", "overlay"] as const) {
			expect(resolveBannerState({ ...base, mode }).visible).toBe(true);
		}
		expect(resolveBannerState({ ...base, mode: "none" }).visible).toBe(false);
		// 无图时不渲染舞台
		expect(
			resolveBannerState({ ...base, mode: "overlay", imageCount: 0 }).visible,
		).toBe(false);
	});

	test("server response includes article banner context", async ({
		request,
	}) => {
		const response = await request.get("/posts/guide/");
		expect(response.ok()).toBe(true);
		const html = await response.text();
		expect(html).toContain("data-banner-context-title");
		expect(html).toContain("Shirone Authoring & Usage Guide");
		expect(html).toContain(
			"A comprehensive guide to post authoring, frontmatter schema, Markdown extensions, encryption, and media in Shirone.",
		);
		expect(html).toContain('datetime="2026-08-26"');
	});

	test("centers article context in a bounded box with home-scale type", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		const stage = page.locator("#banner-wrapper");
		const context = stage.locator("[data-banner-context]");
		await expect(stage).toHaveAttribute("data-copy-mode", "context");
		await expect(context).toBeVisible();
		await expect(context.locator("[data-banner-context-title]")).toHaveText(
			"Shirone Authoring & Usage Guide",
		);
		await expect(
			context.locator("[data-banner-context-description]"),
		).toHaveText(
			"A comprehensive guide to post authoring, frontmatter schema, Markdown extensions, encryption, and media in Shirone.",
		);
		await expect(context.locator("time")).toHaveAttribute(
			"datetime",
			"2026-08-26",
		);

		const layout = await context.evaluate((element) => {
			const stage = document.getElementById("banner-wrapper");
			const homeTitle = document.querySelector<HTMLElement>(
				"[data-banner-home-copy] h1",
			);
			const title = element.querySelector<HTMLElement>(
				"[data-banner-context-title]",
			);
			if (!stage || !homeTitle || !title) return null;
			const stageRect = stage.getBoundingClientRect();
			const boxRect = element.getBoundingClientRect();
			return {
				centerX: Math.abs(
					boxRect.left +
						boxRect.width / 2 -
						(stageRect.left + stageRect.width / 2),
				),
				centerY: Math.abs(
					boxRect.top +
						boxRect.height / 2 -
						(stageRect.top + stageRect.height / 2),
				),
				boxWidth: boxRect.width,
				maxWidth: Number.parseFloat(getComputedStyle(element).maxWidth),
				titleSize: getComputedStyle(title).fontSize,
				homeTitleSize: getComputedStyle(homeTitle).fontSize,
				textAlign: getComputedStyle(element).textAlign,
				overflows:
					element.scrollWidth > element.clientWidth ||
					element.scrollHeight > element.clientHeight,
			};
		});
		expect(layout).not.toBeNull();
		expect(layout?.centerX).toBeLessThan(1);
		expect(layout?.centerY).toBeLessThan(1);
		expect(layout?.boxWidth).toBeLessThanOrEqual(1024);
		expect(Number.parseFloat(layout?.titleSize ?? "0")).toBeLessThanOrEqual(
			Number.parseFloat(layout?.homeTitleSize ?? "0"),
		);
		expect(layout?.textAlign).toBe("center");
		expect(layout?.overflows).toBe(false);
	});

	test("fits long contextual titles onto one line at desktop widths", async ({
		page,
	}) => {
		for (const width of [1440, 1024]) {
			await page.setViewportSize({ width, height: 1000 });
			await page.goto("/posts/markdown-extended/", {
				waitUntil: "domcontentloaded",
			});
			await waitForBannerState(page, true);
			const title = page.locator("[data-banner-context-title]");
			await expect(title).toHaveAttribute("data-title-fit", "scaled");
			const layout = await title.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					fontSize: Number.parseFloat(style.fontSize),
					lineHeight: Number.parseFloat(style.lineHeight),
					height: element.getBoundingClientRect().height,
					overflows: element.scrollWidth > element.clientWidth,
					whiteSpace: style.whiteSpace,
				};
			});
			expect(layout.overflows).toBe(false);
			expect(layout.whiteSpace).toBe("nowrap");
			expect(layout.height).toBeLessThanOrEqual(layout.lineHeight + 1);
			expect(layout.fontSize).toBeGreaterThanOrEqual(36);
			expect(layout.fontSize).toBeLessThan(80);
		}
	});

	test("shows localized context on a non-post page", async ({ page }) => {
		await page.goto("/friends/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		const context = page.locator("[data-banner-context]");
		await expect(context.locator("[data-banner-context-title]")).toHaveText(
			"Friends",
		);
		await expect(
			context.locator("[data-banner-context-description]"),
		).toHaveText(
			"Link exchange is welcome — see the About page for how to apply.",
		);
		await expect(context.locator("[data-banner-context-meta]")).toBeHidden();
	});

	test("shows collection context and omits duplicate supporting text", async ({
		page,
	}) => {
		await page.goto("/archive/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(page.locator("[data-banner-context-title]")).toHaveText(
			"Archive",
		);
		await expect(page.locator("[data-banner-context-description]")).toHaveText(
			/^\d+ posts$/,
		);

		await page.goto("/about/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(page.locator("[data-banner-context-title]")).toHaveText(
			"About",
		);
		await expect(page.locator("[data-banner-context-details]")).toBeHidden();
	});

	test("server response keeps the complete home subtitle", async ({
		request,
	}) => {
		const response = await request.get("/");
		expect(response.ok()).toBe(true);
		const html = await response.text();
		expect(html).toContain("特別なことはないけど、君がいると十分です");
		expect(html).toContain("<picture");
		expect(html).toContain('fetchpriority="high"');
		expect(html).not.toContain("/assets/banner/desktop/1.webp");
	});

	test("desktop exposes subtitle typewriter controls", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-subtitle-typewriter-enabled",
			"true",
		);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-subtitle-typewriter-speed",
			"100",
		);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-subtitle-typewriter-delete-speed",
			"50",
		);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-subtitle-typewriter-pause-time",
			"2000",
		);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-subtitle-typewriter-loop",
			"true",
		);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-home-subtitles",
			JSON.stringify([
				"特別なことはないけど、君がいると十分です",
				"今でもあなたは私の光",
				"君ってさ、知らないうちに私の毎日になってたよ",
				"君と話すと、なんか毎日がちょっと楽しくなるんだ",
				"今日はなんでもない日。でも、ちょっとだけいい日",
			]),
		);
	});

	test("desktop loads only desktop images and types home subtitle", async ({
		page,
	}) => {
		const requests: string[] = [];
		page.on("request", (request) => {
			if (isBannerAsset(request.url())) requests.push(request.url());
		});

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(page.locator("#banner-wrapper h1")).toHaveText("Shirone");
		await expectSubtitleTyping(page);
		await expect(page.locator("#navbar")).toHaveClass(
			/top-app-bar--transparent/,
		);
		await expect(page.locator(".route-progress")).toHaveCSS("top", "0px");
		await expect(page.locator(".banner-waves__layer")).toHaveCount(4);
		await expectWavesAnimated(page, true);
		await expectBannerOverlap(page);
		await expectWaveGeometry(page, "1");
		await expect(page.locator("#main-layout")).toHaveCSS(
			"top",
			/^[4-9]\d{2}(\.\d+)?px$/,
		);
		expect(
			requests.some((request) => isBannerVariant(request, "desktop")),
		).toBe(true);
		expect(requests.some((request) => isBannerVariant(request, "mobile"))).toBe(
			false,
		);
		expect(
			await page
				.locator(".banner-stage__image--front")
				.evaluate((image) => image.getAnimations().length),
		).toBe(0);
	});

	test("desktop progress moves below the app bar after leaving the Banner", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(page.locator(".route-progress")).toHaveCSS("top", "0px");

		await page.evaluate(() => window.scrollTo(0, window.innerHeight));
		await page.waitForFunction(
			() => document.body.dataset.bannerScrolled === "true",
		);
		await expect(page.locator("#navbar")).not.toHaveClass(
			/top-app-bar--transparent/,
		);
		await expectRouteProgressAtAppBarBottom(page);
	});

	test("mobile post hides wallpaper and keeps compact content geometry", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const requests: string[] = [];
		page.on("request", (request) => {
			if (isBannerAsset(request.url())) requests.push(request.url());
		});

		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, false);
		await expect(page.locator("#banner-wrapper")).toBeHidden();
		await expect(page.locator(".banner-waves")).toBeHidden();
		await expectCompactTop(page);
		await expect(page.locator("#navbar")).not.toHaveClass(
			/top-app-bar--transparent/,
		);
		await expectRouteProgressAtAppBarBottom(page);
		expect(requests).toEqual([]);
	});

	test("mobile home loads only mobile image resources", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const requests: string[] = [];
		page.on("request", (request) => {
			if (isBannerAsset(request.url())) requests.push(request.url());
		});

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expectWavesAnimated(page, true);
		await expectBannerOverlap(page);
		await expectWaveGeometry(page, "0.72");
		expect(requests.some((request) => isBannerVariant(request, "mobile"))).toBe(
			true,
		);
		expect(
			requests.some((request) => isBannerVariant(request, "desktop")),
		).toBe(false);
	});

	test("tablet home keeps the full wave geometry at the desktop breakpoint", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 768, height: 900 });
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expectWavesAnimated(page, true);
		await expectBannerOverlap(page);
		await expectWaveGeometry(page, "1");
	});

	test("solid preference persists after SSR banner discovery", async ({
		page,
	}) => {
		await page.addInitScript(() =>
			localStorage.setItem("wallpaper-mode", "none"),
		);
		const requests: string[] = [];
		page.on("request", (request) => {
			if (isBannerAsset(request.url())) requests.push(request.url());
		});

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, false);
		await expect(page.locator("#banner-wrapper")).toBeHidden();
		await expect(page.locator(".banner-waves")).toBeHidden();
		await expectCompactTop(page);
		expect(requests).toHaveLength(1);
		expect(isBannerVariant(requests[0], "desktop")).toBe(true);
	});

	test("display settings switches modes immediately and persists", async ({
		page,
	}) => {
		// 按选项 value 而非文案选择：面板文案随语言变化
		const pick = (value: string) =>
			page.locator(`#display-setting .display-settings__wallpaper-modes button[data-value="${value}"]`).click();
		const bannerLayout = () =>
			page.evaluate(() => document.body.dataset.bannerLayout);
		const storedMode = () =>
			page.evaluate(() => localStorage.getItem("wallpaper-mode"));

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await page.locator("#display-settings-switch").click();
		await page.getByRole("tab", { name: /壁纸|Wallpaper/ }).click();

		await pick("none");
		await waitForBannerState(page, false);
		expect(await storedMode()).toBe("none");
		await expectCompactTop(page);

		// 全屏壁纸（默认 classic 子布局）仍是首屏 hero，内容为其让位
		await pick("fullscreen");
		await waitForBannerState(page, true);
		expect(await bannerLayout()).toBe("banner");
		// 子布局控件只在全屏壁纸下出现
		await expect(
			page.locator('#display-setting input[value="hero"]'),
		).toBeAttached();

		// 覆盖透明：内容从顶部开始盖在图上，半透明卡片生效，三个参数滑杆出现
		await pick("overlay");
		expect(await bannerLayout()).toBe("compact");
		expect(
			await page.evaluate(
				() => document.documentElement.dataset.cardTransparent,
			),
		).toBe("true");
		await expect(page.locator('#display-setting input[type="range"]')).toHaveCount(
			3, // 壁纸透明度 + 背景模糊度 + 卡片透明度
		);

		await page.reload({ waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		expect(await storedMode()).toBe("overlay");
		expect(
			await page.evaluate(
				() => document.documentElement.dataset.cardTransparent,
			),
		).toBe("true");
	});

	test("automatic carousel crossfades to the next desktop image", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		const desktopImageCount = await page
			.locator("#banner-wrapper")
			.evaluate((stage) => {
				const value = (stage as HTMLElement).dataset.desktopImages;
				if (!value) return 0;
				const parsed = JSON.parse(value);
				return Array.isArray(parsed)
					? parsed.length
					: (parsed?.light?.length ?? 0);
			});
		test.skip(
			desktopImageCount < 2,
			"carousel requires at least two desktop images",
		);
		const before = await page
			.locator(".banner-stage__image--active")
			.getAttribute("src");
		await page.waitForFunction(
			(initial) =>
				document
					.querySelector<HTMLImageElement>(".banner-stage__image--active")
					?.getAttribute("src") !== initial,
			before,
			{ timeout: 10000 },
		);
		const after = await page
			.locator(".banner-stage__image--active")
			.getAttribute("src");
		expect(after).not.toBe(before);
	});

	test("carousel visits every desktop image in order without repeating the first slide", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		const images = await page.locator("#banner-wrapper").evaluate((stage) => {
			const value = (stage as HTMLElement).dataset.desktopImages;
			if (!value) return [];
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : (parsed?.light ?? []);
		});
		test.skip(
			!Array.isArray(images) || images.length < 4,
			"carousel order test requires four desktop images",
		);

		const interval = await page
			.locator("#banner-wrapper")
			.evaluate((stage) =>
				Math.max(
					Number.parseInt(
						(stage as HTMLElement).dataset.carouselInterval || "6000",
						10,
					),
					3000,
				),
			);
		const seen: string[] = [];
		const readActiveSrc = () =>
			page
				.locator(".banner-stage__image--active")
				.getAttribute("src")
				.then((src) => src || "");

		seen.push(await readActiveSrc());
		for (let step = 1; step < images.length; step += 1) {
			const previous = seen.at(-1);
			await page.waitForFunction(
				(expected) =>
					document
						.querySelector<HTMLImageElement>(".banner-stage__image--active")
						?.getAttribute("src") !== expected,
				previous,
				{ timeout: interval + 2500 },
			);
			seen.push(await readActiveSrc());
		}

		expect(seen).toHaveLength(images.length);
		expect(new Set(seen).size).toBe(images.length);
		for (let index = 0; index < images.length; index += 1) {
			expect(seen[index]).toContain(images[index].split("/").pop() || "");
		}
	});

	test("reduced motion keeps the initial slide static", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(
			page.locator("#banner-wrapper [data-banner-home-copy] p"),
		).toHaveText("特別なことはないけど、君がいると十分です");
		await expect(
			page.locator("#banner-wrapper [data-banner-home-copy] p"),
		).toHaveAttribute("data-subtitle-state", "complete");
		await expectWavesAnimated(page, false);
		const before = await page
			.locator(".banner-stage__image--active")
			.getAttribute("src");
		await page.waitForTimeout(6500);
		const after = await page
			.locator(".banner-stage__image--active")
			.getAttribute("src");
		expect(after).toBe(before);
	});

	test("manual reduced motion keeps the wave boundary static", async ({
		page,
	}) => {
		await page.addInitScript(() =>
			localStorage.setItem("mc-motion", "reduced"),
		);
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(
			page.locator("#banner-wrapper [data-banner-home-copy] p"),
		).toHaveText("特別なことはないけど、君がいると十分です");
		await expect(
			page.locator("#banner-wrapper [data-banner-home-copy] p"),
		).toHaveAttribute("data-subtitle-state", "complete");
		await expect(page.locator("html")).toHaveClass(/motion-reduced/);
		await expectWavesAnimated(page, false);
	});

	test("Swup replaces contextual copy without retaining the previous page", async ({
		page,
	}) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"data-copy-mode",
			"home",
		);
		await page.waitForFunction(() => Boolean(window.swup?.hooks));

		await page.evaluate(() => {
			(
				window as typeof window & { __swupPersistenceProbe?: string }
			).__swupPersistenceProbe = "preserved";
		});
		await page
			.locator(
				'#swup-container a.m3-blog-postcard__title[href="/posts/guide/"]',
			)
			.click();
		await page.waitForFunction(
			() =>
				document.getElementById("swup-container")?.dataset.currentPage ===
				"post",
		);
		await expect(page.locator("[data-banner-context-title]")).toHaveText(
			"Shirone Authoring & Usage Guide",
		);
		await expect(page.locator("#banner-wrapper")).toHaveAttribute(
			"aria-label",
			"Shirone Authoring & Usage Guide",
		);
		expect(
			await page.evaluate(
				() =>
					(window as typeof window & { __swupPersistenceProbe?: string })
						.__swupPersistenceProbe,
			),
		).toBe("preserved");

		await page.locator('#navbar a[href="/friends/"]').click();
		await page.waitForFunction(
			() =>
				document.getElementById("swup-container")?.dataset.currentPage ===
				"friends",
		);
		await expect(page.locator("[data-banner-context-title]")).toHaveText(
			"Friends",
		);
		await expect(page.locator("[data-banner-context-description]")).toHaveText(
			"Link exchange is welcome — see the About page for how to apply.",
		);
		await expect(page.locator("[data-banner-context-meta]")).toBeHidden();
		expect(
			await page.evaluate(
				() =>
					(window as typeof window & { __swupPersistenceProbe?: string })
						.__swupPersistenceProbe,
			),
		).toBe("preserved");
	});

	test("animates contextual copy only on motion-enabled desktop navigation", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await page.waitForFunction(() => Boolean(window.swup?.hooks));
		await page.evaluate(() => {
			const stage = document.getElementById("banner-wrapper");
			if (!stage) return;
			const states: string[] = [];
			new MutationObserver(() => {
				states.push(stage.dataset.contextMotion || "");
			}).observe(stage, {
				attributes: true,
				attributeFilter: ["data-context-motion"],
			});
			(
				window as typeof window & { __bannerMotionStates?: string[] }
			).__bannerMotionStates = states;
		});

		await page.locator('#navbar a[href="/friends/"]').click();
		await page.waitForFunction(
			() =>
				document.getElementById("swup-container")?.dataset.currentPage ===
				"friends",
		);
		await page.waitForFunction(() => {
			const states =
				(window as typeof window & { __bannerMotionStates?: string[] })
					.__bannerMotionStates || [];
			return (
				states.includes("in") &&
				document.getElementById("banner-wrapper")?.dataset.contextMotion ===
					"idle"
			);
		});
		const states = await page.evaluate(
			() =>
				(window as typeof window & { __bannerMotionStates?: string[] })
					.__bannerMotionStates || [],
		);
		expect(states).toContain("out");
		expect(states).toContain("in");
		expect(states.at(-1)).toBe("idle");
	});

	test("skips contextual copy animation on mobile and reduced motion", async ({
		page,
	}) => {
		for (const setup of [
			async () => page.setViewportSize({ width: 390, height: 844 }),
			async () => {
				await page.setViewportSize({ width: 1440, height: 1000 });
				await page.emulateMedia({ reducedMotion: "reduce" });
			},
		]) {
			await setup();
			await page.goto("/posts/guide/", { waitUntil: "domcontentloaded" });
			await page.waitForFunction(() => Boolean(window.swup?.hooks));
			await page.evaluate(() => {
				(
					window.swup as typeof window.swup & {
						navigate: (url: string) => void;
					}
				).navigate("/friends/");
			});
			await page.waitForFunction(
				() =>
					document.getElementById("swup-container")?.dataset.currentPage ===
					"friends",
			);
			await expect(page.locator("#banner-wrapper")).toHaveAttribute(
				"data-context-motion",
				"idle",
			);
		}
	});

	test("Swup home to post removes mobile wallpaper without leaving a gap", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/", { waitUntil: "networkidle" });
		await waitForBannerState(page, true);
		await expect(page.locator(".banner-waves")).toHaveCount(1);

		await page.evaluate(() => {
			(
				document.querySelector(
					'#swup-container a[href^="/posts/"]',
				) as HTMLAnchorElement
			)?.click();
		});
		await page.waitForFunction(
			() =>
				document.getElementById("swup-container")?.dataset.currentPage ===
				"post",
		);
		await waitForBannerState(page, false);
		await expect(page.locator(".banner-waves")).toHaveCount(1);
		await expect(page.locator(".banner-waves")).toBeHidden();
		await expectCompactTop(page);
	});
});

test.describe("banner scroll blur", () => {
	test("quantizes scroll progress and clamps out-of-range values", () => {
		expect(resolveBannerScrollEffect(0, 900, false)).toEqual({
			progress: 0,
			scale: 1,
			active: false,
		});

		const half = resolveBannerScrollEffect(450, 900, false);
		expect(half.progress).toBeCloseTo(0.5, 5);
		expect(half.active).toBe(true);

		// 超出一屏后夹取到上限，溢出量与最大模糊同向增长
		const beyond = resolveBannerScrollEffect(5_000, 900, false);
		expect(beyond.progress).toBe(1);
		expect(beyond.scale).toBeCloseTo(1 + BANNER_BLEED_SCALE, 5);

		// 滚动刚开始就应进入激活态，避免门控在顶部反复增删类
		expect(resolveBannerScrollEffect(1, 900, false).active).toBe(true);
		expect(resolveBannerScrollEffect(-200, 900, false).progress).toBe(0);
	});

	test("stays idle on reduced motion or unusable geometry", () => {
		const idle = { progress: 0, scale: 1, active: false };
		expect(resolveBannerScrollEffect(450, 900, true)).toEqual(idle);
		// 舞台隐藏时 offsetHeight 为 0，不能产生 Infinity/NaN
		expect(resolveBannerScrollEffect(450, 0, false)).toEqual(idle);
		expect(resolveBannerScrollEffect(Number.NaN, 900, false)).toEqual(idle);
		expect(resolveBannerScrollEffect(450, Number.NaN, false)).toEqual(idle);
	});

	async function readMediaAt(
		page: import("@playwright/test").Page,
		scrollRatio: number,
	) {
		await page.evaluate((ratio) => {
			window.scrollTo(0, window.innerHeight * ratio);
		}, scrollRatio);
		// 等两帧：滚动监听里的 rAF 合并需要一帧才落到样式上
		await page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					window.requestAnimationFrame(() =>
						window.requestAnimationFrame(() => resolve()),
					);
				}),
		);
		return page.evaluate(() => {
			const stage = document.getElementById("banner-wrapper");
			const media = stage?.querySelector(".banner-stage__media");
			const style = media ? getComputedStyle(media) : null;
			return {
				blurred: stage?.classList.contains("banner-stage--blurred") ?? false,
				filter: style?.filter ?? "",
				transform: style?.transform ?? "",
			};
		});
	}

	test("blurs progressively while scrolling and restores at the top", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/", { waitUntil: "networkidle" });
		await waitForBannerState(page, true);

		// 静止态：无滤镜、无缩放，不改变原有取景
		const atTop = await readMediaAt(page, 0);
		expect(atTop.blurred).toBe(false);
		expect(atTop.filter).toBe("blur(0px)");
		expect(atTop.transform).toMatch(/^matrix\(1,/);

		const half = await readMediaAt(page, 0.5);
		expect(half.blurred).toBe(true);
		const halfBlur = Number.parseFloat(half.filter.replace(/[^\d.]/g, ""));
		expect(halfBlur).toBeGreaterThan(0);
		expect(halfBlur).toBeLessThan(BANNER_MAX_BLUR_PX);

		// 溢出量随进度增长，用于盖住模糊在四边产生的半透明羽化
		const matrix = half.transform.match(/matrix\(([\d.]+)/);
		expect(Number.parseFloat(matrix?.[1] ?? "1")).toBeGreaterThan(1);

		// 滚过一屏后达到最大模糊
		const full = await readMediaAt(page, 1);
		expect(full.blurred).toBe(true);
		expect(
			Number.parseFloat(full.filter.replace(/[^\d.]/g, "")),
		).toBeCloseTo(BANNER_MAX_BLUR_PX, 1);

		const back = await readMediaAt(page, 0);
		expect(back.blurred).toBe(false);
		expect(back.filter).toBe("blur(0px)");
		expect(back.transform).toMatch(/^matrix\(1,/);
	});

	test("skips the blur under reduced motion", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/", { waitUntil: "networkidle" });
		await waitForBannerState(page, true);

		const half = await readMediaAt(page, 0.5);
		expect(half.blurred).toBe(false);
		expect(half.filter).toBe("none");
		expect(half.transform).toBe("none");
	});
});

test.describe("wallpaper background modes", () => {
	async function openWithMode(
		page: import("@playwright/test").Page,
		mode: string,
		layout: string,
	) {
		await page.addInitScript(
			([m, l]) => {
				localStorage.setItem("wallpaper-mode", m);
				localStorage.setItem("wallpaper-fullscreen-layout", l);
			},
			[mode, layout],
		);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/", { waitUntil: "networkidle" });
		await waitForBannerState(page, true);
	}

	function readBackground(page: import("@playwright/test").Page) {
		return page.evaluate(() => {
			const stage = document.getElementById("banner-wrapper");
			const media = stage?.querySelector(".banner-stage__media");
			const waves = document.querySelector(".banner-waves");
			const main = document.getElementById("main-layout");
			const card = document.querySelector(".m3-card");
			const style = stage ? getComputedStyle(stage) : null;
			const rootSize = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			return {
				position: style?.position ?? "",
				mediaFilter: media ? getComputedStyle(media).filter : "",
				wavesDisplay: waves ? getComputedStyle(waves).display : "(absent)",
				// 紧凑基线（5.5rem）与 hero 态都用 px 比较，避免 rem/px 单位混淆
				mainTopPx: main
					? Number.parseFloat(getComputedStyle(main).top)
					: Number.NaN,
				compactTopPx: rootSize * 5.5,
				cardTransparent: document.documentElement.dataset.cardTransparent,
				cardBg: card ? getComputedStyle(card).backgroundColor : "",
				homeCopyDisplay: [
					...document.querySelectorAll(".banner-stage__copy"),
				].map((el) => getComputedStyle(el).display),
			};
		});
	}

	test("turns the wallpaper into a fixed page background in overlay mode", async ({
		page,
	}) => {
		await openWithMode(page, "overlay", "classic");
		const state = await readBackground(page);

		expect(state.position).toBe("fixed");
		// 内容从顶部开始盖在图上，而不是被 hero 推到下方
		expect(state.mainTopPx).toBeCloseTo(state.compactTopPx, 0);
		// 固定背景模式下波浪没有可衔接的页面底边
		expect(state.wavesDisplay).toBe("none");
		// 半透明卡片是覆盖透明模式的派生状态
		expect(state.cardTransparent).toBe("true");
		expect(state.cardBg).toContain("/ 0.6");
		// 舞台是背景层而非 hero，标题文案必须隐藏
		expect(state.homeCopyDisplay).toEqual(["none", "none"]);
	});

	test("starts clear and blurs on scroll in fullscreen hero mode", async ({
		page,
	}) => {
		await openWithMode(page, "fullscreen", "hero");
		const atTop = await readBackground(page);
		expect(atTop.position).toBe("fixed");
		expect(atTop.mainTopPx).toBeGreaterThan(atTop.compactTopPx);
		expect(atTop.cardTransparent).toBe("true");
		expect(atTop.homeCopyDisplay[0]).toBe("flex");

		// 基础模糊由滑杆给定（默认 0），滚过一屏后叠加到上限
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(300);
		const base = await readBackground(page);
		expect(base.mediaFilter).toBe("blur(0px)");

		await page.evaluate(() => window.scrollTo(0, 5000));
		await page.waitForFunction(() =>
			(document.body.dataset.bannerScrolled ?? "") !== "",
		);
		await page.waitForTimeout(400);
		const scrolled = await readBackground(page);
		expect(scrolled.mediaFilter).not.toBe("blur(0px)");
	});

	test("fits wallpaper choices and names slider values on mobile", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await waitForBannerState(page, true);
		await page.waitForFunction(() => {
			const main = document.getElementById("main-layout");
			return main && Number.parseFloat(getComputedStyle(main).top) > 800;
		});
		const geometry = await page.evaluate(() => {
			const stage = document.getElementById("banner-wrapper");
			const main = document.getElementById("main-layout");
			return {
				mode: document.documentElement.dataset.wallpaperMode,
				stageHeight: stage?.getBoundingClientRect().height,
				mainTop: main ? Number.parseFloat(getComputedStyle(main).top) : 0,
			};
		});
		expect(geometry.mode).toBe("fullscreen");
		expect(geometry.stageHeight).toBeCloseTo(844, 0);
		expect(geometry.mainTop).toBeGreaterThan(800);
		await page.locator("#display-settings-switch").click();
		await page.getByRole("tab", { name: /壁纸|Wallpaper/ }).click();
		const modes = page.locator("#display-setting .display-settings__wallpaper-modes button");
		await expect(modes).toHaveCount(4);
		for (const option of await modes.all()) {
			const fits = await option.evaluate((button) => {
				const label = button.querySelector("span");
				return Boolean(label && label.getBoundingClientRect().right <= button.getBoundingClientRect().right);
			});
			expect(fits).toBe(true);
		}
		await page.locator('#display-setting .display-settings__wallpaper-modes button[data-value="overlay"]').click();
		await expect(page.locator("#display-setting .m3-slider-field__heading")).toHaveCount(3);
		await expect(page.locator("#display-setting .m3-slider-field__heading output").first()).toHaveText(/%/);
	});

	test("keeps the banner half-height and clear while scrolling", async ({ page }) => {
		await openWithMode(page, "banner", "hero");
		const stage = page.locator("#banner-wrapper");
		const atTop = await readBackground(page);
		const height = await stage.evaluate((element) => element.getBoundingClientRect().height);
		expect(height).toBeCloseTo(450, 0);
		expect(atTop.mediaFilter).toBe("none");
		await page.evaluate(() => window.scrollTo(0, 600));
		await page.waitForTimeout(100);
		const scrolled = await readBackground(page);
		expect(scrolled.mediaFilter).toBe("none");
		expect(await stage.evaluate((element) => element.classList.contains("banner-stage--blurred"))).toBe(false);
	});

	test("keeps the hero layout in fullscreen classic mode", async ({ page }) => {
		await openWithMode(page, "fullscreen", "classic");
		const state = await readBackground(page);

		// classic 仍是首屏 hero：内容被推到图片下方，卡片保持不透明
		expect(state.position).toBe("absolute");
		expect(state.mainTopPx).toBeGreaterThan(state.compactTopPx);
		expect(state.cardTransparent).toBe("false");
		expect(state.wavesDisplay).toBe("block");
	});

	test("applies and persists the visitor wallpaper controls", async ({
		page,
	}) => {
		await openWithMode(page, "banner", "classic");

		// 访客可用 setting-utils 写入覆盖透明参数，变量与 localStorage 同步
		const applied = await page.evaluate(() =>
			import("/src/utils/setting-utils.ts").then((mod) => {
				mod.setWallpaperOverlay({
					opacity: 0.4,
					blur: 8,
					cardOpacity: 0.35,
				});
				mod.setBannerWavesEnabled(false);
				return {
					opacity: getComputedStyle(document.documentElement)
						.getPropertyValue("--overlay-opacity")
						.trim(),
					blur: getComputedStyle(document.documentElement)
						.getPropertyValue("--overlay-blur")
						.trim(),
					card: getComputedStyle(document.documentElement)
						.getPropertyValue("--card-transparent-opacity")
						.trim(),
					waves: document.documentElement.dataset.bannerWavesEnabled,
				};
			}),
		);
		expect(applied).toEqual({
			opacity: "0.4",
			blur: "8px",
			card: "0.35",
			waves: "false",
		});

		// 越界值被钳位
		const clamped = await page.evaluate(() =>
			import("/src/utils/setting-utils.ts").then((mod) => {
				mod.setWallpaperOverlay({
					opacity: 5,
					blur: -3,
					cardOpacity: 2,
				});
				return {
					opacity: getComputedStyle(document.documentElement)
						.getPropertyValue("--overlay-opacity")
						.trim(),
					blur: getComputedStyle(document.documentElement)
						.getPropertyValue("--overlay-blur")
						.trim(),
					card: getComputedStyle(document.documentElement)
						.getPropertyValue("--card-transparent-opacity")
						.trim(),
				};
			}),
		);
		expect(clamped).toEqual({ opacity: "1", blur: "0px", card: "1" });

		// 刷新后由首屏脚本恢复，不依赖面板挂载
		await page.reload({ waitUntil: "domcontentloaded" });
		const restored = await page.evaluate(() => ({
			opacity: getComputedStyle(document.documentElement)
				.getPropertyValue("--overlay-opacity")
				.trim(),
			blur: getComputedStyle(document.documentElement)
				.getPropertyValue("--overlay-blur")
				.trim(),
			waves: document.documentElement.dataset.bannerWavesEnabled,
		}));
		expect(restored).toEqual({ opacity: "1", blur: "0px", waves: "false" });
	});
});
