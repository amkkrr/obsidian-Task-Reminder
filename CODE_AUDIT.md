# 代码审计报告（/opt/obsidian-Task-Reminder）

- 审计对象：本仓库 `src/**`（含构建/发布相关脚本的必要交叉检查）
- 审计基线：`f4c8cef457eb845741c8a702e99c29d32ccf7552`（`feat: 实现 F4 周期任务生成功能 (v1.2.0)`）
- 审计日期：2026-02-03
- 审计方法：
  - 静态阅读关键路径（启动/弹窗/数据源/写入）
  - 构建验证：`npm run build`（通过）
  - 类型检查尝试：`npx tsc --noEmit`（失败：缺少 `tslib`，详见 P1-4）

## 结论摘要

插件主流程清晰：`onLayoutReady` 延迟触发提醒；支持命令强制弹窗；状态栏定时刷新 + 文件变更防抖刷新；数据源分层（Daily/Nike/Holiday/Recurring）通过 `TaskDataService` 聚合；F4 引入 `DailyNoteService` 写入日记。

当前实现的主要风险集中在 **F4 周期任务“展示/待生成/写入”链路的重复展示与路径校验缺失**：在默认配置不完整或配置偏离假设（Daily Note 路径、日记目录结构）时，可能出现“重复计数/重复展示/写入到意外位置或直接报错”的体验问题。

---

## 严重级别定义

- **P0**：高概率导致错误写入、重复生成、或明显错误体验；影响发布/验收。
- **P1**：重要可靠性/一致性问题；可能导致边界缺陷、性能问题或维护成本明显上升。
- **P2**：改进项；不影响主功能，但建议优化以提升稳定性/可维护性/可测试性。

---

## 发现清单（按严重度排序）

### P0-1 周期任务出现“重复展示/重复计数”的路径：Recurring 既作为任务又作为待生成

- 现象：
  - 弹窗中会同时展示：
    1) `TaskDataService.getTaskData()` 里的 `recurring` 任务（来源 `RecurringTaskSource.getTasks()`）
    2) `getPendingRecurringTasks()` 返回的“待生成”任务（来源 `RecurringTaskSource.getFullResult()`）
  - 但 `RecurringTaskSource.getTasks()` 当前**不区分**“已写入日记 vs 未写入日记”，导致“未写入”的周期任务也会进入 `result.tasks`，从而在 Modal 的“周期任务分组”和“待生成分组”里**重复出现**。
- 证据：
  - `src/main.ts:142-181`：同时拉取 `getTaskData()` + `getPendingRecurringTasks()` 并传入 `ReminderModal`。
  - `src/services/TaskDataService.ts:153-166`：`getTaskData()` 调用 `this.recurringSource.getTasks(dv)`。
  - `src/services/RecurringTaskSource.ts:54-74`：`getTasks()` 只跳过 `isCompleted`，未使用 `existsInDaily` 判定。
  - `src/services/RecurringTaskSource.ts:231-260`：`getFullResult()` 将 `existsInDaily=false` 的任务归入 `pendingTasks`。
- 影响：
  - 用户在弹窗中看到重复条目；计数（Notice/标题/状态栏）与“待生成数量”语义混乱。
  - 生成按钮的数量与已展示的“周期任务”数量不一致，容易误点/误解。
- 建议（推荐做法）：
  1) **让 Recurring 数据源只输出“已存在于 Daily Note 且未完成”的任务**；未写入的只出现在 pending 区域。
     - 实现上：`TaskDataService.getTaskData()` 对 recurring 分支改为调用 `getFullResult()` 并只合并 `result.tasks`；`pendingTasks` 直接复用同一结果，避免双次解析与重复 IO。
  2) 或者：保留 `getTasks()` 为“所有周期任务”，但在 UI 侧不再渲染“待生成”分组（与 F4 目标冲突，不推荐）。

### P0-2 F4 写入前缺少对 `dailyNotePath` 的硬校验，可能写入失败或写入到意外路径

