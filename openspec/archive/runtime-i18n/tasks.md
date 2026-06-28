# Tasks: Runtime i18n Implementation

## Phase 1: Core i18n Module

- [x] 创建 `packages/coding-agent/src/i18n/index.ts`
  - I18n 类：翻译加载、查找、语言检测
  - `load(lang)` 方法：从 `~/.omp/lan/{lang}-*.json` 加载所有翻译文件
  - `t(key, fallback)` 方法：查找翻译，缺失时返回 fallback
  - `getLanguage()` 方法：从 Settings 读取 `i18n.language`
  - 全局单例导出

- [x] 创建 i18n 单元测试
  - 测试翻译文件加载（多文件合并）
  - 测试 key 查找和 fallback
  - 测试语言检测和无效语言处理
  - 测试文件不存在和格式错误的容错

## Phase 2: Settings Translation

- [x] 在 `settings-schema.ts` 中添加 `i18n.language` 设置项
  - type: string, default: "en"
  - tab: "interaction", group: "General"
  - options: [{ value: "en", label: "English" }, { value: "zh", label: "中文" }]

- [x] 修改 `settings-defs.ts`（UI 适配层）
  - 在 `pathToSettingDef()` 中，用 `i18n.t(path + ".label", ui.label)` 替换原始 label
  - 用 `i18n.t(path + ".description", ui.description)` 替换原始 description
  - 对 `SubmenuOption` 的 label 和 description 也做翻译处理

- [x] 翻译 Tab 标签和分组标题
  - TAB_METADATA 中的 label（10 个 tab）
  - TAB_GROUPS 中的分组标题（51 个分组）

## Phase 3: Commands Translation

- [x] 修改命令注册机制
  - 在 `cli-commands.ts` 或命令基类中注入 i18n
  - 命令 description、flags.description、args.description 支持运行时翻译
  - 处理模块加载顺序问题（getter 延迟求值或注册时注入）

- [x] 逐个命令添加翻译支持
  - launch.ts（40 条）- 最核心
  - config.ts、setup.ts、models.ts 等常用命令
  - 其他命令

## Phase 4: Translation Files

- [x] 创建翻译文件目录结构 `~/.omp/lan/`
- [x] 创建 `scripts/gen-i18n-keys.ts` 脚本从源码提取翻译 key
- [x] 生成英文参考文件 `en-*.json`（283 个 key）
  - en-commands.json（231 个 key）
  - en-settings-appearance.json（4 个 key）
  - en-settings-model.json（6 个 key）
  - en-settings-interaction.json（11 个 key）
  - en-settings-context.json（4 个 key）
  - en-settings-memory.json（4 个 key）
  - en-settings-files.json（4 个 key）
  - en-settings-shell.json（2 个 key）
  - en-settings-tools.json（8 个 key）
  - en-settings-tasks.json（4 个 key）
  - en-settings-providers.json（5 个 key）
- [x] 生成中文翻译模板 `zh-*.json`
- [x] 翻译中文文件（部分完成，基础术语已翻译）
  - zh-commands.json（283 个 key）
  - zh-settings-*.json（10 个文件，共 52 个 key）

## Phase 5: 启动集成

- [x] 在 `packages/coding-agent/src/cli.ts` 中集成 i18n 初始化
  - 在 `runCli()` 开始时调用 `i18n.init()`
  - 确保在命令注册前加载翻译

> 注：Phase 5 的验证任务和 Phase 6、7 的任务将在 verify 阶段完成
