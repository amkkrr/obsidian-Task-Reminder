# Task Reminder Plugin 规格书

> **文档版本**: 2026-02-04-b
> **创建日期**: 2026-02-03
> **最后更新**: 2026-02-04
> **代码版本**: v1.2.0（manifest.json）
> **状态**: ✅ v1.3.0 已实现 (F5/F6) | 🔲 F7 待实现

---

## 修订记录

| 文档版本 | 日期 | 变更说明 | 对应代码版本 |
|---------|------|----------|-------------|
| 2026-02-03-a | 2026-02-03 | 初始草案 + 审计修订 | - |
| 2026-02-03-b | 2026-02-03 | M1-M4 实现，移动端支持，正式发布 | v1.1.0 ✅ |
| 2026-02-03-c | 2026-02-03 | 规划 F4 周期任务生成功能 | v1.2.0 🔲 |
| 2026-02-03-d | 2026-02-03 | 实现 F4 周期任务生成功能 | v1.2.0 ✅ |
| 2026-02-04-a | 2026-02-04 | 规划 F5 快速添加 Todo + F6 移动任务日期 | v1.3.0 🔲 |
| 2026-02-04-b | 2026-02-04 | 审计修订：F5/F6 合规声明、回滚语义、移动端适配、配置项闭环 | v1.3.0 ✅ |
| 2026-02-04-c | 2026-02-04 | 规划 F7 Daily Note 模板支持（独立文档） | v1.4.0 🔲 |

---

## 1. 概述

### 1.1 项目背景

当前任务提醒逻辑嵌入在 `首页任务列表测试.md` 的 dataviewjs 代码块中（第43-133行），存在以下问题：

| 问题 | 影响 |
|------|------|
| 依赖 `window` 全局变量防抖 | 多页面竞态条件，不可靠 |
| 硬编码配置 | 无法通过 UI 调整参数 |
| 与数据展示耦合 | 维护困难，职责不清 |
| MutationObserver 监听状态栏 | 脆弱，依赖 DOM 结构 |

### 1.2 目标

将提醒逻辑抽离为独立的 Obsidian 原生插件，实现：

- ✅ 可靠的单次弹窗机制（基于 Obsidian 生命周期）
- ✅ 可视化配置面板
- ✅ 命令面板手动触发
- ✅ 与现有 dataviewjs 脚本解耦
- ✅ 符合社区插件审核标准

### 1.3 命名

- **插件 ID**: `task-reminder`
- **显示名称**: Task Reminder（任务提醒）
- **描述**: Displays a daily task reminder popup when Obsidian starts, showing pending tasks from Daily Notes and custom sources.

---

## 2. 功能需求

### 2.1 核心功能

#### F1: 启动时自动提醒

- **触发时机**: Obsidian 布局就绪后（`onLayoutReady`）
- **延迟机制**: 可配置延迟时间（默认 30 秒），等待同步完成
- **防重复**: 每日每 vault 只弹一次，基于插件数据存储（非 localStorage）
- **弹窗内容**:
  - 今日待办任务列表
  - 来源标签（📅 Daily / 👟 Nike / 🎉 Holiday / 🔄 周期）
  - 会议任务高亮显示（通过 `#meeting` 标签识别）
  - **可点击跳转**：点击任务打开原文件并定位到任务行

#### F2: 手动触发命令

- **命令名称**: `Show today's task reminder`
- **快捷键**: 用户可自定义
- **行为**: 忽略"已弹过"状态，强制显示当前任务
- **注意**: 手动触发**不会**写入"已弹过"标记

#### F3: 状态栏指示器

- 显示今日待办数量（如 `📋 5`）
- 点击打开提醒弹窗
- **刷新策略**: 启动时 + 每 5 分钟 + 文件变更后 debounce（500ms）
- 仅桌面端显示

#### F4: 周期任务生成（✅ 已实现 - v1.2.0）

> 此功能已实现，支持写入 Daily Note 文件。

- **触发方式**: 弹窗底部「生成到 Daily Note」按钮
- **显示条件**: 存在待生成的周期任务（未写入 Daily Note）
- **生成逻辑**:
  1. 检测今日应触发的周期任务（daily/weekly/monthly）
  2. 检查 Daily Note 中是否已存在（通过 `🔄` 前缀识别）
  3. 未存在的任务显示在"待生成"区域
  4. 点击按钮追加到 Daily Note 末尾
- **任务格式**: `- [ ] 🔄 任务名称`
- **Daily Note 自动创建**: 若文件不存在，自动创建（含基础 frontmatter）

#### F5: 快速添加 Todo（🔲 待实现 - v1.3.0）

> 通过命令或按钮快速创建任务，选择目标日期后写入对应 Daily Note。

- **触发方式**:
  1. 命令面板: `Quick add todo`（桌面端/移动端通用）
  2. 侧边栏 Ribbon 按钮: ➕ 图标（桌面端/移动端通用）
- **移动端适配**:
  - 命令面板为主要入口（替代桌面端快捷键）
  - Ribbon 按钮在移动端侧边栏可用
- **交互流程**:
  1. 弹出 `QuickAddModal`，包含任务输入框
  2. 输入任务内容后，点击「选择日期」或按 Enter
  3. 弹出 `DatePickerModal`（共享组件），选择目标日期
  4. 确认后写入对应日期的 Daily Note
- **任务格式**: `- [ ] 任务内容`
- **特性**:
  - 支持连续添加（添加后不关闭弹窗，可继续添加）
  - 支持快捷键 `Ctrl/Cmd + Enter` 快速添加到今天
  - 空内容时禁用提交按钮
- **Daily Note 自动创建**: 若目标日期文件不存在，自动创建

#### F6: 移动任务日期（🔲 待实现 - v1.3.0）

> 将任务从当前 Daily Note 移动到其他日期的 Daily Note。

- **触发方式**:
  | 平台 | 交互方式 |
  |------|---------|
  | 桌面端 | 右键菜单「移动到...」或点击 📅 图标按钮 |
  | 移动端 | 长按任务项弹出菜单「移动到...」或点击 📅 图标按钮 |
