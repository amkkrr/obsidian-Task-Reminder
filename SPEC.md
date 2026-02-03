# Task Reminder Plugin 规格书

> **版本**: 1.0.0-draft
> **创建日期**: 2026-02-03
> **状态**: 草案

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

### 1.3 命名

- **插件 ID**: `task-reminder`
- **显示名称**: Task Reminder（任务提醒）
- **描述**: Displays a daily task reminder popup when Obsidian starts, showing pending tasks from Daily Notes, Nike projects, holidays, and recurring tasks.

---

## 2. 功能需求

### 2.1 核心功能

#### F1: 启动时自动提醒

- **触发时机**: Obsidian 布局就绪后（`onLayoutReady`）
- **延迟机制**: 可配置延迟时间（默认 30 秒），等待同步完成
- **防重复**: 每日只弹一次，基于日期 key 存储在 `localStorage`
- **弹窗内容**:
  - 今日待办任务列表
  - 来源标签（📅 Daily / 👟 Nike / 🎉 Holiday / 🔄 周期）
  - 会议任务高亮显示

#### F2: 手动触发命令

- **命令名称**: `Show today's task reminder`
- **快捷键**: 用户可自定义
- **行为**: 忽略"已弹过"状态，强制显示当前任务

#### F3: 状态栏指示器（可选）

- 显示今日待办数量
- 点击打开提醒弹窗

### 2.2 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用自动提醒 |
| `popupDelay` | number | `30000` | 启动后延迟弹窗时间（毫秒） |
| `popupDuration` | number | `8000` | Notice 通知显示时长（毫秒） |
| `showStatusBar` | boolean | `true` | 是否显示状态栏指示器 |
| `taskSources.daily` | boolean | `true` | 是否包含 Daily Note 任务 |
| `taskSources.nike` | boolean | `true` | 是否包含 Nike 项目任务 |
| `taskSources.holiday` | boolean | `true` | 是否包含节假日任务 |
| `taskSources.recurring` | boolean | `true` | 是否包含周期任务 |
| `dailyNotePath` | string | `"00 - INBOX/01 - Daily"` | Daily Note 文件夹路径 |
| `utilsScriptPath` | string | `"06 - DATA FILE/99.Settings/05.Code/task-utils.js"` | 工具脚本路径 |
| `recurringScriptPath` | string | `"06 - DATA FILE/99.Settings/05.Code/recurring-task-manager.js"` | 周期任务脚本路径 |

### 2.3 数据源集成

插件需要复用现有的数据获取逻辑：

```
┌─────────────────────────────────────────────────────────────┐
│                    Task Reminder Plugin                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ task-utils.js│    │recurring-    │    │ Dataview API │   │
│  │              │◄───│manager.js    │◄───│              │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TaskDataService (新建)                   │   │
│  │  - getTodayTasks(): Promise<TaskItem[]>              │   │
│  │  - getTaskCount(): number                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ReminderModal / Notice                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 技术设计

### 3.1 开发环境

根据 2025 年最佳实践，推荐使用：

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18.x | 运行时 |
| TypeScript | ≥ 5.0 | 类型安全 |
| [generator-obsidian-plugin](https://github.com/mnaoumov/generator-obsidian-plugin) | latest | 替代官方模板，更完善 |
| [obsidian-dev-utils](https://github.com/mnaoumov/obsidian-dev-utils) | latest | 开发工具包 |
| esbuild | latest | 打包工具（模板内置） |

### 3.2 项目结构

```
task-reminder/
├── src/
│   ├── main.ts                 # 插件入口
│   ├── settings.ts             # 设置定义与 UI
│   ├── services/
│   │   └── TaskDataService.ts  # 数据获取服务
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

### 3.3 核心类设计

#### 3.3.1 主插件类

```typescript
// src/main.ts
import { Plugin } from 'obsidian';
import { TaskReminderSettings, DEFAULT_SETTINGS, TaskReminderSettingTab } from './settings';
import { TaskDataService } from './services/TaskDataService';
import { ReminderModal } from './ui/ReminderModal';

export default class TaskReminderPlugin extends Plugin {
  settings: TaskReminderSettings;
  private dataService: TaskDataService;
  private statusBarItem: HTMLElement | null = null;
  private hasShownToday = false;

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
      callback: () => this.showReminder(true) // force = true
    });

    // 状态栏
    if (this.settings.showStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
      this.updateStatusBar();
    }

    // 布局就绪后调度提醒
    this.app.workspace.onLayoutReady(() => {
      this.scheduleReminder();
    });
  }

  private scheduleReminder() {
    if (!this.settings.enabled) return;

    // 检查今日是否已弹过
    const todayKey = `task-reminder-${moment().format('YYYY-MM-DD')}`;
    if (localStorage.getItem(todayKey)) {
      this.hasShownToday = true;
      return;
    }

    // 延迟弹窗
    this.registerInterval(
      window.setTimeout(() => {
        this.showReminder(false);
      }, this.settings.popupDelay)
    );
  }

  async showReminder(force: boolean) {
    if (!force && this.hasShownToday) return;

    const tasks = await this.dataService.getTodayTasks();

    if (tasks.length > 0) {
      // 标记已弹过
      const todayKey = `task-reminder-${moment().format('YYYY-MM-DD')}`;
      localStorage.setItem(todayKey, 'true');
      this.hasShownToday = true;

      // 显示 Notice
      new Notice(`⏰ 今日有 ${tasks.length} 个待办任务!`, this.settings.popupDuration);

      // 显示 Modal
      new ReminderModal(this.app, tasks).open();
    }
  }

  private async updateStatusBar() {
    if (!this.statusBarItem) return;
    const count = await this.dataService.getTaskCount();
    this.statusBarItem.setText(`📋 ${count}`);
    this.statusBarItem.setAttribute('aria-label', `今日待办: ${count} 项`);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

#### 3.3.2 设置定义

```typescript
// src/settings.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import TaskReminderPlugin from './main';

