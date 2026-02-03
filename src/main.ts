/**
 * Task Reminder Plugin - 主入口
 * 根据 SPEC.md §4.5 定义
 */

import { Plugin, Notice, Platform, moment } from 'obsidian';
import { TaskReminderSettings, DEFAULT_SETTINGS, TaskReminderSettingTab } from './settings';
import { TaskDataService } from './services/TaskDataService';
import { DailyNoteService } from './services/DailyNoteService';
import { ReminderModal } from './ui/ReminderModal';
import { StatusBarItem } from './ui/StatusBarItem';
import { PendingRecurringTask } from './types';

export default class TaskReminderPlugin extends Plugin {
  settings: TaskReminderSettings;
  private dataService: TaskDataService;
  private dailyNoteService: DailyNoteService;
  private statusBarItem: StatusBarItem | null = null;
  private statusBarEl: HTMLElement | null = null;
  private refreshDebounceTimer: number | null = null;
  private refreshIntervalId: number | null = null;

  async onload() {
    console.log('[TaskReminder] Loading plugin...');

    // 加载设置
    await this.loadSettings();

    // 初始化数据服务
    this.dataService = new TaskDataService(this.app, this.settings);

    // 初始化日记写入服务（F4 功能）
    this.dailyNoteService = new DailyNoteService(this.app, this.settings);

    // 注册设置面板
    this.addSettingTab(new TaskReminderSettingTab(this.app, this));

    // 注册命令
    this.addCommand({
      id: 'show-task-reminder',
      name: 'Show today\'s task reminder',
      callback: () => this.showReminder(true) // force = true, 不写入已弹过标记
    });

    // 状态栏（仅桌面端）
    if (this.settings.showStatusBar && Platform.isDesktop) {
      this.setupStatusBar();
    }

    // 布局就绪后调度提醒
    this.app.workspace.onLayoutReady(() => {
      this.scheduleReminder();
    });

    console.log('[TaskReminder] Plugin loaded successfully');
  }

  /**
   * 设置状态栏
   */
  private setupStatusBar(): void {
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarItem = new StatusBarItem(
      this.app,
      this.statusBarEl,
      this.dataService,
      () => this.showReminder(true)
    );

    // 初始更新
    this.updateStatusBar();

    // 定期刷新（每 5 分钟）
    this.refreshIntervalId = window.setInterval(
      () => this.updateStatusBar(),
      5 * 60 * 1000
    );
    this.registerInterval(this.refreshIntervalId);

    // 文件变更刷新（debounce 500ms）
    this.registerEvent(
      this.app.vault.on('modify', () => this.debouncedRefresh())
    );
  }

  /**
   * 防抖刷新
   */
  private debouncedRefresh(): void {
    if (this.refreshDebounceTimer) {
      window.clearTimeout(this.refreshDebounceTimer);
    }
    this.refreshDebounceTimer = window.setTimeout(() => {
      this.dataService.invalidateCache();
      this.updateStatusBar();
    }, 500);
  }

  /**
   * 更新状态栏
   */
  private async updateStatusBar(): Promise<void> {
    if (this.statusBarItem) {
      await this.statusBarItem.update();
    }
  }

  /**
   * 调度提醒
   */
  private scheduleReminder(): void {
    if (!this.settings.enabled) {
      console.log('[TaskReminder] Auto reminder disabled');
      return;
    }

    // 检查今日是否已弹过
    const todayStr = moment().format('YYYY-MM-DD');
    if (this.settings.lastReminderDate === todayStr) {
      console.log('[TaskReminder] Already shown today, skipping');
      return;
    }

    console.log(`[TaskReminder] Scheduling reminder in ${this.settings.popupDelay / 1000}s`);

    // 延迟弹窗
    window.setTimeout(() => {
      this.showReminder(false);
    }, this.settings.popupDelay);
  }

  /**
   * 显示提醒
   * @param force 是否强制显示（忽略"已弹过"状态）
   */
  async showReminder(force: boolean): Promise<void> {
    // 检查 Dataview
    if (!this.checkDataviewReady()) {
      return;
    }

    console.log('[TaskReminder] Fetching task data...');
    const result = await this.dataService.getTaskData();

    // 获取待生成的周期任务（F4 功能）
    const pendingRecurringTasks = await this.dataService.getPendingRecurringTasks();

    // 显示错误提示（如有）
    result.errors.forEach(err => {
      if (!err.recoverable) {
        new Notice(`Task Reminder: ${err.source} - ${err.message}`, 5000);
      }
    });

    console.log(`[TaskReminder] Found ${result.tasks.length} tasks, ${pendingRecurringTasks.length} pending recurring`);

    const hasTasks = result.tasks.length > 0 || pendingRecurringTasks.length > 0;

    if (hasTasks) {
      // 仅在非强制模式下记录"已弹过"
      if (!force) {
        this.settings.lastReminderDate = moment().format('YYYY-MM-DD');
        await this.saveSettings();
        console.log('[TaskReminder] Marked as shown for today');
      }

      // 根据设置显示 Notice 和/或 Modal
      if (this.settings.reminderStyle === 'both' || this.settings.reminderStyle === 'notice') {
        const taskMsg = result.tasks.length > 0 ? `${result.tasks.length} 个待办任务` : '';
        const pendingMsg = pendingRecurringTasks.length > 0 ? `${pendingRecurringTasks.length} 个待生成` : '';
        const msg = [taskMsg, pendingMsg].filter(Boolean).join(', ');
        new Notice(`⏰ 今日有 ${msg}!`, this.settings.popupDuration);
      }

      if (this.settings.reminderStyle === 'both' || this.settings.reminderStyle === 'modal') {
        new ReminderModal(
          this.app,
          result.tasks,
          pendingRecurringTasks,
          (tasks) => this.generateRecurringTasks(tasks)
        ).open();
      }
    } else {
      console.log('[TaskReminder] No tasks found, not recording as shown');
      // 无任务时也可以给个提示（仅手动触发时）
      if (force) {
        new Notice('✅ 今日没有待办任务!', 3000);
      }
    }
  }

  /**
   * 生成周期任务到 Daily Note（F4 功能）
   */
  private async generateRecurringTasks(tasks: PendingRecurringTask[]): Promise<number> {
    const count = await this.dailyNoteService.writeRecurringTasks(tasks);
    // 刷新缓存和状态栏
    this.dataService.invalidateCache();
    await this.updateStatusBar();
    return count;
  }

  /**
   * 检查 Dataview 是否就绪
   */
  private checkDataviewReady(): boolean {
    const dv = (this.app as any).plugins?.plugins?.dataview?.api;
    if (!dv) {
      new Notice('Task Reminder: 需要安装并启用 Dataview 插件', 5000);
      return false;
    }
    return true;
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * 保存设置
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 更新数据服务的设置引用
    if (this.dataService) {
      this.dataService.updateSettings(this.settings);
    }
    // 更新日记服务的设置引用（F4 功能）
    if (this.dailyNoteService) {
      this.dailyNoteService.updateSettings(this.settings);
    }
  }

  onunload(): void {
    console.log('[TaskReminder] Unloading plugin...');

    if (this.refreshDebounceTimer) {
      window.clearTimeout(this.refreshDebounceTimer);
    }

    console.log('[TaskReminder] Plugin unloaded');
  }
}