- **移动端适配**:
  - 长按手势替代右键菜单（`touchstart` + 500ms 延迟触发）
  - 📅 图标按钮为主要交互方式（触控友好）
- **适用范围**: 仅限 Daily Note 来源的任务（`source: 'daily'`）
- **交互流程**:
  1. 点击移动按钮/菜单
  2. 弹出 `DatePickerModal`（共享组件）
  3. 选择目标日期
  4. 从原文件删除任务行，追加到目标文件
- **移动逻辑**:
  1. 读取原文件，定位任务行（通过 `line` 属性）
  2. 删除原任务行（保留空行处理）
  3. 读取/创建目标日期 Daily Note
  4. 追加任务到目标文件末尾
- **安全机制**:
  - 移动前确认对话框（可在设置中关闭）
  - **一致性保证（Write-Then-Delete）**:
    1. 先写入目标文件（若失败，抛出异常，原文件不变）
    2. 写入成功后，再删除源文件中的任务行
    3. 若删除失败，任务将在两个文件中重复存在（用户可手动清理）
  - **故障场景处理**:
    | 场景 | 结果 | 用户操作 |
    |------|------|---------|
    | 目标写入失败 | 原任务保留，无副作用 | 重试或检查目标路径 |
    | 目标写入成功 + 源删除失败 | 任务重复 | 手动删除源文件中的任务 |
    | 两步均成功 | 任务已移动 | 无需操作 |
- **限制**:
  - Nike/Holiday/Recurring 来源任务不支持移动（显示提示）
  - 不能移动到过去日期（可配置）

#### F7: Daily Note 模板支持（🔲 待实现 - v1.4.0）

> 详见 [docs/features/F7-daily-note-template.md](./docs/features/F7-daily-note-template.md)

- **概要**: 创建 Daily Note 时使用用户指定的模板文件
- **触发场景**: F4/F5/F6 需要创建新 Daily Note 时
- **配置项**: `dailyNoteTemplatePath` - 模板文件路径
- **模板变量**: `{{date}}`, `{{date:format}}`, `{{day}}`, `{{day:zh}}`, `{{time}}`, `{{title}}`
- **向后兼容**: 未配置时使用默认模板，模板不存在时降级

#### 共享组件: DatePickerModal

> F5 和 F6 共用的日期选择弹窗。

- **移动端可用性约束**:
  | 约束 | 实现方式 |
  |------|---------|
  | 触控目标尺寸 | 所有可点击元素 ≥ 44×44px（Apple HIG 标准） |
  | 安全区适配 | 使用 `env(safe-area-inset-*)` CSS 变量 |
  | 键盘遮挡处理 | 输入框聚焦时自动滚动弹窗，避免被软键盘遮挡 |
  | 手势支持 | 日历支持左右滑动切换月份 |

- **快捷选项**（按钮形式）:
  | 选项 | 计算逻辑 |
  |------|---------|
  | 今天 | `moment()` |
  | 明天 | `moment().add(1, 'day')` |
  | 后天 | `moment().add(2, 'days')` |
  | 下周一 | `moment().day(8)` (下周一) |
  | 下周末 | `moment().day(13)` (下周六) |

- **日历选择器**:
  - 显示当前月份日历网格
  - 可切换上/下月
  - 今天高亮显示
  - 已选日期标记
  - 过去日期灰显（可配置是否可选）

- **输入框**:
  - 支持直接输入日期（YYYY-MM-DD 格式）
  - 支持相对日期（如 `+3` 表示 3 天后）

- **回调接口**:
  ```typescript
  interface DatePickerOptions {
    initialDate?: moment.Moment;      // 初始选中日期
    allowPastDates?: boolean;         // 是否允许选择过去日期
    title?: string;                   // 弹窗标题
    onSelect: (date: moment.Moment) => void;  // 选择回调
    onCancel?: () => void;            // 取消回调
  }
  ```

### 2.2 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用自动提醒 |
| `popupDelay` | number | `30000` | 启动后延迟弹窗时间（毫秒） |
| `popupDuration` | number | `8000` | Notice 通知显示时长（毫秒） |
| `reminderStyle` | enum | `'both'` | 提醒样式：`'both'` / `'notice'` / `'modal'` |
| `showStatusBar` | boolean | `true` | 是否显示状态栏指示器 |
| `taskSources.daily` | boolean | `true` | 是否包含 Daily Note 任务 |
| `taskSources.nike` | boolean | `true` | 是否包含 Nike 项目任务 |
| `taskSources.holiday` | boolean | `true` | 是否包含节假日任务 |
| `taskSources.recurring` | boolean | `true` | 是否包含周期任务 |
| `dailyNotePath` | string | `""` | Daily Note 文件夹路径（需用户配置） |
| `nikePath` | string | `""` | Nike 日历文件夹路径（需用户配置） |
| `recurringConfigPath` | string | `""` | 周期任务配置文件路径（需用户配置） |
| `confirmBeforeMove` | boolean | `true` | 移动任务前显示确认对话框 |
| `allowMoveToPast` | boolean | `false` | 是否允许移动任务到过去日期 |

**F6 配置项设置 UI 映射**:

| 配置项 | 设置界面位置 | UI 控件 | 说明文案 |
|--------|-------------|---------|---------|
| `confirmBeforeMove` | 任务移动设置 | Toggle 开关 | "移动前确认：移动任务到其他日期前显示确认对话框" |
| `allowMoveToPast` | 任务移动设置 | Toggle 开关 | "允许移动到过去：允许将任务移动到过去的日期" |

### 2.3 "已弹过"状态存储

- **存储位置**: 插件数据文件（`data.json`）
- **Key 格式**: `lastReminderDate: "YYYY-MM-DD"`
- **粒度**: 每 vault 独立（插件数据天然隔离）
- **跨设备同步**: **不同步**（每设备独立判断）
- **语义**: 有任务才弹窗、才记录；无任务不记录，下次启动仍会检查

---

## 3. 数据源合同（Data Contracts）

> 根据现有 `task-utils.js` 和 `recurring-task-manager.js` 提取

### 3.1 Daily Note 任务

**来源定义**:
```
路径: {dailyNotePath}/{YYYY}/{MM.MonthName}/{YYYY-MM-DD}.md
示例: 00 - Daily Plan/2026/02.February/2026-02-03.md
```

