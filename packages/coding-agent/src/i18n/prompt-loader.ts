/**
 * Markdown Prompt 翻译加载器
 *
 * 在运行时检查 ~/.omp/lan/prompts/{lang}/ 目录
 * 如果存在对应的翻译文件，使用翻译版本
 * 否则使用原始的英文版本
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Prompt 翻译缓存
 */
const promptCache = new Map<string, string>();

/**
 * 加载翻译的 prompt 文件
 *
 * @param promptPath prompt 相对路径（不含 .md 后缀），如 "system/system-prompt"
 * @param originalContent 原始英文内容
 * @returns 翻译后的内容（如果存在）或原始内容
 *
 * @example
 * import originalPrompt from "./prompts/system/system-prompt.md" with { type: "text" };
 * import { loadTranslatedPrompt } from "../i18n/prompt-loader";
 *
 * const systemPrompt = loadTranslatedPrompt("system/system-prompt", originalPrompt);
 */
export function loadTranslatedPrompt(promptPath: string, originalContent: string): string {
	// 确定语言
	const lang = detectLanguage();

	// 如果是英文，直接返回原文
	if (lang === "en") {
		return originalContent;
	}

	// 检查缓存
	const cacheKey = `${lang}:${promptPath}`;
	if (promptCache.has(cacheKey)) {
		return promptCache.get(cacheKey)!;
	}

	// 构造翻译文件路径
	const translatedPath = join(homedir(), ".omp", "lan", "prompts", lang, `${promptPath}.md`);

	// 检查翻译文件是否存在
	if (existsSync(translatedPath)) {
		try {
			const translated = readFileSync(translatedPath, "utf-8");
			promptCache.set(cacheKey, translated);
			return translated;
		} catch (error) {
			// 加载失败，回退到原文
			if (process.env.NODE_ENV === "development") {
				console.warn(`[i18n] Failed to load translated prompt: ${translatedPath}`, error);
			}
		}
	}

	// 找不到翻译，返回原文
	promptCache.set(cacheKey, originalContent);
	return originalContent;
}

/**
 * 检测语言设置
 */
function detectLanguage(): string {
	// 优先使用 OMP_LANG
	if (process.env.OMP_LANG) {
		return process.env.OMP_LANG;
	}

	// 其次使用系统 LANG
	const sysLang = process.env.LANG?.split(".")[0];
	if (sysLang) {
		// 处理 zh_CN -> zh
		return sysLang.split("_")[0];
	}

	// 默认英文
	return "en";
}

/**
 * 清除 prompt 缓存（用于语言切换）
 */
export function clearPromptCache(): void {
	promptCache.clear();
}

/**
 * 获取缓存统计信息（用于调试）
 */
export function getPromptCacheStats(): { size: number; keys: string[] } {
	return {
		size: promptCache.size,
		keys: Array.from(promptCache.keys()),
	};
}