- 现象：
  - F4 的写入路径由 `dailyNotePath + /YYYY/MM.MonthName/YYYY-MM-DD.md` 计算得出。
  - 当 `dailyNotePath` 为空或带尾随 `/`、或用户的日记目录结构不符合固定假设时：
    - 写入可能直接失败；
    - 或创建出用户不期望的目录结构（例如在 vault 根创建 `2026/02.February/...`）。
- 证据：
  - `src/services/DailyNoteService.ts:32-39`：`getDailyNotePath()` 直接拼接 `dailyNotePath`，不做空值/规范化处理。
  - `src/services/DailyNoteService.ts:51-57`：不存在则 `createDailyNote()`。
  - `src/services/DailyNoteService.ts:108-125`：`ensureFolderExists()` 依据 `folderPath.split('/')` 递归创建目录（未防御空片段）。
  - `src/main.ts:175-182` & `src/ui/ReminderModal.ts:85-103`：只要 `pendingRecurringTasks.length>0` 就暴露“生成”入口；当前链路不会因为 `dailyNotePath` 未配置而提前禁用按钮。
- 影响：
  - **错误写入风险**（创建意外文件夹/文件），或生成按钮点击后报错，体验差。
  - 与“用户必须配置 Daily Note 路径”的预期不一致。
- 建议：
  - 在写入前做强校验（建议在两处做）：
    1) `TaskDataService.getPendingRecurringTasks()` 或 `RecurringTaskSource.getFullResult()`：若 `dailyNotePath` 为空，直接返回空 `pendingTasks` 或附带可见错误（更友好：返回空并在设置页提示）。
    2) `DailyNoteService.writeRecurringTasks()`：若 `dailyNotePath` 为空/不合法，抛出带可读文案的 Error（例如“请先在设置中配置 Daily Note 路径”）。
  - 路径规范化：对 `dailyNotePath` 做 `trim()` + 去掉尾随 `/`，避免 `//`。

### P1-1 Daily 与 Recurring 的“单一事实来源（SSOT）/去重”未定义，导致同一条任务可能在不同来源重复计数

- 现象：
  - 当周期任务已经写入 Daily Note（形如 `- [ ] 🔄 xxx`）时：
    - `DailyTaskSource` 会把它作为普通 Daily task 收集；
    - Recurring 逻辑又把它作为 recurring task（或至少在未来目标中会这样做）展示。
- 证据：
  - `src/services/DailyTaskSource.ts:43-76`：没有过滤 `🔄` 前缀的任务。
  - `src/services/RecurringTaskSource.ts:241-252`：`existsInDaily=true` 时构造 `TaskItem`（source=recurring）。
- 影响：
  - 状态栏数量/Notice 数量偏大；用户看到重复条目。
- 建议：
  - 明确 SSOT（建议）：`🔄` 前缀任务归属 Recurring 源；Daily 源过滤掉 `🔄` 前缀（或反之只保留 Daily 源并移除 Recurring 源的“已存在任务”输出）。

### P1-2 “过期”判断使用 UTC 日期，存在时区偏差

- 证据：
  - `src/ui/ReminderModal.ts:163-166`：`new Date().toISOString().split('T')[0]`（UTC）。
- 影响：
  - 非 UTC 时区（例如美国时区）在本地晚间可能把“今天的任务”误判为过期（或相反）。
- 建议：
  - 使用 Obsidian 的 `moment()` 或本地日期来比对（例如 `moment().format('YYYY-MM-DD')`），并在 `dueDate` 非 ISO 时做容错。

### P1-3 生成写入采用“读全量 + 拼接 + modify”，存在并发覆盖风险，且缺少二次去重兜底

- 证据：
  - `src/services/DailyNoteService.ts:63-77`：读出全文后追加并 `vault.modify` 回写。
  - `src/services/DailyNoteService.ts:67-74`：不检查内容是否已包含同名任务。
- 影响：
  - 若用户或其他插件在生成时同时修改 Daily Note，存在覆盖/丢失最新编辑的概率。
  - 若 `pendingRecurringTasks` 计算与实际内容不同步（或配置有重复行），可能写入重复任务。
