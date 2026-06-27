---
comet_change: runtime-i18n
role: technical-design
canonical_spec: openspec
---

# Runtime i18n 系统设计

## 概述

为 oh-my-pi 添加运行时国际化（i18n）支持，允许用户通过设置切换界面语言。翻译文件存储在用户目录 `~/.omp/lan/`，通过 patch 机制与上游同步，fork 独立维护。

## 设计目标

1. **运行时加载**：翻译文件从 `~/.omp/lan/` 动态加载，无需重新编译
2. **最小化改动**：命令系统零改动，设置系统仅在 UI 层添加翻译查找
3. **模块化拆分**：设置按 Tab 拆分为 10 个文件，命令合为 1 个文件
4. **可维护性**：提供工具自动生成英文模板，便于检测和补充缺失翻译
5. **上游兼容**：通过 patch 机制与上游同步，fork 独立维护

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

### ADR-5: 命令帮助渲染层统一拦截

**决策**：在 `packages/utils/src/cli.ts` 的帮助渲染函数中添加可选的 `translator` 参数，在渲染时使用翻译器翻译文本。

**原因**：
- 命令源码零改动，所有命令文件保持不变
- 统一拦截点，只在帮助渲染时翻译
- 向后兼容，`translator` 是可选参数
- 灵活扩展，未来可以添加更多翻译场景

**实现**：
```typescript
// packages/utils/src/cli.ts
export interface RunOptions {
  // ... existing fields
  translateCommandHelp?: (text: string, key: string) => string;
}

export function renderRootHelp(
  config: CliConfig, 
  translator?: (text: string, key: string) => string
): void {
  const t = translator ?? ((text: string) => text);
  lines.push(t("USAGE", "cli.usage"));
  lines.push(t("COMMANDS", "cli.commands"));
  // ...
}

export function renderCommandHelp(
  bin: string, 
  id: string, 
  Cmd: CommandCtor, 
  translator?: (text: string, key: string) => string
): void {
  const t = translator ?? ((text: string) => text);
  if (Cmd.description) lines.push(t(Cmd.description, `commands.${id}.description`));
  // 翻译 args、flags、examples
  // ...
}

// packages/coding-agent/src/cli.ts
await run({
  // ...
  help: async (config) => {
    renderRootHelp(config, (text, key) => i18n.t(key, text));
  },
  translateCommandHelp: (text, key) => i18n.t(key, text),
});
```

## 核心组件

### 1. i18n 核心模块

**位置**：`packages/coding-agent/src/i18n/index.ts`

**职责**：
- 从 `~/.omp/lan/{lang}-*.json` 加载所有翻译文件
- 提供 `t(key, fallback)` 方法查找翻译
- 提供 `getLanguage()` 方法从 Settings 读取 `i18n.language`
- 全局单例导出

**接口**：
```typescript
export class I18n {
  private translations: Record<string, string> = {};
  
  async load(lang: string): Promise<void> {
    // 加载 ~/.omp/lan/{lang}-*.json
    // 合并到 translations
  }
  
  t(key: string, fallback: string): string {
    return this.translations[key] || fallback;
  }
  
  getLanguage(): string {
    // 从 Settings 读取 i18n.language
  }
}

export const i18n = new I18n();
```

### 2. 设置系统集成

**位置**：`packages/coding-agent/src/modes/components/settings-defs.ts`

**修改点**：
- 在 `pathToSettingDef()` 中，用 `i18n.t(path + ".label", ui.label)` 替换原始 label
- 用 `i18n.t(path + ".description", ui.description)` 替换原始 description
- 对 `SubmenuOption` 的 label 和 description 也做翻译处理
- 翻译 `TAB_METADATA` 中的 label（10 个 tab）
- 翻译 `TAB_GROUPS` 中的分组标题（51 个分组）

**示例**：
```typescript
// 原始代码
const base = { path, label: ui.label, description: ui.description, ... };

// 修改后
import { i18n } from "../../i18n";
const base = { 
  path, 
  label: i18n.t(`${path}.label`, ui.label), 
  description: i18n.t(`${path}.description`, ui.description),
  ...
};
```

### 3. 命令系统集成

**位置**：`packages/utils/src/cli.ts` 和 `packages/coding-agent/src/cli.ts`

**修改点**：
- `packages/utils/src/cli.ts`：
  - `RunOptions` 接口添加 `translateCommandHelp` 可选字段
  - `renderRootHelp` 添加可选 `translator` 参数
  - `renderCommandHelp` 添加可选 `translator` 参数
  - `run` 函数在调用 `renderCommandHelp` 时传入 `opts.translateCommandHelp`
  
- `packages/coding-agent/src/cli.ts`：
  - 调用 `run()` 时传入自定义 `help` 函数和 `translateCommandHelp` 函数

**翻译 key 设计**：
```json
{
  "commands": {
    "launch": {
      "description": "AI 编码助手",
      "args": {
        "messages": {
          "description": "要发送的消息（在文件前加 @）"
        }
      },
      "flags": {
        "model": {
          "description": "使用的模型（模糊匹配：opus、gpt-5.2 或 openai/gpt-5.2）"
        }
      },
      "examples": [
        "# 交互模式\n  omp",
        "# 带初始提示的交互模式\n  omp \"列出 src/ 中所有 .ts 文件\""
      ]
    }
  },
  "cli": {
    "usage": "用法",
    "commands": "命令",
    "arguments": "参数",
    "flags": "选项",
    "examples": "示例"
  }
}
```

### 4. 语言设置

**位置**：`packages/coding-agent/src/config/settings-schema.ts`

