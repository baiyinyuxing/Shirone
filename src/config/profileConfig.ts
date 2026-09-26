import type { ProfileConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 博主资料：头像 / 名称 / 简介 / 社交链接（侧栏 Profile 卡片、页脚、RSS 作者等消费）。
 * 类型见 src/types/config.ts。
 */
export const profileConfig: ProfileConfig = withUserConfig("profile", {
	avatar: "assets/images/demo-avatar.gif", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Silver",
	bio: "淬炼如银，光而不耀",
	links: [
		{ name: "GitHub", url: "https://github.com/baiyinyuxing", icon: "fa6-brands:github" },
		{ name: "Gitee", url: "https://gitee.com/silver_yuxing", icon: "simple-icons:gitee" },
		{ name: "QQ", url: "/assets/contact/qq-36710994.jpg", icon: "fa6-brands:qq" },
		{ name: "Email", url: "mailto:Silver.xhy@outlook.com", icon: "material-symbols:mail-outline-rounded" },
	],
});
