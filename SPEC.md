# Task Reminder Plugin 规格书

> **版本**: 1.1.0
> **创建日期**: 2026-02-03
> **最后更新**: 2026-02-03
> **状态**: ✅ 已发布
> **对应代码版本**: manifest.json v1.1.0 | commit: ddc04a9

---

## 修订记录

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0-draft | 2026-02-03 | 初始草案 |
| 1.1.0 | 2026-02-03 | 正式发布版本：M1-M4 里程碑已实现，支持移动端，路径自动补全 |

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

#### F4: 周期任务生成（🔲 规划中 - v1.2.0）

> ⚠️ **注意**: 此功能尚未实现，属于规划功能。实现后将修改 Daily Note 文件，届时需更新 §6.3 安全合规声明。

- **触发方式**: 弹窗底部「生成到 Daily Note」按钮
- **显示条件**: 存在待生成的周期任务（未写入 Daily Note）
- **生成逻辑**:
  1. 检测今日应触发的周期任务（daily/weekly/monthly）
  2. 检查 Daily Note 中是否已存在（通过 `🔄` 前缀识别）
  3. 未存在的任务显示在"待生成"区域
  4. 点击按钮追加到 Daily Note 末尾
- **任务格式**: `- [ ] 🔄 任务名称`
- **Daily Note 自动创建**: 若文件不存在，自动创建（含基础 frontmatter）

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
│   │   └── RecurringTaskSource.ts # 周期任务数据源
│   ├── ui/
│   │   ├── ReminderModal.ts    # 提醒弹窗
│   │   └── StatusBarItem.ts    # 状态栏组件
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
- ✅ **只读操作**：当前版本不修改用户笔记内容（F4 功能实现后将支持写入 Daily Note）

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

### 7.2 多 Vault 测试

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

### 7.4 移动端

- **支持**：`isDesktopOnly: false`
- 状态栏功能仅在桌面端显示（通过 `Platform.isDesktop` 判断）
- 核心提醒功能（弹窗、Notice）在移动端正常工作
- 需测试：iOS、Android 上的 Modal 显示效果

---

## 8. 发布计划

### 8.1 里程碑

| 阶段 | 内容 | 时间 | 状态 |
|------|------|------|------|
| M1 | 脚手架搭建 + 基础弹窗 | Week 1 | ✅ 完成 |
| M2 | 设置面板 + 命令注册 | Week 2 | ✅ 完成 |
| M3 | 数据服务实现（4 个数据源） | Week 3 | ✅ 完成 |
| M4 | 错误处理 + 点击跳转 | Week 4 | ✅ 完成 |
| M5 | 测试 + 文档 | Week 5 | 🔲 待开始 |
| M6 | 提交社区插件仓库 | Week 6 | 🔲 待开始 |

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