**查询规则**:
```typescript
// Dataview 查询
dv.pages('"dailyNotePath"')
  .file.tasks
  .where(t => !t.completed && !t.checked)
```

**筛选条件**:
- `!t.completed && !t.checked` - 未完成任务
- 文件日期 ≤ 今天（包含过期任务）

**输出字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | string | 任务文本 |
| `tags` | string[] | 任务标签（用于识别 meeting） |
| `link` | Link | 来源文件链接 |
| `line` | number | 任务所在行号 |
| `path` | string | 文件路径 |

**Meeting 识别规则**:
```typescript
const isMeeting = task.tags.some(tag =>
  tag.toLowerCase().includes("meeting")
);
// 匹配: #meeting, #Meeting, #team-meeting 等
```

**示例**:
```markdown
// 文件: 00 - Daily Plan/2026/02.February/2026-02-03.md
- [ ] 完成规格书审计 #work
- [ ] 10:00 团队周会 #meeting
- [x] 已完成的任务（不会显示）
```

### 3.2 Nike 项目任务

**来源定义**:
```
路径: {nikePath}/**/events/**/*.md
示例: 03 - Working/01.Nike/03.Nike Calendar/2026/events/Launch-Event.md
```

**查询规则**:
```typescript
dv.pages('"nikePath"')
  .where(p => {
    const pathParts = p.file.folder.split('/');
    return pathParts.some(part => part.toLowerCase() === 'events');
  })
  .where(p => p.Done !== true)  // Done 不存在或不为 true
```

**Frontmatter 要求**:
```yaml
---
Due Date: 2026-02-03
Done: false  # 可选字段：不存在、false、或任何非 true 值均视为未完成
---
```

**筛选条件**:
- 文件夹路径包含 `events`
- `Done` 字段不为 `true`（不存在、false、其他值均视为未完成）
- `Due Date` ≤ 今天

**输出字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `fileName` | string | 文件名（不含 .md） |
| `dueDate` | string | 格式化日期 YYYY-MM-DD |
| `link` | Link | 文件链接 |

### 3.3 Holiday 任务

**来源定义**:
```
任意位置，通过标签或 frontmatter 识别
```

**查询规则**:
```typescript
dv.pages()
  .where(p =>
    p.file.tags?.includes("#holiday") ||
    p.type === "holiday" ||
    (Array.isArray(p.type) && p.type.includes("holiday"))
  )
```

**识别条件（满足任一）**:
1. 文件包含 `#holiday` 标签
2. Frontmatter `type: holiday`
3. Frontmatter `type` 数组包含 `"holiday"`

**日期解析优先级**:
1. `p.date` frontmatter 字段
2. `p.file.day`（如果使用 Daily Notes 格式）
3. `p.file.name`（尝试解析文件名为日期）

**筛选条件**:
- 日期 = 今天（不含过期）

**输出字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `fileName` | string | 节日名称 |
| `dueDate` | string | 日期 YYYY-MM-DD |
| `link` | Link | 文件链接 |

### 3.4 周期任务（Recurring）

**配置文件格式**:
```
路径: {recurringConfigPath}
示例: 06 - DATA FILE/recurring-tasks.md
```

**配置表格式**:
```markdown
| 任务名称 | 类型 | 触发条件 | 模式 |
|---------|------|---------|------|
| 晨间日记 | daily | - | replace |
| 周报 | weekly | 5 | accumulate |
| 月度复盘 | monthly | 1 | skip |
| 季度总结 | monthly | 1 (3,6,9,12) | replace |
```

**类型说明**:
| 类型 | 触发条件格式 | 说明 |
|------|-------------|------|
| `daily` | `-` | 每天触发 |
| `weekly` | `1-7` | 周几触发（1=周一，7=周日） |
| `monthly` | `1-31` 或 `1 (3,6,9,12)` | 每月几号，可选指定月份 |

**查询逻辑**:
```typescript
// 判断今日是否应显示
if (type === "daily") return true;
if (type === "weekly" && parseInt(trigger) === moment().isoWeekday()) return true;
if (type === "monthly") {
  const [day, months] = parseTrigger(trigger);
  if (parseInt(day) === moment().date()) {
    return !months || months.includes(moment().month() + 1);
  }
}
```

**Daily Note 中的周期任务格式**:
```markdown
- [ ] 🔄 晨间日记
- [x] 🔄 已完成的周期任务
```

**去重规则（SSOT: Daily Note 为准）**:
1. 周期任务配置文件定义「应显示」的任务
2. Daily Note 中的 `🔄` 前缀任务为「已生成」任务
3. 弹窗显示逻辑：
   - 已生成且未完成 → 显示在任务列表，标记来源 `🔄 周期`
   - 已生成且已完成 → 不显示
   - 未生成（仅在配置中） → 显示在「待生成」区域（F4 功能）
4. 任务计数：仅统计 Daily Note 中未完成的周期任务

**输出字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `fileName` | string | 任务名称 |
| `type` | string | daily/weekly/monthly |
| `existsInDaily` | boolean | 是否已在日记中 |
| `isCompleted` | boolean | 是否已完成 |

---

## 4. 技术设计

