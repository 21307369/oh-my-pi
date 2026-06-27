/**
 * 国际化 (i18n) 核心模块
 *
 * 提供翻译功能，从 ~/.omp/lan/{lang}-*.json 加载翻译文件
 * 支持插值和 fallback 机制
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { isEnoent, logger } from "@oh-my-pi/pi-utils";

/**
 * 翻译字典类型
 */
export interface TranslationDict {
	[key: string]: string | TranslationDict;
}

/**
 * 翻译元数据
 */
export interface TranslationMeta {
	version?: string;
	upstream_commit?: string;
	lastUpdated?: string;
	completeness?: number;
}

/**
 * 完整的翻译文件结构
 */
export interface TranslationFile {
	meta?: TranslationMeta;
	[key: string]: string | TranslationDict | TranslationMeta | undefined;
}

/**
 * i18n 管理器
 */
class I18nManager {
	private dict: TranslationFile = {};
	private lang: string = "en";
	private readonly fallbackLang: string = "en";
	private fallbackDict: TranslationFile = {};
	private lanDir: string;
	private initialized = false;

	constructor(lanDir?: string) {
		this.lanDir = lanDir ?? path.join(os.homedir(), ".omp", "lan");
	}

	/**
	 * 重置实例（用于测试）
	 */
	reset(lanDir?: string): void {
		this.dict = {};
		this.fallbackDict = {};
		this.lang = "en";
		this.initialized = false;
		if (lanDir) {
			this.lanDir = lanDir;
		}
	}

	/**
	 * 初始化 i18n 系统
	 */
	async init(): Promise<void> {
		if (this.initialized) return;

		this.lang = this.detectLanguage();
		await this.loadTranslation(this.lang, this.dict);

		if (this.lang !== this.fallbackLang) {
			await this.loadTranslation(this.fallbackLang, this.fallbackDict);
		}

		this.initialized = true;
	}

	/**
	 * 检测语言设置
	 */
	private detectLanguage(): string {
		// 从 Settings 读取 i18n.language
		// 目前简化为从环境变量读取，后续集成 Settings
		return process.env.OMP_LANG || "en";
	}

	/**
	 * 加载翻译文件
	 */
	private async loadTranslation(lang: string, target: TranslationFile): Promise<void> {
		try {
			const files = await fs.readdir(this.lanDir);
			const langFiles = files.filter(f => f.startsWith(`${lang}-`) && f.endsWith(".json"));

			for (const file of langFiles) {
				try {
					const filePath = path.join(this.lanDir, file);
					const content = await fs.readFile(filePath, "utf-8");
					const parsed = JSON.parse(content) as TranslationFile;
					this.mergeTranslations(target, parsed);
				} catch (error) {
					logger.warn(`Failed to load translation file: ${file}`, { error });
				}
			}
		} catch (error) {
			// 目录不存在时静默失败
			if (!isEnoent(error)) {
				logger.warn(`Failed to read translation directory: ${this.lanDir}`, { error });
			}
		}
	}

	/**
	 * 合并翻译
	 */
	private mergeTranslations(target: TranslationFile, source: TranslationFile): void {
		for (const [key, value] of Object.entries(source)) {
			if (key === "meta") {
				target.meta = value as TranslationMeta;
			} else if (typeof value === "string") {
				target[key] = value;
			} else if (typeof value === "object" && value !== null) {
				if (!target[key] || typeof target[key] !== "object") {
					target[key] = {};
				}
				this.mergeTranslations(target[key] as TranslationDict, value as TranslationDict);
			}
		}
	}

	/**
	 * 翻译字符串
	 *
	 * @param key 翻译键，支持点号分隔的嵌套键，如 "settings.theme.dark.label"
	 * @param fallback 如果找不到翻译，返回的默认值
	 * @param params 插值参数
	 */
	t(key: string, fallback?: string, params?: Record<string, unknown>): string {
		if (!this.initialized) {
			// 同步访问时使用未初始化的状态，返回 key
			return fallback || key;
		}

		// 先尝试直接查找扁平 key
		let value = this.dict[key];
		if (value !== undefined && typeof value === "string") {
			return params ? this.interpolate(value, params) : value;
		}

		// 再尝试嵌套查找
		value = this.getNestedValue(this.dict, key);
		if (value !== undefined && typeof value === "string") {
			return params ? this.interpolate(value, params) : value;
		}

		// 尝试 fallback 语言 - 先扁平后嵌套
		let fallbackValue = this.fallbackDict[key];
		if (fallbackValue !== undefined && typeof fallbackValue === "string") {
			return params ? this.interpolate(fallbackValue, params) : fallbackValue;
		}

		fallbackValue = this.getNestedValue(this.fallbackDict, key);
		if (fallbackValue !== undefined && typeof fallbackValue === "string") {
			return params ? this.interpolate(fallbackValue, params) : fallbackValue;
		}

		// 返回用户提供的 fallback 或 key 本身
		const result = fallback || key;
		return params ? this.interpolate(result, params) : result;
	}

	/**
	 * 获取嵌套值
	 */
	private getNestedValue(obj: unknown, key: string): string | TranslationDict | undefined {
		const keys = key.split(".");
		let current: unknown = obj;

		for (const k of keys) {
			if (current === undefined || current === null) return undefined;
			if (typeof current !== "object") return undefined;
			current = (current as Record<string, unknown>)[k];
		}

		return current as string | TranslationDict | undefined;
	}

	/**
	 * 插值替换
	 * 支持 {key} 格式
	 */
	private interpolate(template: string, params: Record<string, unknown>): string {
		return template.replace(/\{(\w+)\}/g, (match, key) => {
			return params[key] !== undefined ? String(params[key]) : match;
		});
	}

	/**
	 * 获取当前语言
	 */
	getLanguage(): string {
		return this.lang;
	}

	/**
	 * 设置语言（用于运行时切换，需要重新加载）
	 */
	async setLanguage(lang: string): Promise<void> {
		this.lang = lang;
		this.dict = {};
		this.initialized = false;
		await this.init();
	}

	/**
	 * 检查翻译是否存在
	 */
	has(key: string): boolean {
		if (!this.initialized) return false;
		// 先检查扁平 key
		if (this.dict[key] !== undefined) return true;
		// 再检查嵌套 key
		return this.getNestedValue(this.dict, key) !== undefined;
	}

	/**
	 * 获取翻译元数据
	 */
	getMeta(): TranslationMeta | undefined {
		if (!this.initialized) return undefined;
		return this.dict.meta;
	}
}

// 全局单例（默认使用 ~/.omp/lan）
export const i18n = new I18nManager();

/**
 * 创建自定义 i18n 实例（用于测试）
 */
export function createI18n(lanDir?: string): I18nManager {
	return new I18nManager(lanDir);
}
export { I18nManager };

/**
 * 快捷翻译函数
 */
export function t(key: string, fallback?: string, params?: Record<string, unknown>): string {
	return i18n.t(key, fallback, params);
}

/**
 * 获取当前语言
 */
export function getLanguage(): string {
	return i18n.getLanguage();
}

/**
 * 设置语言
 */
export async function setLanguage(lang: string): Promise<void> {
	await i18n.setLanguage(lang);
}

/**
 * 检查翻译是否存在
 */
export function hasTranslation(key: string): boolean {
	return i18n.has(key);
}
