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
