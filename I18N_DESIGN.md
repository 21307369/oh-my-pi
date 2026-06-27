# 国际化（i18n）方案设计

## 背景与目标

### 现状分析
- **主要关注包**：`packages/coding-agent/`
- **字符串来源**：
  - `.md` prompt 文件（约 140+ 个）- 通过 `import ... with { type: "text" }` 静态加载
  - TypeScript 代码中的错误信息、日志、UI 文本（约 1263 处）
  - 工具描述文件（`.md` 格式）
- **构建方式**：使用 `bun build --compile` 编译成二进制，所有 `.md` 文件会被内联
- **配置目录**：已使用 `~/.omp/` 存储各种数据（autoresearch、puppeteer 等）

### 核心挑战
1. 编译后的二进制已经内联了所有英文字符串
2. 需要在运行时提供翻译能力，同时保持与上游同步
3. 上游不会接受国际化 PR，需要自行维护 fork

### 目标
- 使用 `~/.omp/lan/zh.json` 和 `en.json` 存放翻译
- 提供从主分支同步最新代码的能力
- 最小化手动维护成本

---

## 方案设计

### 架构概览

```
┌─────────────────────────────────────────────────────┐
│                  用户运行 omp                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         1. 初始化 i18n 系统（cli.ts 入口）            │
│         - 读取 ~/.omp/lan/{lang}.json               │
│         - 加载翻译字典                                │
└─────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│ Markdown 文件     │          │ TypeScript 字符串 │
│ (prompt 模板)     │          │ (代码内嵌)        │
└──────────────────┘          └──────────────────┘
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│ 运行时覆盖机制    │          │ t() 函数包装     │
│ 检查翻译目录     │          │ 查表替换         │
└──────────────────┘          └──────────────────┘
        ↓                               ↓
        └───────────────┬───────────────┘
                        ↓
            ┌──────────────────────┐
            │  输出翻译后的文本     │
            └──────────────────────┘
```

### 方案详解

#### 1. 翻译文件结构

**目录布局**：
```
~/.omp/lan/
├── en.json                    # 英文（默认，可选）
├── zh.json                    # 中文
├── ja.json                    # 日文（未来扩展）
└── prompts/                   # Markdown prompt 翻译
    ├── zh/
    │   ├── tools/
    │   │   ├── read.md
    │   │   ├── write.md
    │   │   └── ...
    │   └── system/
    │       ├── system-prompt.md
    │       └── ...
    └── ja/
        └── ...
```

**JSON 翻译文件格式** (`zh.json`)：
```json
{
  "meta": {
    "version": "16.2.2",
    "lastUpdated": "2026-06-28",
    "completeness": 85
  },
  "errors": {
    "file_not_found": "文件未找到: {path}",
    "permission_denied": "权限被拒绝: {path}",
    "invalid_config": "无效的配置: {key}"
  },
  "tools": {
    "read": {
      "description": "读取文件内容",
      "status_reading": "正在读取...",
      "status_success": "已读取 {path}",
      "status_error": "读取失败"
    },
    "write": {
      "description": "写入文件",
      "status_writing": "正在写入...",
      "status_success": "已写入 {path}",
      "status_error": "写入失败"
    }
  },
  "ui": {
    "loading": "加载中...",
    "processing": "处理中...",
    "confirm": "确认",
    "cancel": "取消"
  },
  "prompts": {
    "keys": [
      "system-prompt",
      "tools.read",
      "tools.write"
    ]
  }
}
```

#### 2. TypeScript 字符串翻译系统

**核心实现**：`packages/coding-agent/src/i18n/index.ts`

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface TranslationDict {
  [key: string]: string | TranslationDict;
}

class I18n {
  private dict: TranslationDict = {};
  private lang: string = "en";
  private fallbackLang: string = "en";
  private fallbackDict: TranslationDict = {};

  constructor() {
    this.init();
  }

  private init(): void {
    // 从环境变量或配置文件读取语言设置
    this.lang = process.env.OMP_LANG || process.env.LANG?.split(".")[0] || "en";
    
    // 加载翻译文件
    const lanDir = join(homedir(), ".omp", "lan");
    const langFile = join(lanDir, `${this.lang}.json`);
    const fallbackFile = join(lanDir, `${this.fallbackLang}.json`);

    if (existsSync(langFile)) {
      try {
        const content = readFileSync(langFile, "utf-8");
        this.dict = JSON.parse(content);
      } catch (error) {
        console.error(`Failed to load translation file: ${langFile}`, error);
      }
    }

    // 加载 fallback（英文）
    if (this.lang !== this.fallbackLang && existsSync(fallbackFile)) {
      try {
        const content = readFileSync(fallbackFile, "utf-8");
        this.fallbackDict = JSON.parse(content);
      } catch (error) {
        // ignore
      }
    }
  }

