/**
 * Banner 滚动渐进模糊：滚动进度的纯计算，与 DOM 解耦，便于直接单测
 * （仿 banner-state.ts 被 tests/site/banner.spec.ts 直接 import 的约定）。
 *
 * 性能约定：输出**量化**后的进度供 CSS 消费，且**不给 filter 加 transition**。
 * filter 是 paint 阶段属性，transition 会逐帧插值出新的计算值，等于每帧重跑一次
 * 模糊，量化的收益会完全归零；离散档位本身在中滚动速度下不可分辨。
 */

/** 滚过一屏距离时的最大模糊半径（px）。 */
export const BANNER_MAX_BLUR_PX = 12;
/** 进度量化档位数：全程最多触发这么多次滤镜重算。 */
export const BANNER_BLUR_STEPS = 16;
/**
 * 溢出（bleed）系数：模糊会在元素四边采样到边界外而产生半透明羽化，
 * 需要让图片稍微放大把边缘推出可视区。溢出量 = H * (scale - 1) / 2，
 * 与模糊半径同向增长，故比值恒定：H=900 时最大模糊下每边约 45px ≈ 3.75σ。
 * 静止态 scale 恒为 1，不改变原有取景。
 */
export const BANNER_BLEED_SCALE = 0.1;

export interface BannerScrollEffect {
	/** 0..1，已按 BANNER_BLUR_STEPS 量化 */
	progress: number;
	/** 1..1 + BANNER_BLEED_SCALE */
	scale: number;
	/** progress > 0，用于门控模糊声明本身（静止态零声明、零合成层） */
	active: boolean;
}

const IDLE_EFFECT: BannerScrollEffect = {
	progress: 0,
	scale: 1,
	active: false,
};

/**
 * 把滚动位置换算为 Banner 背景的模糊/溢出效果。
 * 舞台不可见时 `offsetHeight` 为 0，故必须校验 `stageHeight` 有效，否则会得到 Infinity/NaN。
 */
export function resolveBannerScrollEffect(
	scrollTop: number,
	stageHeight: number,
	reducedMotion: boolean,
): BannerScrollEffect {
	if (reducedMotion) return IDLE_EFFECT;
	if (!Number.isFinite(scrollTop) || !Number.isFinite(stageHeight)) {
		return IDLE_EFFECT;
	}
	if (stageHeight <= 0) return IDLE_EFFECT;

	const raw = Math.min(Math.max(scrollTop / stageHeight, 0), 1);
	// ceil 而非 round：否则"滚动一点点"会落到 0 档，门控在顶部反复增删类
	const progress = Math.ceil(raw * BANNER_BLUR_STEPS) / BANNER_BLUR_STEPS;
	return {
		progress,
		scale: 1 + progress * BANNER_BLEED_SCALE,
		active: progress > 0,
	};
}

/**
 * 与 Layout.astro 的主滚动监听保持一致的读取方式：项目启用了
 * scrollbar-gutter 与滚动锁，`window.scrollY` 在个别场景下不等价。
 */
export function getBannerScrollTop(): number {
	return Math.max(document.body.scrollTop, document.documentElement.scrollTop);
}