export interface TaskReminderSettings {
  enabled: boolean;
  popupDelay: number;
  popupDuration: number;
  showStatusBar: boolean;
  taskSources: {
    daily: boolean;
    nike: boolean;
    holiday: boolean;
    recurring: boolean;
  };
  dailyNotePath: string;
  utilsScriptPath: string;
  recurringScriptPath: string;
}

export const DEFAULT_SETTINGS: TaskReminderSettings = {
  enabled: true,
  popupDelay: 30000,
  popupDuration: 8000,
  showStatusBar: true,
  taskSources: {
    daily: true,
    nike: true,
    holiday: true,
    recurring: true
  },
  dailyNotePath: '00 - INBOX/01 - Daily',
  utilsScriptPath: '06 - DATA FILE/99.Settings/05.Code/task-utils.js',
  recurringScriptPath: '06 - DATA FILE/99.Settings/05.Code/recurring-task-manager.js'
};

export class TaskReminderSettingTab extends PluginSettingTab {
  plugin: TaskReminderPlugin;

  constructor(app: App, plugin: TaskReminderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Task Reminder 设置' });

    // 启用开关
    new Setting(containerEl)
      .setName('启用自动提醒')
      .setDesc('Obsidian 启动时自动显示今日任务提醒')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enabled)
        .onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
        }));

    // 延迟时间
    new Setting(containerEl)
      .setName('延迟时间（秒）')
      .setDesc('启动后等待多少秒再弹窗（建议等待同步完成）')
      .addSlider(slider => slider
        .setLimits(0, 120, 5)
        .setValue(this.plugin.settings.popupDelay / 1000)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.popupDelay = value * 1000;
          await this.plugin.saveSettings();
        }));

    // 更多设置项...
  }
}
```

#### 3.3.3 类型定义

```typescript
// src/types.ts
export interface TaskItem {
  source: 'daily' | 'nike' | 'holiday' | 'recurring';
  sourceLabel: string;  // 显示标签如 "📅 Daily"
  text: string;         // 任务文本（截断后）
  fullText: string;     // 完整文本
  isMeeting: boolean;   // 是否为会议
  filePath?: string;    // 来源文件路径
  dueDate?: string;     // 截止日期
}

export interface TaskDataResult {
  tasks: TaskItem[];
  dailyCount: number;
  nikeCount: number;
  holidayCount: number;
  recurringCount: number;
}
```

---

## 4. Obsidian 插件开发规范

### 4.1 官方要求（必须遵守）

基于 [Obsidian 插件提交要求](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)：

| 要求 | 说明 | 本插件应对 |
|------|------|------------|
| **描述 ≤250 字符** | 以句号结尾，无 emoji | ✅ 见 1.3 节 |
| **移除示例代码** | 提交前清理模板代码 | ✅ 将执行 |
| **命令 ID 不含插件 ID** | Obsidian 自动添加前缀 | ✅ 使用 `show-task-reminder` |
| **设置 minAppVersion** | 使用 API 对应的最低版本 | 设为 `1.4.0` |
| **桌面专用 API 标记** | 如使用 Node.js API 需设置 `isDesktopOnly` | 本插件仅用 Web API，设为 `false` |

### 4.2 事件管理

```typescript
// ✅ 正确：使用 registerEvent 自动清理
this.registerEvent(
  this.app.vault.on('create', (file) => {
    // 处理文件创建
  })
);

// ✅ 正确：使用 registerInterval 自动清理
this.registerInterval(
  window.setInterval(() => this.updateStatusBar(), 60000)
);

// ❌ 错误：直接添加事件监听器（不会自动清理）
window.addEventListener('click', handler);
```

### 4.3 布局就绪检查

```typescript
// 方法一：使用回调（推荐）
this.app.workspace.onLayoutReady(() => {
  // 布局已就绪，可以安全操作 UI
});