  /**
   * 翻译字符串
   * @param key 翻译键，如 "errors.file_not_found"
   * @param params 插值参数，如 { path: "/path/to/file" }
   */
  t(key: string, params?: Record<string, string | number>): string {
    let value = this.getNestedValue(this.dict, key);
    
    // 如果找不到，尝试 fallback
    if (value === undefined) {
      value = this.getNestedValue(this.fallbackDict, key);
    }
    
    // 如果还找不到，返回键本身
    if (value === undefined || typeof value !== "string") {
      return key;
    }

    // 插值替换
    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  private getNestedValue(obj: TranslationDict, key: string): string | undefined {
    const keys = key.split(".");
    let current: any = obj;
    
    for (const k of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[k];
    }
    
    return typeof current === "string" ? current : undefined;
  }

  private interpolate(template: string, params: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() ?? match;
    });
  }
}

// 全局单例
export const i18n = new I18n();

/**
 * 快捷翻译函数
 */
export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.t(key, params);
}
```

**使用示例**：
```typescript
// 原来的代码
throw new Error(`File not found: ${path}`);

// 修改后的代码
import { t } from "../i18n";
throw new Error(t("errors.file_not_found", { path }));
```

#### 3. Markdown Prompt 翻译机制

**核心思路**：
- 在运行时检查 `~/.omp/lan/prompts/{lang}/` 目录
- 如果存在对应的翻译文件，使用翻译版本
- 否则使用原始的英文版本

**实现方案**：修改 prompt 加载逻辑

**原始加载方式**：
```typescript
import systemPrompt from "./prompts/system/system-prompt.md" with { type: "text" };
```

**修改后的加载方式**：
```typescript
import originalSystemPrompt from "./prompts/system/system-prompt.md" with { type: "text" };
import { loadTranslatedPrompt } from "../i18n/prompt-loader";

const systemPrompt = loadTranslatedPrompt("system/system-prompt", originalSystemPrompt);
```

**翻译加载器**：`packages/coding-agent/src/i18n/prompt-loader.ts`

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const promptCache = new Map<string, string>();

/**
 * 加载翻译的 prompt 文件
 * @param promptPath prompt 相对路径（不含 .md 后缀），如 "system/system-prompt"
 * @param originalContent 原始英文内容
 */
export function loadTranslatedPrompt(
  promptPath: string,
  originalContent: string,
): string {
  // 检查缓存
  const cacheKey = `${process.env.OMP_LANG || "en"}:${promptPath}`;
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  // 确定语言
  const lang = process.env.OMP_LANG || process.env.LANG?.split(".")[0] || "en";
  
  // 如果是英文，直接返回原文
  if (lang === "en") {
    return originalContent;
  }

  // 构造翻译文件路径
  const translatedPath = join(
    homedir(),
    ".omp",
    "lan",
    "prompts",
    lang,
    `${promptPath}.md`,
  );

  // 检查翻译文件是否存在
  if (existsSync(translatedPath)) {
    try {
      const translated = readFileSync(translatedPath, "utf-8");
      promptCache.set(cacheKey, translated);
      return translated;
    } catch (error) {
      console.error(`Failed to load translated prompt: ${translatedPath}`, error);
    }
  }

  // 找不到翻译，返回原文
  promptCache.set(cacheKey, originalContent);
  return originalContent;
}

/**
 * 清除 prompt 缓存（用于语言切换）
 */
export function clearPromptCache(): void {
  promptCache.clear();
}
```

**需要修改的文件示例**（约 140+ 个文件）：
```typescript
// packages/coding-agent/src/prompts/system/system-prompt.ts
import originalSystemPrompt from "./system-prompt.md" with { type: "text" };
import { loadTranslatedPrompt } from "../i18n/prompt-loader";

export const systemPrompt = loadTranslatedPrompt("system/system-prompt", originalSystemPrompt);
```

#### 4. 与上游同步的方案

**方案 A：补丁系统（推荐）**

使用 `patch-package` 或自定义脚本维护对源代码的修改。

**实施步骤**：