**新增设置项**：
```typescript
"i18n.language": {
  type: "string",
  default: "en",
  ui: {
    tab: "interaction",
    group: "General",
    label: "Language",
    description: "UI language (requires restart)",
    options: [
      { value: "en", label: "English" },
      { value: "zh", label: "中文" },
    ],
  },
}
```

### 5. 翻译模板生成工具

**位置**：`packages/coding-agent/scripts/gen-i18n-keys.ts`

**职责**：
- 扫描 `settings-schema.ts` 提取所有设置项的 label 和 description
- 扫描 `commands/*.ts` 提取所有命令的 description、args、flags、examples
- 生成 `en-*.json` 模板文件
- 对比现有翻译文件，输出缺失/多余的 key

**使用方式**：
```bash
bun run scripts/gen-i18n-keys.ts
```

## 数据流

```
用户设置 i18n.language = "zh"
    ↓
Settings 保存到 ~/.omp/config.yml
    ↓
重启 omp
    ↓
启动时 i18n.load("zh")
    ↓
加载 ~/.omp/lan/zh-*.json
    ↓
合并到 i18n.translations
    ↓
UI 层调用 i18n.t(key, fallback)
    ↓
返回中文翻译或英文 fallback
```

## 关键场景

### 场景 1: 首次使用中文

1. 用户下载 `zh-*.json` 到 `~/.omp/lan/`
2. 启动 omp，设置 `i18n.language = "zh"`
3. 重启 omp
4. 设置面板显示中文
5. 命令帮助显示中文

### 场景 2: 翻译缺失

1. 用户切换到中文
2. 某个新设置项未翻译
3. `i18n.t()` 返回 fallback（英文原文）
4. 用户看到英文，但不影响功能

### 场景 3: 上游更新

1. 上游新增设置项
2. fork 执行 `sync-and-patch.sh`
3. 脚本拉取上游更新
4. 应用 i18n patch
5. 运行 `gen-i18n-keys.ts` 生成最新 `en-*.json`
6. 对比现有 `zh-*.json`，输出缺失的 key
7. 子代理翻译新增条目
8. 更新 `zh-*.json`

## 错误处理

- **翻译文件不存在**：使用内置英文 fallback
- **翻译文件格式错误**：记录日志，使用 fallback
- **翻译 key 缺失**：使用 fallback
- **语言设置无效**：fallback 到 "en"

## 性能考虑

- 翻译文件在启动时一次性加载，运行时查找为 O(1)
- 10 个设置文件 + 1 个命令文件，总大小约 100KB
- 加载耗时 < 10ms，可忽略

## 测试策略

1. **单元测试**：
   - i18n 模块的加载、查找、插值
   - 翻译模板生成工具的正确性

2. **集成测试**：
   - 设置面板显示翻译
   - 命令帮助显示翻译
   - 语言切换后重启生效

3. **端到端测试**：
   - 完整的多语言切换流程
   - 翻译缺失时的 fallback 行为

## 实施计划

### Phase 1: 核心模块（2 天）

1. 创建 `packages/coding-agent/src/i18n/index.ts`
2. 创建单元测试
3. 集成到 `cli.ts` 启动流程

### Phase 2: 设置翻译（3 天）

1. 在 `settings-schema.ts` 添加 `i18n.language` 设置项
2. 修改 `settings-defs.ts` 使用 `i18n.t()` 替换 label/description
3. 翻译 TAB_METADATA 和 TAB_GROUPS
4. 创建 `zh-settings-*.json` 翻译文件

### Phase 3: 命令翻译（2 天）

1. 修改 `packages/utils/src/cli.ts` 添加 translator 支持
2. 修改 `packages/coding-agent/src/cli.ts` 传入翻译函数
3. 创建 `zh-commands.json` 翻译文件

### Phase 4: 工具与文档（2 天）

1. 创建 `scripts/gen-i18n-keys.ts`
2. 创建 `sync-and-patch.sh`
3. 编写 README 和翻译贡献指南

### Phase 5: 验证与优化（1 天）

1. 端到端测试
2. 性能测试
3. 文档完善

**总计**：约 10 天

## 风险与缓解

1. **风险**：翻译文件与上游不同步
   - **缓解**：`gen-i18n-keys.ts` 自动检测缺失 key，`sync-and-patch.sh` 提醒更新

2. **风险**：翻译质量不一致
   - **缓解**：提供翻译指南，使用子代理批量翻译

3. **风险**：性能影响
   - **缓解**：启动时一次性加载，运行时查找为 O(1)，性能影响可忽略

4. **风险**：命令系统改动影响上游同步
   - **缓解**：仅在帮助渲染层添加可选参数，向后兼容，不影响命令源码

## 验收标准

1. 用户可以通过设置切换语言为中文
2. 设置面板显示中文标签和描述
3. 命令帮助（`omp --help` 和 `omp <cmd> --help`）显示中文
4. 翻译缺失时 fallback 到英文
5. 提供工具检测缺失翻译
6. 提供脚本从上游同步并应用 i18n patch

## 附录

### 翻译文件示例

**zh-settings-appearance.json**：
```json
{
  "appearance": "外观",
  "theme.dark.label": "深色主题",
  "theme.dark.description": "终端使用深色背景时的主题",
  "theme.light.label": "浅色主题",
  "theme.light.description": "终端使用浅色背景时的主题"
}
```

**zh-commands.json**：
```json
{
  "launch": {
    "description": "AI 编码助手",
    "flags": {
      "model": {
        "description": "使用的模型（模糊匹配：opus、gpt-5.2 或 openai/gpt-5.2）"
      }
    }
  },
  "cli": {
    "usage": "用法",
    "commands": "命令"
  }
}
```
