# Translation Task for Phase 4

## Objective
Translate all Chinese translation files in `/Users/lsmir2/.omp/lan/` from English to Chinese.

## Files to Translate

1. `zh-commands.json` (231 keys)
2. `zh-settings-appearance.json` (4 keys)
3. `zh-settings-model.json` (6 keys)
4. `zh-settings-interaction.json` (11 keys)
5. `zh-settings-context.json` (4 keys)
6. `zh-settings-memory.json` (4 keys)
7. `zh-settings-files.json` (4 keys)
8. `zh-settings-shell.json` (2 keys)
9. `zh-settings-tools.json` (8 keys)
10. `zh-settings-tasks.json` (4 keys)
11. `zh-settings-providers.json` (5 keys)

Total: 283 keys

## Translation Guidelines

1. Use the corresponding `en-*.json` file as reference
2. Translate all values from English to Chinese (Simplified)
3. Keep all keys unchanged
4. Use professional, concise language suitable for a CLI tool
5. Maintain consistency in terminology
6. For technical terms, use commonly accepted Chinese translations

## Translation Examples

- "USAGE" → "用法"
- "COMMANDS" → "命令"
- "ARGUMENTS" → "参数"
- "FLAGS" → "选项"
- "EXAMPLES" → "示例"
- "Appearance" → "外观"
- "Model" → "模型"
- "Theme" → "主题"
- "Dark Theme" → "深色主题"
- "Light Theme" → "浅色主题"

## Execution

Translate each file using subagents in parallel for efficiency.

## Verification

After translation, verify:
- All keys are preserved
- All values are translated (no empty strings)
- Translation quality is consistent
- File format is valid JSON