1. **初始化补丁工具**：
```bash
cd packages/coding-agent
npm install -D patch-package
```

2. **添加脚本到 `package.json`**：
```json
{
  "scripts": {
    "postinstall": "patch-package",
    "sync:upstream": "./scripts/sync-upstream.sh"
  }
}
```

3. **创建同步脚本** `scripts/sync-upstream.sh`：
```bash
#!/bin/bash
set -e

echo "=== 同步上游更新 ==="

# 1. 拉取上游更新
git fetch upstream
git checkout zh/runtime-language-files

# 2. 尝试 rebase
if git rebase upstream/main; then
  echo "✓ Rebase 成功"
else
  echo "✗ Rebase 遇到冲突，需要手动解决"
  echo "解决冲突后运行: git rebase --continue"
  exit 1
fi

# 3. 应用补丁（如果有新的冲突）
if [ -d "patches" ]; then
  echo "=== 应用 i18n 补丁 ==="
  npx patch-package || {
    echo "✗ 补丁应用失败，可能需要更新补丁"
    echo "手动修改后运行: npx patch-package"
    exit 1
  }
fi

# 4. 重新构建
echo "=== 重新构建 ==="
npm run build

echo "✓ 同步完成"
```

4. **生成补丁**：
```bash
# 完成 i18n 修改后
npx patch-package

# 这会生成 patches/@oh-my-pi+pi-coding-agent+*.patch
```

5. **提交补丁文件**：
```bash
git add patches/
git commit -m "chore: update i18n patches"
```

**方案 B：独立 i18n 模块 + 入口包装**

创建一个独立的 i18n 包装层，不直接修改源代码，而是在入口点注入。

**优势**：
- 减少与上游的冲突
- 更容易维护

**实施**：
```typescript
// packages/coding-agent/src/cli-i18n.ts
import "./i18n/init"; // 初始化 i18n 系统
import "./cli"; // 加载原始入口
```

**修改构建脚本**：
```typescript
// scripts/build-binary.ts
// 将入口从 "./packages/coding-agent/src/cli.ts" 
// 改为 "./packages/coding-agent/src/cli-i18n.ts"
```

**局限**：
- 无法修改内部模块的行为
- 需要更多的 monkey-patching

**方案 C：Fork 维护 + 自动化脚本**

完全手动维护 fork，使用脚本辅助同步。

**同步流程**：
```bash
#!/bin/bash
# scripts/sync-and-apply-i18n.sh

# 1. 创建临时分支
git checkout -b temp-sync upstream/main

# 2. 尝试合并
if git merge zh/runtime-language-files; then
  echo "✓ 自动合并成功"
else
  echo "✗ 需要手动解决冲突"
  # 使用 merge 工具或手动解决
fi

# 3. 运行自动化脚本更新翻译文件
node scripts/update-translations.js

# 4. 测试
npm test

# 5. 更新分支
git checkout zh/runtime-language-files
git merge temp-sync
git branch -d temp-sync
```

### 推荐方案：方案 A（补丁系统）+ 方案 B（入口包装）组合

**理由**：
1. 补丁系统可以精确追踪所有修改
2. 入口包装减少了对核心模块的侵入
3. 自动化脚本降低同步成本
4. 保留了与上游同步的能力

---

## 实施计划

### 阶段 1：基础框架搭建（预计 2-3 小时）

1. **创建 i18n 核心模块**：
   - `packages/coding-agent/src/i18n/index.ts`
   - `packages/coding-agent/src/i18n/prompt-loader.ts`
   - `packages/coding-agent/src/i18n/init.ts`

2. **修改入口点**：
   - 创建 `packages/coding-agent/src/cli-i18n.ts`
   - 修改 `scripts/build-binary.ts` 使用新入口

3. **创建翻译文件目录结构**：
   - 编写 `zh.json` 初始版本（先覆盖错误信息）
   - 创建 `prompts/zh/` 目录结构

### 阶段 2：字符串标记（预计 8-12 小时）

1. **标记 TypeScript 字符串**：
   - 使用脚本批量搜索和标记（可选）
   - 手动标记关键错误信息和 UI 文本
   - 优先级：用户可见的错误 > 日志 > 内部文本

2. **标记 Markdown prompt**：
   - 修改约 140+ 个文件的加载逻辑
   - 使用 `loadTranslatedPrompt` 包装
   - 可以分批进行：先核心 prompt，后次要 prompt

