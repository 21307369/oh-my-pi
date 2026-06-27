#!/usr/bin/env bun
/**
 * 从源码中提取 i18n 翻译 key，生成英文模板和中文翻译文件
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LAN_DIR = path.join(os.homedir(), ".omp", "lan");

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
type TranslationData = {
	[key: string]: string | TranslationData;
};

function extractMatches(regex: RegExp, text: string): RegExpExecArray[] {
	const results: RegExpExecArray[] = [];
	let match = regex.exec(text);
	while (match !== null) {
		results.push(match);
		match = regex.exec(text);
	}
	return results;
}

function extractSettingsTranslations(): TranslationData {
	const schemaPath = path.join(process.cwd(), "packages/coding-agent/src/config/settings-schema.ts");
	const content = fs.readFileSync(schemaPath, "utf-8");
	const translations: TranslationData = {};

	const tabMetadataMatch = content.match(/export const TAB_METADATA[^{]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
	if (tabMetadataMatch) {
		const tabBlock = tabMetadataMatch[1];
		const tabRegex = /(\w+):\s*\{[^}]*label:\s*"([^"]+)"/g;
		for (const match of extractMatches(tabRegex, tabBlock)) {
			translations[`tabs.${match[1]}.label`] = match[2];
		}
	}

	const tabGroupsMatch = content.match(/export const TAB_GROUPS[^{]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
	if (tabGroupsMatch) {
		const groupsBlock = tabGroupsMatch[1];
		const groupRegex = /(\w+):\s*\[([^\]]+)\]/g;
		for (const match of extractMatches(groupRegex, groupsBlock)) {
			const tabName = match[1];
			const groups = match[2].match(/"([^"]+)"/g);
			if (groups) {
				for (let idx = 0; idx < groups.length; idx++) {
					const groupName = groups[idx].replace(/"/g, "");
					translations[`tabs.${tabName}.groups.${idx}`] = groupName;
				}
			}
		}
	}

	const settingsRegex = /ui:\s*\{[^}]*path:\s*"([^"]+)"[^}]*label:\s*"([^"]+)"[^}]*description:\s*"([^"]+)"/gs;
	for (const match of extractMatches(settingsRegex, content)) {
		translations[`settings.${match[1]}.label`] = match[2];
		translations[`settings.${match[1]}.description`] = match[3];
	}

	return translations;
}

function extractCommandsTranslations(): TranslationData {
	const commandsDir = path.join(process.cwd(), "packages/coding-agent/src/commands");
	const translations: TranslationData = {};
	const files = fs.readdirSync(commandsDir).filter(f => f.endsWith(".ts"));

	for (const file of files) {
		const content = fs.readFileSync(path.join(commandsDir, file), "utf-8");
		const commandName = file.replace(".ts", "");

		const descMatch = content.match(/description:\s*"([^"]+)"/);
		if (descMatch) {
			translations[`commands.${commandName}.description`] = descMatch[1];
		}

		const flagsRegex = /flags:\s*\{([^}]+)\}/gs;
		for (const flagsMatch of extractMatches(flagsRegex, content)) {
			const flagRegex = /(\w+):\s*Flags\.\w+\(\{[^}]*description:\s*"([^"]+)"/gs;
			for (const flagMatch of extractMatches(flagRegex, flagsMatch[1])) {
				translations[`commands.${commandName}.flags.${flagMatch[1]}.description`] = flagMatch[2];
			}
		}

		const argsRegex = /args:\s*\{([^}]+)\}/gs;
		for (const argsMatch of extractMatches(argsRegex, content)) {
			const argRegex = /(\w+):\s*Args\.\w+\(\{[^}]*description:\s*"([^"]+)"/gs;
			for (const argMatch of extractMatches(argRegex, argsMatch[1])) {
				translations[`commands.${commandName}.args.${argMatch[1]}.description`] = argMatch[2];
			}
		}
	}

	return translations;
}

function extractCliTranslations(): TranslationData {
	return {
		"cli.usage": "USAGE",
		"cli.commands": "COMMANDS",
		"cli.arguments": "ARGUMENTS",
		"cli.flags": "FLAGS",
		"cli.examples": "EXAMPLES",
	};
}

function generateTranslationFiles() {
	console.log("Extracting translations from source code...");

	const allTranslations = {
		...extractCliTranslations(),
		...extractSettingsTranslations(),
		...extractCommandsTranslations(),
	};

	console.log(`Found ${Object.keys(allTranslations).length} translation keys`);

	if (!fs.existsSync(LAN_DIR)) {
		fs.mkdirSync(LAN_DIR, { recursive: true });
	}

	const enFile = path.join(LAN_DIR, "en-commands.json");
	fs.writeFileSync(enFile, JSON.stringify(allTranslations, null, 2));
	console.log(`Generated: ${enFile}`);

	const zhTranslations: Record<string, string> = {};
	for (const key of Object.keys(allTranslations)) {
		zhTranslations[key] = "";
	}

	const zhFile = path.join(LAN_DIR, "zh-commands.json");
	fs.writeFileSync(zhFile, JSON.stringify(zhTranslations, null, 2));
	console.log(`Generated: ${zhFile}`);

	console.log("\nDone! Fill in zh-commands.json with Chinese translations.");
}

try {
	generateTranslationFiles();
} catch (error) {
	console.error("Error generating translations:", error);
	process.exit(1);
}
