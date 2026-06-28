---
change: runtime-i18n
design-doc: docs/superpowers/specs/2026-06-28-runtime-i18n-design.md
created: 2026-06-28
---

# 实施计划：Runtime i18n

## 分支策略

- **Feature 分支**：`feat/runtime-i18n`
- **基于**：`zh/runtime-language-files`
- **合并目标**：`zh/runtime-language-files`（保持 fork 分支）

## 执行策略

- **模式**：Subagent-driven development
- **隔离**：Git 分支
- **TDD**：Direct implementation（先实现后测试）

## 实施阶段

### Phase 1: i18n 核心模块（预计 2h）

**目标**：创建基础翻译加载和查找机制

**任务**：
1. 创建 `packages/coding-agent/src/i18n/index.ts`
   - I18n 类实现
   - `load(lang)` 方法：从 `~/.omp/lan/{lang}-*.json` 加载
   - `t(key, fallback)` 方法：翻译查找
   - `getLanguage()` 方法：从 Settings 读取
   - 全局单例导出

2. 创建单元测试 `packages/coding-agent/test/i18n.test.ts`
   - 测试加载、查找、fallback 逻辑

**验收标准**：
- ✅ 可以加载多个 JSON 文件并合并
- ✅ 可以查找翻译 key
- ✅ 缺失 key 时返回 fallback
- ✅ 单元测试通过

**Subagent 配置**：
```
agent: code-implementer
task: "实现 i18n 核心模块"
skills: typescript, testing
```

---

### Phase 2: 设置系统集成（预计 3h）

**目标**：在设置 UI 层集成翻译

**任务**：
1. 在 `settings-schema.ts` 添加 `i18n.language` 设置项
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

2. 修改 `settings-defs.ts` 的 `pathToSettingDef()` 函数
   - 用 `i18n.t(`${path}.label`, ui.label)` 替换 label
   - 用 `i18n.t(`${path}.description`, ui.description)` 替换 description
   - 处理 SubmenuOption 的翻译

3. 翻译 `TAB_METADATA` 和 `TAB_GROUPS`
   - 10 个 tab label
   - 51 个 group label

**验收标准**：
- ✅ 设置面板显示翻译后的文本
- ✅ Tab 和 Group 标题显示翻译
- ✅ 语言设置项可以切换

**Subagent 配置**：
```
agent: code-implementer
task: "集成设置系统翻译"
skills: typescript, react (如果有 UI)
```

---

### Phase 3: 命令系统集成（预计 2h）

**目标**：在命令帮助渲染层集成翻译

**任务**：
1. 修改 `packages/utils/src/cli.ts`
   - 在 `RunOptions` 添加 `translateCommandHelp` 可选字段
   - 修改 `renderRootHelp` 添加 `translator` 参数
   - 修改 `renderCommandHelp` 添加 `translator` 参数
   - 在 `run` 函数中传入 `translateCommandHelp`

2. 修改 `packages/coding-agent/src/cli.ts`
   - 导入 `i18n` 模块
   - 在 `run()` 调用时传入翻译函数

**验收标准**：
- ✅ `omp --help` 显示翻译
- ✅ `omp <cmd> --help` 显示翻译
- ✅ 命令描述、参数、选项都翻译

**Subagent 配置**：
```
agent: code-implementer
task: "集成命令帮助翻译"
skills: typescript, cli
```

---

### Phase 4: 翻译文件生成（预计 4h）

**目标**：创建翻译模板和中文翻译

**任务**：
1. 创建 `scripts/gen-i18n-keys.ts`
   - 扫描 `settings-schema.ts` 提取所有 label/description
   - 扫描 `commands/*.ts` 提取所有描述
   - 生成 `en-*.json` 模板

2. 创建目录结构 `~/.omp/lan/`

3. 生成英文参考文件
   - `en-settings-appearance.json`
   - `en-settings-model.json`
   - ... (10 个设置文件)
   - `en-commands.json`

4. 使用子代理翻译中文文件
   - `zh-settings-appearance.json`
   - `zh-settings-model.json`
   - ... (10 个设置文件)
   - `zh-commands.json`

**验收标准**：
- ✅ 可以从源码提取所有翻译 key
- ✅ 生成完整的英文模板
- ✅ 中文翻译文件完整

**Subagent 配置**：
```
agent: code-implementer (生成工具)
agent: translator (翻译任务，可并行)
task: "生成翻译文件和中文翻译"
skills: typescript, translation
```

---

### Phase 5: 启动集成（预计 1h）

**目标**：在应用启动时加载 i18n

**任务**：
1. 修改 `packages/coding-agent/src/cli.ts`
   - 在 `runCli()` 开始时调用 `i18n.load()`
   - 确保在命令注册前加载翻译

**验收标准**：
- ✅ 启动时自动加载翻译
- ✅ 语言设置生效

**Subagent 配置**：
```
agent: code-implementer
task: "集成启动加载"
skills: typescript
```

---

### Phase 6: 同步工具（预计 2h）

**目标**：创建上游同步工具

**任务**：
1. 创建 `sync-and-patch.sh`
   - 从 `origin/main` 拉取更新
   - 应用 i18n patch
   - 处理冲突

2. 创建 patch 生成脚本
   - 从当前分支生成 patch
   - 存储到 `patches/zh/`

3. 编写 README
   - 同步流程说明
   - 翻译贡献指南

**验收标准**：
- ✅ 可以从上游同步
- ✅ 可以生成 patch
- ✅ 文档完整

**Subagent 配置**：
```
agent: code-implementer
task: "创建同步工具"
skills: bash, git
```

---

### Phase 7: 集成测试（预计 2h）

**目标**：端到端验证

**任务**：
1. 手动测试
   - 设置面板中文显示
   - 命令帮助中文显示
   - 语言切换流程

2. 修复发现的问题

**验收标准**：
- ✅ 完整的多语言流程可用
- ✅ 无阻塞性问题

**Subagent 配置**：
```
agent: code-implementer
task: "集成测试和修复"
skills: testing, debugging
```

---

## 时间估算

| Phase | 预计时间 | 依赖 |
|-------|---------|------|
| 1. i18n 核心 | 2h | - |
| 2. 设置集成 | 3h | Phase 1 |
| 3. 命令集成 | 2h | Phase 1 |
| 4. 翻译文件 | 4h | Phase 2, 3 |
| 5. 启动集成 | 1h | Phase 1 |
| 6. 同步工具 | 2h | - |
| 7. 集成测试 | 2h | All |
| **总计** | **16h** | |

## 风险与缓解

1. **风险**：Subagent 理解不足
   - **缓解**：提供详细的 Design Doc 和代码示例

2. **风险**：翻译文件过大导致子代理出错
   - **缓解**：按模块拆分，每次翻译一个文件

3. **风险**：与上游冲突
   - **缓解**：使用 patch 机制，定期同步

## 下一步

1. 创建 feature 分支 `feat/runtime-i18n`
2. 开始 Phase 1：i18n 核心模块
3. 使用 subagent 实施