// 方法二：检查标志
if (this.app.workspace.layoutReady) {
  // 已就绪
} else {
  this.registerEvent(
    this.app.workspace.on('layout-ready', () => {
      // 等待就绪
    })
  );
}
```

### 4.4 避免的模式

| ❌ 避免 | ✅ 推荐 | 原因 |
|---------|---------|------|
| `cachedRead` + 写回 | `read` → 修改 → `modify` | 防止数据丢失 |
| 私有 API（`app.internalPlugins`） | 公开 API | 兼容性 |
| `console.log` | `console.debug` 或条件日志 | 生产环境清洁 |
| 同步阻塞操作 | `async/await` | 性能 |
| 硬编码路径 | 设置项配置 | 灵活性 |

### 4.5 代码审查要点

基于 [Liam Cain 的插件审查指南](https://liamca.in/Obsidian/Plugin+Review+Guide/index)：

1. **数据丢失风险**: 本插件只读取数据，不修改文件 ✅
2. **安全漏洞**: 不执行外部代码、不发送网络请求 ✅
3. **逻辑错误**: 需确保日期比较正确
4. **性能**: 避免在 `onload` 中执行耗时操作

---

## 5. 与现有代码的集成

### 5.1 复用策略

现有的 `task-utils.js` 和 `recurring-task-manager.js` 是纯 JavaScript 模块，插件有两种集成方式：

#### 方案 A：动态加载（保持现有脚本）

```typescript
// TaskDataService.ts
async loadUtils(): Promise<any> {
  const utilsFile = this.app.vault.getAbstractFileByPath(
    this.settings.utilsScriptPath
  );
  if (!utilsFile) throw new Error('Utils script not found');

  const code = await this.app.vault.read(utilsFile as TFile);
  return eval(`(function(){ ${code} })()`);
}
```

**优点**: 无需修改现有脚本，dataviewjs 和插件共用同一份代码
**缺点**: `eval` 使用需谨慎，类型提示较弱

#### 方案 B：TypeScript 重写（推荐长期）

将 `task-utils.js` 核心逻辑重写为 TypeScript 模块，编译后：
- 插件直接 import 使用
- dataviewjs 通过 `app.plugins.plugins['task-reminder'].api` 调用

**优点**: 类型安全，更好的维护性
**缺点**: 需要迁移工作

### 5.2 推荐：渐进式迁移

1. **Phase 1**: 使用方案 A 快速上线
2. **Phase 2**: 逐步将核心函数移入插件
3. **Phase 3**: 通过插件 API 暴露给 dataviewjs

---

## 6. 测试计划

### 6.1 功能测试

| 测试项 | 预期结果 |
|--------|----------|
| 首次启动 | 延迟后显示弹窗 |
| 同日二次启动 | 不再弹窗 |
| 跨日启动 | 重新弹窗 |
| 手动触发命令 | 强制显示弹窗 |
| 禁用插件设置 | 不弹窗 |
| 无任务时 | 不弹窗 |

### 6.2 兼容性测试

- [ ] Obsidian Desktop (Windows/macOS/Linux)
- [ ] Obsidian Mobile (iOS/Android) - 如适用
- [ ] 与 Dataview 插件共存
- [ ] 与 Remotely Save 插件共存

---

## 7. 发布计划

### 7.1 里程碑

| 阶段 | 内容 | 时间 |
|------|------|------|
| M1 | 脚手架搭建 + 基础弹窗 | Week 1 |
| M2 | 设置面板 + 命令注册 | Week 2 |
| M3 | 数据服务集成 | Week 3 |
| M4 | 测试 + 文档 | Week 4 |
| M5 | 提交社区插件仓库 | Week 5 |

### 7.2 提交清单

- [ ] `manifest.json` 完整填写
- [ ] `README.md` 包含使用说明
- [ ] `LICENSE` 文件（MIT）
- [ ] GitHub Release 包含 `main.js`, `manifest.json`, `styles.css`
- [ ] 向 `obsidian-releases` 仓库提交 PR

---

## 8. 附录

### 8.1 参考资源

- [Obsidian Plugin API 文档](https://docs.obsidian.md/Plugins)
- [generator-obsidian-plugin](https://github.com/mnaoumov/generator-obsidian-plugin) - 推荐模板
- [obsidian-dev-utils](https://github.com/mnaoumov/obsidian-dev-utils) - 开发工具
- [Obsidian 插件审查指南](https://liamca.in/Obsidian/Plugin+Review+Guide/index)
- [插件提交要求](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)

### 8.2 现有代码位置

| 文件 | 路径 |
|------|------|
| 当前提醒逻辑 | `首页任务列表测试.md` 第 43-133 行 |
| 任务工具函数 | `06 - DATA FILE/99.Settings/05.Code/task-utils.js` |
| 周期任务管理 | `06 - DATA FILE/99.Settings/05.Code/recurring-task-manager.js` |

---

**下一步**: 确认规格后，开始搭建插件脚手架。
