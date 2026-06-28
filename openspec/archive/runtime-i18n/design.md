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

```typescript
// packages/coding-agent/src/config/settings-schema.ts

// 原始定义
{
  type: "string",
  default: "titanium",
  ui: {
    tab: "appearance",
    group: "Theme",
    label: "Dark Theme",
    description: "Theme used when the terminal has a dark background",
    options: "runtime",
  },
}

// UI 层修改（settings-defs.ts）
// 从 i18n 获取翻译，fallback 到原始 label/description
const label = i18n.t(`${path}.label`, ui.label);
const description = i18n.t(`${path}.description`, ui.description);
```

### 3. 命令系统集成

```typescript
// packages/coding-agent/src/commands/launch.ts

static description = i18n.t('launch.description', 'AI coding assistant');

static flags = {
  model: Flags.string({
    description: i18n.t('launch.flags.model.description', 'Model to use'),
  }),
}
```

**问题**：命令类在模块加载时就执行，此时 i18n 可能未初始化。

**解决方案**：使用 getter 延迟求值，或在命令注册时注入翻译。

### 4. 语言设置

```typescript
// settings-schema.ts 新增
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

1. 用户下载 zh-*.json 到 `~/.omp/lan/`
2. 启动 omp，设置 `i18n.language = "zh"`
3. 重启 omp
4. 设置面板显示中文

### 场景 2: 翻译缺失

1. 用户切换到中文
2. 某个新设置项未翻译
3. i18n.t() 返回 fallback（英文原文）
4. 用户看到英文，但不影响功能

### 场景 3: 上游更新

1. 上游新增设置项
2. fork 执行 `sync-and-patch.sh`
3. 脚本拉取上游更新
4. 应用 i18n patch
5. 新增设置项显示英文（待翻译）
6. 子代理翻译新增条目
7. 更新 zh-*.json

## 错误处理

- 翻译文件不存在：使用内置英文 fallback
- 翻译文件格式错误：记录日志，使用 fallback
- 翻译 key 缺失：使用 fallback
- 语言设置无效：fallback 到 "en"

## 性能考虑

- 翻译文件在启动时一次性加载，运行时查找为 O(1)
- 10 个设置文件 + 1 个命令文件，总大小约 100KB
- 加载耗时 < 10ms，可忽略

## 测试策略

- 单元测试：i18n 模块的加载、查找、插值
- 集成测试：设置面板显示翻译
- 集成测试：命令帮助显示翻译
- 端到端测试：完整的多语言切换流程
