# Comet Design Handoff

- Change: runtime-i18n
- Phase: design
- Mode: compact
- Context hash: cdbb4db2323e278b213acffc56d9623bccd8b04e4e614efd0ac0d5ac842614ac

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/runtime-i18n/proposal.md

- Source: openspec/changes/runtime-i18n/proposal.md
- Lines: 1-31
- SHA256: 1acaecec466740fafd2c2ad12137219049facad28e8041e7eec7346849f5e24f

```md
## Why

oh-my-pi 目前所有用户可见文本（设置面板、命令描述）均为英文硬编码，中文用户体验不佳。现有 i18n 分支采用 patch + 硬编码翻译的方式，维护成本高、与上游同步困难。需要一套基于运行时 JSON 翻译文件的 i18n 方案，支持从 `~/.omp/lan/` 加载翻译，便于 fork 独立维护。

## What Changes

- 添加 i18n 核心模块，支持从 `~/.omp/lan/*.json` 加载翻译
- 设置系统（settings-schema.ts）中的 label 和 description 支持翻译
- 命令系统（commands/*.ts）中的 description 支持翻译
- 设置中增加 `language` 选项，用户可切换语言
- 翻译文件按模块拆分：设置按 Tab 拆分为 10 个文件，命令合为一个文件
- 提供 `sync-and-patch.sh` 脚本支持从上游同步
- 翻译工作由子代理完成

## Capabilities

### New Capabilities
- `i18n-core`: i18n 核心模块，提供翻译加载、语言检测、插值替换功能
- `i18n-settings`: 设置系统翻译集成，运行时从 JSON 文件覆盖设置标签和描述
- `i18n-commands`: 命令系统翻译集成，运行时从 JSON 文件覆盖命令描述
- `i18n-sync`: 上游同步工具，包含 patch 生成和应用脚本

### Modified Capabilities
- `settings-system`: 设置 UI 层增加翻译查找逻辑，从 i18n 模块获取本地化文本

## Impact

- **代码**：`packages/coding-agent/src/i18n/`（新模块），`packages/coding-agent/src/config/settings-schema.ts`（UI 元数据层），`packages/coding-agent/src/commands/`（命令描述层）
- **运行时**：启动时加载翻译文件，无性能影响
- **外部系统**：翻译文件存储在 `~/.omp/lan/`，用户可编辑
- **上游同步**：通过 patch 机制，fork 可独立维护 i18n 修改
```

## openspec/changes/runtime-i18n/design.md

- Source: openspec/changes/runtime-i18n/design.md
- Lines: 1-225
- SHA256: 6d9609e9cb5acc1bed8f9d4d92fd41b00e34ed4af166aa50996a54b9333dc9f5

[TRUNCATED]

```md
# Design: Runtime i18n System

## 架构决策

### ADR-1: 翻译文件存储在 ~/.omp/lan/

**决策**：翻译文件存储在用户目录 `~/.omp/lan/` 而非代码库中。

**原因**：
- fork 独立维护，不与上游冲突
- 用户可自定义翻译（如公司内部术语）
- 便于备份和迁移

**权衡**：首次使用需下载翻译文件，但可内置默认翻译作为 fallback。

### ADR-2: 按模块拆分翻译文件

**决策**：设置按 Tab 拆分为 10 个文件，命令合为一个文件。

```
~/.omp/lan/
├── zh-settings-appearance.json
├── zh-settings-model.json
├── zh-settings-interaction.json
├── zh-settings-context.json
├── zh-settings-memory.json
├── zh-settings-files.json
├── zh-settings-shell.json
├── zh-settings-tools.json
├── zh-settings-tasks.json
├── zh-settings-providers.json
├── zh-commands.json
└── en-*.json (参考)
```

**原因**：
- 设置系统有 1217 条翻译，单文件过大（42KB）
- 命令系统仅 200 条，合为一文件足够
- 按 Tab 拆分与代码结构对应，便于维护

**权衡**：加载时需读取多个文件，但启动时一次性加载，性能影响可忽略。

### ADR-3: 设置项使用 path 作为翻译 key

**决策**：设置项的翻译 key 直接使用设置路径，如 `theme.dark.label`。

**原因**：
- 与设置路径一一对应，无需额外映射
- 代码改动最小，只需在 UI 层查找翻译
- 便于批量翻译和校验

**示例**：
```json
{
  "theme.dark.label": "深色主题",
  "theme.dark.description": "终端使用深色背景时的主题"
}
```

### ADR-4: 命令使用 name 作为翻译 key

**决策**：命令的翻译 key 使用命令名称，如 `launch.description`。

**示例**：
```json
{
  "launch.description": "AI 编码助手",
  "launch.flags.model.description": "使用的模型（模糊匹配：opus、gpt-5.2 或 openai/gpt-5.2）"
}
```

## 核心组件

### 1. i18n 核心模块

```typescript
// packages/coding-agent/src/i18n/index.ts

export class I18n {
  private translations: Record<string, string> = {};
```

Full source: openspec/changes/runtime-i18n/design.md

## openspec/changes/runtime-i18n/tasks.md

- Source: openspec/changes/runtime-i18n/tasks.md
- Lines: 1-81
- SHA256: fc728fb9e0a0636339d6eea089b34cc3c35700c1f29e262f0784680f4df71366

[TRUNCATED]

```md
# Tasks: Runtime i18n Implementation

## Phase 1: Core i18n Module

- [ ] 创建 `packages/coding-agent/src/i18n/index.ts`
  - I18n 类：翻译加载、查找、语言检测
  - `load(lang)` 方法：从 `~/.omp/lan/{lang}-*.json` 加载所有翻译文件
  - `t(key, fallback)` 方法：查找翻译，缺失时返回 fallback
  - `getLanguage()` 方法：从 Settings 读取 `i18n.language`
  - 全局单例导出

- [ ] 创建 i18n 单元测试
  - 测试翻译文件加载（多文件合并）
  - 测试 key 查找和 fallback
  - 测试语言检测和无效语言处理
  - 测试文件不存在和格式错误的容错

## Phase 2: Settings Translation

- [ ] 在 `settings-schema.ts` 中添加 `i18n.language` 设置项
  - type: string, default: "en"
  - tab: "interaction", group: "General"
  - options: [{ value: "en", label: "English" }, { value: "zh", label: "中文" }]

- [ ] 修改 `settings-defs.ts`（UI 适配层）
  - 在 `pathToSettingDef()` 中，用 `i18n.t(path + ".label", ui.label)` 替换原始 label
  - 用 `i18n.t(path + ".description", ui.description)` 替换原始 description
  - 对 `SubmenuOption` 的 label 和 description 也做翻译处理

- [ ] 翻译 Tab 标签和分组标题
  - TAB_METADATA 中的 label（10 个 tab）
  - TAB_GROUPS 中的分组标题（51 个分组）

## Phase 3: Commands Translation

- [ ] 修改命令注册机制
  - 在 `cli-commands.ts` 或命令基类中注入 i18n
  - 命令 description、flags.description、args.description 支持运行时翻译
  - 处理模块加载顺序问题（getter 延迟求值或注册时注入）

- [ ] 逐个命令添加翻译支持
  - launch.ts（40 条）- 最核心
  - config.ts、setup.ts、models.ts 等常用命令
  - 其他命令

## Phase 4: Translation Files

- [ ] 创建翻译文件目录结构 `~/.omp/lan/`
- [ ] 生成英文参考文件 `en-*.json`（从源码提取所有 key）
- [ ] 子代理翻译：zh-settings-appearance.json
- [ ] 子代理翻译：zh-settings-model.json
- [ ] 子代理翻译：zh-settings-interaction.json
- [ ] 子代理翻译：zh-settings-context.json
- [ ] 子代理翻译：zh-settings-memory.json
- [ ] 子代理翻译：zh-settings-files.json
- [ ] 子代理翻译：zh-settings-shell.json
- [ ] 子代理翻译：zh-settings-tools.json
- [ ] 子代理翻译：zh-settings-tasks.json
- [ ] 子代理翻译：zh-settings-providers.json
- [ ] 子代理翻译：zh-commands.json

## Phase 5: Sync Tooling

- [ ] 创建/更新 `sync-and-patch.sh`
  - 从 origin/main 拉取更新
  - 自动应用 i18n patch
  - 处理冲突并提示
- [ ] 创建 patch 生成脚本
  - 从当前分支生成 i18n 相关的 patch 文件
  - 存储到 `patches/zh/` 目录
- [ ] 编写 README：同步流程和翻译贡献指南

## Phase 6: Integration & Verification

- [ ] 启动时加载翻译文件
  - 在 cli.ts 或 main.ts 入口点初始化 i18n
  - 确保在命令注册前加载翻译
- [ ] 端到端测试：中文环境下设置面板显示
- [ ] 端到端测试：中文环境下命令帮助显示
- [ ] 端到端测试：语言切换后重启生效
```

Full source: openspec/changes/runtime-i18n/tasks.md

