# 背景系统（Wallpaper System）

页面背景由**背景模式**（站点默认 + 访客偏好）驱动，每种模式带自己的附属控件。玻璃拟态禁令与半透明卡片的例外口径见本文末「与 DESIGN.md 的关系」。

## 四种背景模式

`WallpaperMode`（`src/types/config.ts`）= `banner` | `fullscreen` | `overlay` | `none`。

| 模式 | `.banner-stage` 定位 | 内容起点 | 波浪/文案 | 半透明卡片 |
|---|---|---|---|---|
| `banner` 横幅 | `absolute` + `--banner-stage-height` | 图片下方 | 显示 | 否 |
| `fullscreen` + `classic` 揭幕 | `absolute`（同 banner） | 图片下方 | 显示 | 否 |
| `fullscreen` + `hero` 视差 | `fixed; inset: 0; z-index: 0` | 顶部 `5.5rem` | 隐藏 | **是** |
| `overlay` 覆盖透明 | `fixed; inset: 0; z-index: -1` + `opacity` | 顶部 `5.5rem` | 隐藏 | **是** |
| `none` 纯色 | `display: none` | 顶部 `5.5rem` | — | 否 |

「内容起点」由 `src/utils/banner-state.ts` 的 `contentLayout` 表达：只有首屏 hero 语义（`banner`、`fullscreen` + `classic`）返回 `"banner"`，内容被推到图片下方；其余返回 `"compact"`，内容从顶部开始盖在图上。`Layout.astro` 的 `body[data-banner-layout=…]` 规则据此决定 `#main-layout` 的 `top`。

**生效范围沿用主题既有规则**：桌面（≥1024px）所有页面都有背景；移动端仅首页。见 `resolveBannerState` 的 `viewport === "desktop" || isHome`。

## 站点配置

`src/config/siteConfig.ts` → `wallpaperMode`：

```ts
wallpaperMode: {
	defaultMode: "banner",              // 访客可在显示设置中覆盖
	defaultFullscreenLayout: "classic", // 仅 fullscreen 生效
	overlay: { opacity: 0.8, blur: 0, cardOpacity: 0.6 },
}
```

面板显隐由 `displaySettings.wallpaperMode` 总控。**零额外负担**：`none` 与 `banner` 模式下不产生任何新模式 DOM 与样式；新模式的样式全部写在 `BannerStage.astro` 的 `:global(html[data-wallpaper-mode=…])` 作用域内，不进入共享 CSS。

## 访客偏好（localStorage）

键名与上游 Shirone 契约一致，便于将来升级对齐。

| key | 值域 | 默认来源 |
|---|---|---|
| `wallpaper-mode` | 四种模式 | `wallpaperMode.defaultMode` |
| `wallpaper-fullscreen-layout` | `classic` / `hero` | `wallpaperMode.defaultFullscreenLayout` |
| `wallpaper-overlay-opacity` | 0–1（钳位） | `wallpaperMode.overlay.opacity` |
| `wallpaper-overlay-blur` | 0–20px（钳位） | `wallpaperMode.overlay.blur` |
| `wallpaper-overlay-card-opacity` | 0–1（钳位） | `wallpaperMode.overlay.cardOpacity` |
| `wallpaper-banner-waves` | `"true"` / `"false"` | `banner.waves.enable`（站长设初始默认） |

读写集中在 `src/utils/setting-utils.ts`。**首屏防闪**：`src/layouts/Layout.astro` 的 `is:inline` 脚本在绘制前完成同一套「白名单校验 + 钳位 + 落位」，因此这里有两份平行逻辑，改任一处必须同步另一处：

- `isWallpaperMode()` / `isFullscreenLayout()` ↔ 脚本里的 `validWallpaperModes` / `fullscreenLayout` 白名单；
- `getDefault*()`（读 `#config-carrier` 的 dataset）↔ `define:vars` 传入的默认值。