### 4.1 开发环境

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18.x | 运行时 |
| TypeScript | ≥ 5.0 | 类型安全 |
| [generator-obsidian-plugin](https://github.com/mnaoumov/generator-obsidian-plugin) | latest | 推荐模板 |
| [obsidian-dev-utils](https://github.com/mnaoumov/obsidian-dev-utils) | latest | 开发工具包 |
| esbuild | latest | 打包工具 |

### 4.2 项目结构

```
task-reminder/
├── src/
│   ├── main.ts                 # 插件入口
│   ├── settings.ts             # 设置定义与 UI
│   ├── services/
│   │   ├── TaskDataService.ts  # 数据获取服务（统一接口）
│   │   ├── DailyTaskSource.ts  # Daily Note 数据源
│   │   ├── NikeTaskSource.ts   # Nike 项目数据源
│   │   ├── HolidayTaskSource.ts # Holiday 数据源
│   │   ├── RecurringTaskSource.ts # 周期任务数据源
│   │   ├── DailyNoteService.ts # Daily Note 读写服务
│   │   └── TaskMoveService.ts  # 任务移动服务（F6）
│   ├── ui/
│   │   ├── ReminderModal.ts    # 提醒弹窗
│   │   ├── StatusBarItem.ts    # 状态栏组件
│   │   ├── QuickAddModal.ts    # 快速添加弹窗（F5）
│   │   └── DatePickerModal.ts  # 日期选择弹窗（共享）
│   └── types.ts                # 类型定义
├── styles.css                  # 样式文件
├── manifest.json               # 插件清单
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

### 4.3 依赖关系

#### Dataview 依赖

- **依赖类型**: **强依赖**
- **检测方式**: `app.plugins.plugins.dataview?.api`
- **缺失行为**:
  1. 插件正常加载（不影响 Obsidian 启动）
  2. 设置页显示警告："⚠️ 需要安装并启用 Dataview 插件"
  3. 提醒功能禁用，状态栏显示 `📋 ?`
  4. 手动触发命令显示提示："请先安装 Dataview 插件"

```typescript
private checkDataviewReady(): boolean {
  const dv = this.app.plugins.plugins.dataview?.api;
  if (!dv) {
    new Notice("Task Reminder: 需要 Dataview 插件支持", 5000);
    return false;
  }
  return true;
}
```

### 4.4 核心接口设计

#### 4.4.1 TaskDataService

```typescript
// src/services/TaskDataService.ts
export interface TaskDataService {
  /**
   * 获取今日所有任务
   * @returns Promise<TaskItem[]> 任务列表
   */
  getTodayTasks(): Promise<TaskItem[]>;

  /**
   * 获取今日任务数量
   * @returns Promise<number> 任务数量
   */
  getTaskCount(): Promise<number>;

  /**
   * 获取完整数据结果（含分类统计）
   * @returns Promise<TaskDataResult>
   */
  getTaskData(): Promise<TaskDataResult>;
}

// 缓存策略
interface CacheConfig {
  ttl: 60000;  // 60秒缓存
  invalidateOn: ['file-change', 'settings-change'];
}
```

#### 4.4.2 类型定义

```typescript
// src/types.ts
export interface TaskItem {
  id: string;           // 唯一标识（path:line）
  source: 'daily' | 'nike' | 'holiday' | 'recurring';
  sourceLabel: string;  // 显示标签如 "📅 Daily"
  text: string;         // 任务文本（截断后，max 60 chars）
  fullText: string;     // 完整文本
  isMeeting: boolean;   // 是否为会议（通过 #meeting 标签）
  filePath: string;     // 来源文件路径
  line?: number;        // 任务所在行号（用于跳转）
  dueDate?: string;     // 截止日期
}

export interface TaskDataResult {
  tasks: TaskItem[];
  dailyCount: number;
  nikeCount: number;
  holidayCount: number;
  recurringCount: number;
  errors: TaskSourceError[];  // 各数据源的错误信息
}

export interface TaskSourceError {
  source: string;
  message: string;
  recoverable: boolean;
}

/** F5/F6 新增类型 */
export interface QuickAddResult {
  content: string;        // 任务内容
  targetDate: moment.Moment;  // 目标日期
}

export interface TaskMoveResult {
  success: boolean;
  fromPath: string;       // 原文件路径
  toPath: string;         // 目标文件路径
  taskText: string;       // 任务文本
}

export interface DatePickerOptions {
  initialDate?: moment.Moment;      // 初始选中日期，默认今天
  allowPastDates?: boolean;         // 是否允许选择过去日期，默认 false
  title?: string;                   // 弹窗标题
  onSelect: (date: moment.Moment) => void;  // 选择回调
  onCancel?: () => void;            // 取消回调
}
```

#### 4.4.3 QuickAddModal（F5）

```typescript
// src/ui/QuickAddModal.ts
import { App, Modal, Notice, moment } from 'obsidian';
import { DatePickerModal } from './DatePickerModal';
import { DailyNoteService } from '../services/DailyNoteService';

export class QuickAddModal extends Modal {
  private dailyNoteService: DailyNoteService;
  private inputEl: HTMLInputElement;

  constructor(app: App, dailyNoteService: DailyNoteService) {
    super(app);
    this.dailyNoteService = dailyNoteService;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText('➕ 快速添加 Todo');

    // 输入框
    const inputContainer = contentEl.createDiv({ cls: 'quick-add-input-container' });
    this.inputEl = inputContainer.createEl('input', {
      type: 'text',
      placeholder: '输入任务内容...',
      cls: 'quick-add-input'
    });
    this.inputEl.focus();

    // 快捷键支持
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd + Enter: 添加到今天
          this.addToDate(moment());
        } else {
          // Enter: 打开日期选择
          this.openDatePicker();
        }
      }
    });

    // 按钮区域
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const todayBtn = btnContainer.createEl('button', { text: '📅 今天' });
    todayBtn.addEventListener('click', () => this.addToDate(moment()));

    const pickDateBtn = btnContainer.createEl('button', { text: '🗓️ 选择日期...' });
    pickDateBtn.addClass('mod-cta');
    pickDateBtn.addEventListener('click', () => this.openDatePicker());
  }

  private openDatePicker() {
    const content = this.inputEl.value.trim();
    if (!content) {
      new Notice('请输入任务内容');
      return;
    }

    new DatePickerModal(this.app, {
      title: '选择目标日期',
      onSelect: (date) => this.addToDate(date),
    }).open();
  }

  private async addToDate(date: moment.Moment) {
    const content = this.inputEl.value.trim();
    if (!content) {
      new Notice('请输入任务内容');
      return;
    }

    try {
      await this.dailyNoteService.writeTask(content, date);
      new Notice(`✅ 已添加到 ${date.format('YYYY-MM-DD')}`);
      this.inputEl.value = '';  // 清空输入，支持连续添加
      this.inputEl.focus();
    } catch (e) {
      new Notice(`❌ 添加失败: ${(e as Error).message}`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
```

#### 4.4.4 DatePickerModal（共享组件）

```typescript
// src/ui/DatePickerModal.ts
import { App, Modal, moment } from 'obsidian';
import { DatePickerOptions } from '../types';

export class DatePickerModal extends Modal {
  private options: DatePickerOptions;
  private selectedDate: moment.Moment;
  private currentMonth: moment.Moment;

  constructor(app: App, options: DatePickerOptions) {
    super(app);
    this.options = options;
    this.selectedDate = options.initialDate || moment();
    this.currentMonth = moment(this.selectedDate);
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.options.title || '选择日期');

    // 快捷选项
    const quickOptions = contentEl.createDiv({ cls: 'date-picker-quick-options' });
    const shortcuts = [
      { label: '今天', date: moment() },
      { label: '明天', date: moment().add(1, 'day') },
      { label: '后天', date: moment().add(2, 'days') },
      { label: '下周一', date: moment().day(8) },
      { label: '下周六', date: moment().day(13) },
    ];

    for (const shortcut of shortcuts) {
      const btn = quickOptions.createEl('button', { text: shortcut.label });
      btn.addEventListener('click', () => this.selectDate(shortcut.date));
    }

    // 日历网格
    const calendarContainer = contentEl.createDiv({ cls: 'date-picker-calendar' });
    this.renderCalendar(calendarContainer);

    // 输入框（相对日期）
    const inputContainer = contentEl.createDiv({ cls: 'date-picker-input' });
    const input = inputContainer.createEl('input', {
      type: 'text',
      placeholder: '+3 或 2026-02-10'
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const parsed = this.parseInput(input.value);
        if (parsed) this.selectDate(parsed);
      }
    });

    // 取消按钮
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancelBtn = btnContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => {
      this.options.onCancel?.();
      this.close();
    });
  }

  private renderCalendar(container: HTMLElement) {
    container.empty();

    // 月份导航
    const nav = container.createDiv({ cls: 'calendar-nav' });
    const prevBtn = nav.createEl('button', { text: '◀' });
    prevBtn.addEventListener('click', () => {
      this.currentMonth.subtract(1, 'month');
      this.renderCalendar(container);
    });

    const monthLabel = nav.createSpan({ cls: 'calendar-month-label' });
    monthLabel.setText(this.currentMonth.format('YYYY年 M月'));

    const nextBtn = nav.createEl('button', { text: '▶' });
    nextBtn.addEventListener('click', () => {
      this.currentMonth.add(1, 'month');
      this.renderCalendar(container);
    });

    // 星期标题
    const weekHeader = container.createDiv({ cls: 'calendar-week-header' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach(d => {
      weekHeader.createSpan({ text: d });
    });

    // 日期网格
    const grid = container.createDiv({ cls: 'calendar-grid' });
    const startOfMonth = moment(this.currentMonth).startOf('month');
    const endOfMonth = moment(this.currentMonth).endOf('month');
    const startDay = startOfMonth.isoWeekday();  // 1=周一, 7=周日

    // 填充前置空白
    for (let i = 1; i < startDay; i++) {
      grid.createDiv({ cls: 'calendar-day empty' });
    }

    // 日期
    const today = moment().format('YYYY-MM-DD');
    for (let d = 1; d <= endOfMonth.date(); d++) {
      const date = moment(this.currentMonth).date(d);
      const dateStr = date.format('YYYY-MM-DD');
      const dayEl = grid.createDiv({ cls: 'calendar-day', text: String(d) });

      if (dateStr === today) dayEl.addClass('is-today');
      if (dateStr === this.selectedDate.format('YYYY-MM-DD')) dayEl.addClass('is-selected');
      if (dateStr < today && !this.options.allowPastDates) {
        dayEl.addClass('is-past');
      } else {
        dayEl.addEventListener('click', () => this.selectDate(date));
      }
    }
  }

  private parseInput(value: string): moment.Moment | null {
    value = value.trim();
    if (value.startsWith('+')) {
      const days = parseInt(value.slice(1), 10);
      if (!isNaN(days)) return moment().add(days, 'days');
    }
    const parsed = moment(value, 'YYYY-MM-DD', true);
    if (parsed.isValid()) return parsed;
    return null;
  }

  private selectDate(date: moment.Moment) {
    this.options.onSelect(date);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
```

#### 4.4.5 TaskMoveService（F6）

```typescript
// src/services/TaskMoveService.ts
import { App, TFile, moment } from 'obsidian';
import { TaskItem, TaskMoveResult } from '../types';
import { DailyNoteService } from './DailyNoteService';

export class TaskMoveService {
  private app: App;
  private dailyNoteService: DailyNoteService;

  constructor(app: App, dailyNoteService: DailyNoteService) {
    this.app = app;
    this.dailyNoteService = dailyNoteService;
  }

  /**
   * 移动任务到目标日期
   * @param task 要移动的任务
   * @param targetDate 目标日期
   */
  async moveTask(task: TaskItem, targetDate: moment.Moment): Promise<TaskMoveResult> {
    // 验证：仅支持 daily 来源
    if (task.source !== 'daily') {
      throw new Error('仅支持移动 Daily Note 中的任务');
    }

    if (task.line === undefined) {
      throw new Error('任务行号信息缺失');
    }

    const fromPath = task.filePath;
    const toPath = this.dailyNoteService.getDailyNotePathForDate(targetDate);

    // 1. 读取原文件
    const fromFile = this.app.vault.getAbstractFileByPath(fromPath);
    if (!(fromFile instanceof TFile)) {
      throw new Error(`原文件不存在: ${fromPath}`);
    }
    const fromContent = await this.app.vault.read(fromFile);
    const lines = fromContent.split('\n');

    // 2. 获取任务行
    if (task.line >= lines.length) {
      throw new Error('任务行号超出文件范围');
    }
    const taskLine = lines[task.line];

    // 3. 写入目标文件（先写入，确保成功后再删除）
    await this.dailyNoteService.writeTaskLine(taskLine, targetDate);

    // 4. 从原文件删除任务行
    lines.splice(task.line, 1);
    await this.app.vault.modify(fromFile, lines.join('\n'));

    return {
      success: true,
      fromPath,
      toPath,
      taskText: task.fullText
    };
  }
}
```

### 4.5 主插件类

```typescript
// src/main.ts
import { Plugin, moment } from 'obsidian';
import { TaskReminderSettings, DEFAULT_SETTINGS, TaskReminderSettingTab } from './settings';
import { TaskDataService } from './services/TaskDataService';
import { ReminderModal } from './ui/ReminderModal';

export default class TaskReminderPlugin extends Plugin {
  settings: TaskReminderSettings;
  private dataService: TaskDataService;
  private statusBarItem: HTMLElement | null = null;
  private refreshDebounceTimer: number | null = null;

  async onload() {
    await this.loadSettings();

    // 注册设置面板
    this.addSettingTab(new TaskReminderSettingTab(this.app, this));

    // 初始化数据服务
    this.dataService = new TaskDataService(this.app, this.settings);

    // 注册命令
    this.addCommand({
      id: 'show-task-reminder',
      name: 'Show today\'s task reminder',
      callback: () => this.showReminder(true) // force = true, 不写入已弹过标记
    });

    // 状态栏（仅桌面端）
    if (this.settings.showStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
      this.statusBarItem.addClass('task-reminder-status');
      this.statusBarItem.onClickEvent(() => this.showReminder(true));
      this.updateStatusBar();

      // 定期刷新（每 5 分钟）
      this.registerInterval(
        window.setInterval(() => this.updateStatusBar(), 5 * 60 * 1000)
      );

      // 文件变更刷新（debounce 500ms）
      this.registerEvent(
        this.app.vault.on('modify', () => this.debouncedRefresh())
      );
    }

    // 布局就绪后调度提醒
    this.app.workspace.onLayoutReady(() => {
      this.scheduleReminder();
    });
  }

  private debouncedRefresh() {
    if (this.refreshDebounceTimer) {
      window.clearTimeout(this.refreshDebounceTimer);
    }
    this.refreshDebounceTimer = window.setTimeout(() => {
      this.updateStatusBar();
    }, 500);
  }

  private scheduleReminder() {
    if (!this.settings.enabled) return;

    // 检查今日是否已弹过（从插件数据读取）
    const todayStr = moment().format('YYYY-MM-DD');
    if (this.settings.lastReminderDate === todayStr) {
      return;
    }

    // 延迟弹窗
    window.setTimeout(() => {
      this.showReminder(false);
    }, this.settings.popupDelay);
  }

  async showReminder(force: boolean) {
    // 检查 Dataview
    if (!this.checkDataviewReady()) return;

    const result = await this.dataService.getTaskData();

    // 显示错误提示（如有）
    result.errors.forEach(err => {
      if (!err.recoverable) {
        new Notice(`Task Reminder: ${err.source} - ${err.message}`, 5000);
      }
    });

    if (result.tasks.length > 0) {
      // 仅在非强制模式下记录"已弹过"
      if (!force) {
        this.settings.lastReminderDate = moment().format('YYYY-MM-DD');
        await this.saveSettings();
      }

      // 根据设置显示 Notice 和/或 Modal
      if (this.settings.reminderStyle === 'both' || this.settings.reminderStyle === 'notice') {
        new Notice(`⏰ 今日有 ${result.tasks.length} 个待办任务!`, this.settings.popupDuration);
      }

      if (this.settings.reminderStyle === 'both' || this.settings.reminderStyle === 'modal') {
        new ReminderModal(this.app, result.tasks).open();
      }
    }
    // 无任务时不记录，下次启动仍会检查
  }

  private checkDataviewReady(): boolean {
    const dv = (this.app as any).plugins?.plugins?.dataview?.api;
    if (!dv) {
      new Notice("Task Reminder: 需要安装并启用 Dataview 插件", 5000);
      return false;
    }
    return true;
  }

  private async updateStatusBar() {
    if (!this.statusBarItem) return;

    if (!this.checkDataviewReady()) {
      this.statusBarItem.setText('📋 ?');
      this.statusBarItem.setAttribute('aria-label', '需要 Dataview 插件');
      return;
    }

    try {
      const count = await this.dataService.getTaskCount();
      this.statusBarItem.setText(`📋 ${count}`);
      this.statusBarItem.setAttribute('aria-label', `今日待办: ${count} 项`);
    } catch (e) {
      this.statusBarItem.setText('📋 !');
      this.statusBarItem.setAttribute('aria-label', '获取任务失败');
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    if (this.refreshDebounceTimer) {
      window.clearTimeout(this.refreshDebounceTimer);
    }
  }
}
```

### 4.6 ReminderModal（支持点击跳转）

```typescript
// src/ui/ReminderModal.ts
import { App, Modal } from 'obsidian';
import { TaskItem } from '../types';

export class ReminderModal extends Modal {
  private tasks: TaskItem[];

  constructor(app: App, tasks: TaskItem[]) {
    super(app);
    this.tasks = tasks;
  }

  onOpen() {
    const { contentEl, titleEl } = this;

    titleEl.setText(`📋 今日待办提醒 (${this.tasks.length})`);

    const container = contentEl.createDiv({ cls: 'task-reminder-list' });

    this.tasks.forEach(task => {
      const itemEl = container.createDiv({ cls: 'task-reminder-item' });

      // 来源标签
      const sourceEl = itemEl.createSpan({ cls: 'task-source-label' });
      sourceEl.setText(task.sourceLabel);

      // 任务文本（可点击）
      const textEl = itemEl.createSpan({ cls: 'task-text' });
      textEl.setText((task.isMeeting ? '🗓️ ' : '• ') + task.text);

      if (task.isMeeting) {
        textEl.addClass('task-meeting');
      }

      // 点击跳转到文件
      itemEl.addEventListener('click', async () => {
        const file = this.app.vault.getAbstractFileByPath(task.filePath);
        if (file) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file as any);

          // 如果有行号，滚动到对应位置
          if (task.line !== undefined) {
            const view = leaf.view as any;
            if (view?.editor) {
              view.editor.setCursor({ line: task.line, ch: 0 });
              view.editor.scrollIntoView({ from: { line: task.line, ch: 0 }, to: { line: task.line, ch: 0 } }, true);
            }
          }
        }
        this.close();
      });

      itemEl.style.cursor = 'pointer';
    });

    // 关闭按钮
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    const closeBtn = btnContainer.createEl('button', { text: '知道了 ✓' });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}
```

---

## 5. 错误处理矩阵

| 错误场景 | 触发条件 | 用户提示 | 是否禁用来源 | 提示频率 | 验收标准 |
|---------|---------|---------|-------------|---------|----------|
| Dataview 未安装/未启用 | `app.plugins.plugins.dataview?.api` 为 falsy | Notice + 设置页警告 | 全部禁用 | 每次触发时 | 状态栏显示 `📋 ?` |
| Daily Note 路径未配置 | `settings.dailyNotePath === ""` | 设置页提示 | 禁用 daily | 仅设置页 | 设置项旁显示警告图标 |
| Daily Note 路径不存在 | `vault.getAbstractFileByPath()` 返回 null | Notice（5s 自动关闭） | 禁用 daily | 每日首次 | Notice 包含路径信息 |
| Nike 路径未配置 | `settings.nikePath === ""` | 设置页提示 | 禁用 nike | 仅设置页 | 设置项旁显示警告图标 |
| 周期任务配置文件不存在 | `vault.getAbstractFileByPath()` 返回 null | Notice（5s 自动关闭） | 禁用 recurring | 每日首次 | Notice 包含路径信息 |
| 周期任务配置格式错误 | 表格解析失败或必填字段缺失 | Notice + 具体行号 | 禁用 recurring | 每次触发时 | Notice 显示错误行号 |
| Dataview 查询超时（>5s） | Promise 超过 5000ms 未 resolve | Notice | 临时禁用 | 每次超时 | 下次刷新自动重试 |
| 文件读取失败 | `vault.read()` 抛出异常 | 静默跳过 | 跳过该文件 | 不提示 | console.debug 记录 |

```typescript
// 错误处理示例
try {
  const tasks = await this.queryDailyTasks();
  return { tasks, error: null };
} catch (e) {
  console.warn('[TaskReminder] Daily tasks query failed:', e);
  return {
    tasks: [],
    error: {
      source: 'daily',
      message: e.message,
      recoverable: true
    }
  };
}
```

---

## 6. Obsidian 插件开发规范

### 6.1 官方要求

| 要求 | 本插件应对 |
|------|------------|
| 描述 ≤250 字符 | ✅ "Displays a daily task reminder popup when Obsidian starts, showing pending tasks from Daily Notes and custom sources." (117 chars) |
| 移除示例代码 | ✅ 将执行 |
| 命令 ID 不含插件 ID | ✅ 使用 `show-task-reminder` |
| 设置 minAppVersion | `1.4.0`（Dataview API 稳定版本） |
| isDesktopOnly | `false`（支持移动端，状态栏仅桌面端显示） |

### 6.2 事件管理

```typescript
// ✅ 正确：使用 registerEvent 自动清理
this.registerEvent(
  this.app.vault.on('modify', () => this.debouncedRefresh())
);

// ✅ 正确：使用 registerInterval 自动清理
this.registerInterval(
  window.setInterval(() => this.updateStatusBar(), 5 * 60 * 1000)
);
```

### 6.3 安全合规

- ✅ **不使用 eval**：所有数据源逻辑编译进插件
- ✅ **不执行外部代码**：不加载用户 vault 中的 JS 文件
- ✅ **不发送网络请求**：纯本地操作
- ✅ **有限写入**：以下功能会写入 Daily Note（均需用户主动触发）：
  | 功能 | 写入操作 | 触发方式 |
  |------|---------|---------|
  | F4 周期任务生成 | 追加周期任务到 Daily Note | 点击「生成到 Daily Note」按钮 |
  | F5 快速添加 | 追加新任务到目标日期 Daily Note | QuickAddModal 确认 |
  | F6 移动任务 | 从源 Daily Note 删除 + 追加到目标 Daily Note | DatePickerModal 确认 |

---

## 7. 测试计划

### 7.1 功能测试

| 测试项 | 预期结果 | 验收标准 |
|--------|----------|----------|
| 首次启动 | 延迟后显示弹窗 | 延迟时间 = popupDelay ± 100ms |
| 同日二次启动 | 不再弹窗 | lastReminderDate 已记录 |
| 跨日启动 | 重新弹窗 | 日期变化后重新触发 |
| 手动触发命令 | 强制显示弹窗 | 不写入 lastReminderDate |
| 禁用插件设置 | 不弹窗 | enabled = false 时跳过 |
| 无任务时 | 不弹窗，不记录 | 下次启动仍检查 |
| 点击任务跳转 | 打开文件并定位 | 滚动到任务行 |
| Dataview 未安装 | 显示警告，功能禁用 | Notice + 设置页提示 |

### 7.2 F5/F6 功能测试

| 测试项 | 预期结果 | 验收标准 |
|--------|----------|----------|
| F5: 命令触发 | 打开 QuickAddModal | 输入框自动获得焦点 |
| F5: Ribbon 按钮 | 打开 QuickAddModal | 按钮显示 ➕ 图标 |
| F5: 空内容提交 | 显示提示，不关闭弹窗 | Notice "请输入任务内容" |
| F5: Ctrl+Enter | 添加到今天 | 任务写入今日 Daily Note |
| F5: 选择日期添加 | 添加到指定日期 | 任务写入目标日期 Daily Note |
| F5: 连续添加 | 添加后清空输入框 | 弹窗保持打开 |
| F5: 目标文件不存在 | 自动创建 Daily Note | 含基础 frontmatter |
| F6: Daily 任务移动 | 显示 📅 按钮 | 点击打开 DatePicker |
| F6: 非 Daily 任务 | 不显示移动按钮 | Nike/Holiday/Recurring 无移动选项 |
| F6: 移动到明天 | 从原文件删除，追加到目标 | 两个文件内容正确 |
| F6: 移动失败回滚 | 原任务保留 | 目标写入失败时不删除原任务 |
| DatePicker: 快捷选项 | 点击立即选中 | 今天/明天/后天/下周一/下周六 |
| DatePicker: 日历选择 | 点击日期选中 | 过去日期灰显（默认） |
| DatePicker: 相对输入 | +3 解析为 3 天后 | 支持 +N 格式 |
| DatePicker: 直接输入 | YYYY-MM-DD 格式解析 | 无效格式无响应 |

### 7.3 多 Vault 测试

| 测试项 | 预期结果 |
|--------|----------|
| Vault A 弹过后打开 Vault B | Vault B 仍会弹窗 |
| 两个 Vault 同时打开 | 各自独立弹窗 |

### 7.3 兼容性测试

- [x] Obsidian Desktop (Windows)
- [ ] Obsidian Desktop (macOS)
- [ ] Obsidian Desktop (Linux)
- [ ] 与 Dataview 插件共存
- [ ] 与 Remotely Save 插件共存

### 7.4 移动端测试

- **支持**：`isDesktopOnly: false`
- 状态栏功能仅在桌面端显示（通过 `Platform.isDesktop` 判断）
- 核心提醒功能（弹窗、Notice）在移动端正常工作

**移动端测试矩阵**:

| 测试项 | iOS | Android | 验收标准 |
|--------|-----|---------|---------|
| ReminderModal 显示 | [ ] | [ ] | 弹窗居中，内容可滚动 |
| 任务项长按菜单（F6） | [ ] | [ ] | 500ms 后显示「移动到...」菜单 |
| DatePickerModal 触控 | [ ] | [ ] | 日期按钮 ≥ 44×44px，可正常点击 |
| DatePickerModal 滑动 | [ ] | [ ] | 左右滑动可切换月份 |
| 软键盘遮挡 | [ ] | [ ] | 输入框聚焦时弹窗自动上移 |
| 安全区适配 | [ ] | [ ] | 底部按钮不被 Home 条遮挡 |
| QuickAddModal（F5） | [ ] | [ ] | 输入框可正常输入，键盘不遮挡提交按钮 |
| Ribbon 按钮 | [ ] | [ ] | 侧边栏可见 ➕ 图标，点击打开 QuickAddModal |
| 命令面板触发 | [ ] | [ ] | 可通过命令面板触发 F5/手动提醒 |

---

## 8. 发布计划

### 8.1 里程碑

| 阶段 | 内容 | 时间 | 状态 |
|------|------|------|------|
| M1 | 脚手架搭建 + 基础弹窗 | Week 1 | ✅ 完成 |
| M2 | 设置面板 + 命令注册 | Week 2 | ✅ 完成 |
| M3 | 数据服务实现（4 个数据源） | Week 3 | ✅ 完成 |
| M4 | 错误处理 + 点击跳转 | Week 4 | ✅ 完成 |
| M5 | F5 快速添加 + F6 移动任务 + DatePicker | Week 5 | 🔲 待开始 |
| M6 | 测试 + 文档 | Week 6 | 🔲 待开始 |
| M7 | 提交社区插件仓库 | Week 7 | 🔲 待开始 |

### 8.2 提交清单

- [x] `manifest.json` 完整填写
- [x] `README.md` 包含使用说明、截图、配置指南
- [x] `LICENSE` 文件（MIT）
- [ ] GitHub Release 包含 `main.js`, `manifest.json`, `styles.css`
- [ ] 向 `obsidian-releases` 仓库提交 PR

---

## 9. 附录

### 9.1 设置界面设计

```
┌─────────────────────────────────────────────────────┐
│ Task Reminder 设置                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ⚠️ 需要 Dataview 插件支持 [安装指南]                  │  ← 仅在未检测到时显示
│                                                      │
│ ── 基础设置 ──                                       │
│                                                      │
│ 启用自动提醒                              [开关] ✓   │
│ Obsidian 启动时自动显示今日任务提醒                   │
│                                                      │
│ 延迟时间                                  [30] 秒    │
│ 启动后等待多少秒再弹窗（建议等待同步完成）              │
│                                                      │
│ 提醒样式                              [▼ 两者都显示]  │
│   • 两者都显示                                       │
│   • 仅通知栏                                         │
│   • 仅弹窗                                           │
│                                                      │
│ 显示状态栏指示器                          [开关] ✓   │
│                                                      │
│ ── 数据源配置 ──                                     │
│                                                      │
│ Daily Note 路径                    [📁] 00 - Daily   │
│ 包含 Daily Note 任务                      [开关] ✓   │
│                                                      │
│ Nike 日历路径                      [📁] 03 - Working │
│ 包含 Nike 项目任务                        [开关] ✓   │
│                                                      │
│ 周期任务配置                       [📁] recurring... │
│ 包含周期任务                              [开关] ✓   │
│                                                      │
│ 包含节假日                                [开关] ✓   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 9.2 参考资源

- [Obsidian Plugin API 文档](https://docs.obsidian.md/Plugins)
- [generator-obsidian-plugin](https://github.com/mnaoumov/generator-obsidian-plugin)
- [obsidian-dev-utils](https://github.com/mnaoumov/obsidian-dev-utils)
- [Obsidian 插件审查指南](https://liamca.in/Obsidian/Plugin+Review+Guide/index)
- [插件提交要求](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)

### 9.3 审计报告回应

| 审计编号 | 问题 | 解决方案 |
|---------|------|----------|
| P0-1 | eval 动态加载 | ✅ 移除，逻辑编译进插件 |
| P0-2 | 数据源规则缺失 | ✅ 新增第 3 节数据合同 |
| P0-3 | Dataview 依赖未定义 | ✅ 明确为强依赖，4.3 节 |
| P1-4 | localStorage 跨 vault | ✅ 改用 saveData()，2.3 节 |
| P1-5 | 接口类型不一致 | ✅ 统一为 Promise<T>，4.4 节 |
| P1-6 | 状态栏只更新一次 | ✅ 增加刷新策略，2.1/F3 |
| P1-7 | 弹窗语义歧义 | ✅ 明确有任务才记录，2.3 节 |
| P1-8 | Notice+Modal UX | ✅ 增加 reminderStyle 设置 |
| P2-9 | 硬编码路径 | ✅ 默认为空，需用户配置 |
| P2-10 | 错误处理缺失 | ✅ 新增第 5 节错误矩阵 |
| P2-11 | 移动端不明确 | ✅ 明确 isDesktopOnly: false，状态栏仅桌面端 |

---

**规格书更新完成，已解决所有审计问题。**