- 建议：
  - 优先使用 `vault.append()`（若 Obsidian API 可用）或在写入前重新读取并二次确认“不存在同名 `🔄` 任务”。
  - 对输入 `tasks` 做 `Set` 去重（按 `name`）。
  - 将写入块放在固定锚点（例如 `## Recurring` 下）可减少文档污染（可选）。

### P1-4 缺少 TypeScript 类型检查通路：`tsc --noEmit` 失败（缺少 `tslib`）

- 证据：
  - `tsconfig.json` 启用 `importHelpers: true`，但依赖中未包含 `tslib`。
  - `npx tsc --noEmit` 报错：`TS2354: ... module 'tslib' cannot be found.`
- 影响：
  - 当前构建仅靠 esbuild 转译，隐藏大量潜在类型错误（例如 `string.contains`）；
  - 后续引入 CI/发布检查时容易“突然失败”。
- 建议：
  - 二选一：
    1) 添加 `tslib` 依赖并在 CI 加 `tsc --noEmit`；
    2) 关闭 `importHelpers`（并仍建议加 `tsc --noEmit` 作为质量闸门）。

### P1-5 设置页自动补全使用非标准 `String.prototype.contains`，可能在运行时崩溃

- 证据：
  - `src/settings.ts:82`、`src/settings.ts:125`：`toLowerCase().contains(...)`。
- 影响：
  - 若宿主环境未 polyfill `contains`，打开设置页输入时会抛异常，导致建议器与设置页交互异常。
- 建议：
  - 改用标准 `includes()`；并对空输入做快速返回（减少遍历成本）。

### P2-1 Recurring 相关逻辑存在重复 IO/重复计算

- 证据：
  - `src/services/TaskDataService.ts:153-166`（`getTasks`）与 `src/services/TaskDataService.ts:188-205`（`getFullResult`）会在一次弹窗触发中重复：
    - 读取周期配置文件；
    - 读取/解析当日日记文件；
    - 过滤今日任务。
- 影响：
  - 大 vault 或慢磁盘下，弹窗打开耗时增加；且可能产生短暂不一致（两次读取之间文件变化）。
- 建议：
  - 合并为一次调用（见 P0-1 的推荐方案）。

### P2-2 事件触发范围较粗：任意文件 modify 都会触发缓存失效与状态栏刷新

- 证据：
  - `src/main.ts:81-83` + `src/main.ts:93-97`：vault 任意 `modify` → 500ms 后 invalidateCache + updateStatusBar。
- 影响：
  - 编辑频繁时可能造成 Dataview 查询频繁执行，影响性能。
- 建议：
  - 仅在修改的路径落在已配置的数据源目录时才刷新；或将“modify→刷新”改为更低频的合并策略。

### P2-3 一些小的可维护性问题

- 未使用参数/导入：
  - `src/services/RecurringTaskSource.ts:32`、`src/services/RecurringTaskSource.ts:208` 的 `dv` 未使用；
  - `src/services/TaskDataService.ts:6` 的 `moment`、`src/services/TaskDataService.ts:8` 的 `SOURCE_LABELS` 未使用。
- 版本发布辅助文件未完全对齐：
  - `manifest.json`/`package.json` 已是 `1.2.0`，但 `versions.json` 未包含 `1.2.0`（`version-bump.mjs` 预期会写入）。

---

## 建议的最小回归测试清单（手工）

1. Dataview 未安装：打开设置页、状态栏、命令触发，均应有可理解提示且不抛异常。
2. `dailyNotePath` 为空：弹窗不应出现“生成到 Daily Note”入口；或点击后给出明确错误（不创建任何文件/文件夹）。
3. Recurring：
   - 配置中存在今日任务且日记未包含 → 只出现在“待生成”区域（不在周期任务分组重复出现）。
   - 点击生成后：日记文件被创建/追加；再次打开弹窗 → 待生成数量归零；周期任务展示不重复。
4. Overdue 判断：在本地晚间/跨时区环境下不应把“今天”误标过期。