客户端默认值经 `src/components/system/ConfigCarrier.astro` 的 `data-*` 暴露；该脚本在 `ConfigCarrier` 之前执行，所以**不能用它读默认值**。

## 派生状态：半透明卡片

`data-card-transparent` **不是**访客直接设置的开关，而是派生量：

```
overlay 模式恒为 true；fullscreen 仅 hero 子布局为 true
```

判定收敛在 `shouldUseTransparentCards()`（`src/utils/setting-utils.ts`），首屏脚本内有一份等价的内联判定。它为 `true` 时 `:root[data-card-transparent="true"]` 把 `--card-bg` 换成 `--card-bg-transparent`，从而**一处注入覆盖全站 31 处 `color="var(--card-bg)"` 与 24 处直接消费**。

## 模糊语义

- `banner` 与 `fullscreen` + `classic`：滚动渐进模糊，`模糊 = --banner-scroll-progress × --banner-blur-max(12px)`，静止态零滤镜（由 `.banner-stage--blurred` 门控）。
- `fullscreen` + `hero`：**基础模糊 + 滚动叠加**，`模糊 = --overlay-blur + 滚动进度 × 12px`。
- `overlay`：固定模糊 `--overlay-blur`，与滚动无关（`applyBannerScrollEffect()` 在这种模式下直接复位）。

计算逻辑在 `src/utils/banner-scroll.ts`；`reduced-motion` 三处兜底（JS 早退 / `@media` / `html.motion-reduced`）见 `BannerStage.astro` 样式末段。

## 与 DESIGN.md 的关系

半透明卡片与 `filter: blur()` **触碰了三条既有禁令**，本次为主题所有者明确要求的功能，例外边界如下：

| 条款 | 冲突点 | 本次口径 |
|---|---|---|
| `DESIGN.md` 禁止 frosted glass / 玻璃拟态 | 半透明卡片压在图片上 | 仅在 `overlay` / `fullscreen`+`hero` 两种**访客主动选择**的模式下生效；默认模式（`banner`）与 `none` 完全不受影响，卡片仍是不透明 tonal surface |
| `DESIGN.md` 禁止破坏 HCT tonal 配对 | `--card-bg` 带了 alpha | `--card-bg-transparent` 仍由 `--surface-container-*` 经 `color-mix` 派生，不引入新色相 |
| `docs/m3e-standard.md` 的 tonal elevation 建立在固定色阶上 | 层级不再靠固定色阶 | 例外仅限上述两种模式；`Card.svelte` 的 hover `color-mix` 链路保持不变 |

**顶栏渐变托底**：固定背景模式下顶栏是「透明 + 白字」并压在任意亮度的壁纸上，白字可能贴在明亮天空上无法辨认。因此在 `.banner-stage::after` 上加了一层顶部固定黑渐变（8rem 内淡出）。这属于 `DESIGN.md` 明文允许的「图片覆盖层为可读性使用固定黑白」例外。

**注意**：`tests/site/a11y.spec.ts` 不设置 `localStorage`，因此只覆盖默认 `banner` 模式；axe 也无法感知 `z-index: -1` 的固定背景层（会把 `--page-bg` 当背景色）。改动这两个模式的视觉时不要指望该 spec 兜底，需手工核对顶栏与卡片文字对比度。

## 相关文件

- `src/types/config.ts` — `WallpaperMode` / `FullscreenLayout` / `WallpaperOverlayConfig`
- `src/utils/setting-utils.ts` — 读写与 `shouldUseTransparentCards()`
- `src/utils/banner-state.ts` — `contentLayout` 的 hero/compact 判定
- `src/components/organisms/BannerStage.astro` — 各模式图层与模糊/渐变样式
- `src/components/organisms/DisplaySettings.svelte` — 面板控件（按取值条件渲染）
- `src/components/molecules/BannerWaves.astro` — 波浪在固定背景模式与访客关闭时的隐藏
- `src/styles/variables.styl` — `--card-bg-transparent`
- `tests/site/banner.spec.ts` — `wallpaper background modes` 用例组