3. **更新翻译文件**：
   - 为所有标记的字符串添加中文翻译
   - 翻译 prompt 文件

### 阶段 3：同步工具与测试（预计 2-3 小时）

1. **创建同步脚本**：
   - `scripts/sync-upstream.sh`
   - `scripts/update-translations.js`

2. **配置 patch-package**：
   - 安装和初始化
   - 生成初始补丁

3. **测试验证**：
   - 测试中文环境下的输出
   - 测试英文环境（fallback）
   - 测试从上游同步

### 阶段 4：文档与维护指南（预计 1 小时）

1. **编写同步文档**：
   - 如何从上游同步
   - 如何处理冲突
   - 如何更新翻译

2. **创建翻译指南**：
   - 翻译文件结构说明
   - 插值语法
   - 测试翻译

---

## 技术细节

### 性能考虑

1. **翻译缓存**：
   - prompt 文件翻译结果缓存到内存
   - JSON 翻译文件一次性加载

2. **懒加载**：
   - 只在首次使用时加载翻译文件
   - 不使用的语言不会加载

3. **编译时优化**：
   - 翻译文件路径在编译时确定
   - 避免运行时路径解析开销

### 错误处理

1. **翻译文件缺失**：
   - 静默回退到英文
   - 记录警告日志（如果有 logger）

2. **翻译键缺失**：
   - 返回键本身
   - 便于调试和发现未翻译的内容

3. **翻译文件格式错误**：
   - 捕获 JSON 解析错误
   - 回退到英文

### 环境变量

```bash
# 强制指定语言
export OMP_LANG=zh

# 或者使用系统 LANG
export LANG=zh_CN.UTF-8
```

### 翻译文件版本管理

在 `zh.json` 中添加版本信息：
```json
{
  "meta": {
    "version": "16.2.2",
    "upstream_commit": "abc123def",
    "lastUpdated": "2026-06-28",
    "completeness": 85
  }
}
```

同步脚本可以检查版本并提示更新翻译。

---

## 风险与挑战

### 风险 1：大量文件修改导致冲突

**缓解措施**：
- 使用补丁系统精确追踪修改
- 分批标记字符串，避免一次性大规模修改
- 优先修改稳定的、不常变动的模块

### 风险 2：翻译维护成本

**缓解措施**：
- 使用 `meta.completeness` 追踪翻译进度
- 同步脚本提示未翻译的内容
- 社区协作翻译（如果开源）

### 风险 3：性能影响

**缓解措施**：
- 翻译文件缓存
- 懒加载机制
- 编译时优化

### 风险 4：遗漏翻译

**缓解措施**：
- 开发模式下显示未翻译的键
- 提供翻译完整性报告
- 单元测试检查关键路径的翻译

---

## 下一步行动

### 立即可做（今天）：

1. **创建 i18n 基础框架**：
   ```bash
   mkdir -p packages/coding-agent/src/i18n
   # 创建 index.ts, prompt-loader.ts, init.ts
   ```

2. **创建初始翻译文件**：
   ```bash
   mkdir -p ~/.omp/lan/prompts/zh/tools
   mkdir -p ~/.omp/lan/prompts/zh/system
   # 创建 zh.json
   ```

3. **修改入口点并测试**：
   - 创建 `cli-i18n.ts`
   - 修改构建脚本
   - 构建并测试

### 短期任务（本周）：

1. 标记关键错误信息和 UI 文本（约 50-100 处）
2. 翻译核心 prompt 文件（约 20-30 个）
3. 创建同步脚本和文档

### 中期任务（本月）：

1. 完成所有字符串标记
2. 完成翻译文件
3. 测试和优化
4. 编写完整文档

---

## 总结

这个方案的核心思路是：

1. **运行时翻译**：通过 i18n 框架在运行时替换字符串
2. **补丁系统**：使用 patch-package 追踪所有修改，便于同步
3. **入口包装**：最小化对核心模块的侵入
4. **自动化脚本**：降低同步和维护成本

这个方案的优势：
- ✅ 保留了与上游同步的能力
- ✅ 翻译文件独立存储，易于维护
- ✅ 性能影响最小
- ✅ 错误处理完善
- ✅ 可以逐步实施，不需要一次性完成

劣势：
- ❌ 需要手动维护 fork
- ❌ 同步时可能需要解决冲突
- ❌ 翻译工作需要时间

但相比直接向 upstream 提交 PR（不太可能被接受），这是最可行的方案。
