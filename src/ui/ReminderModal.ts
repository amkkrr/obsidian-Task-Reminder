/**
 * Reminder Modal - 任务提醒弹窗
 * 根据 SPEC.md §4.6 定义
 * F6: 添加移动按钮和菜单支持
 */

import { App, Modal, TFile, Notice, Menu, Platform, moment } from 'obsidian';
import { TaskItem, PendingRecurringTask } from '../types';

/** 生成回调类型 */
export type GenerateCallback = (tasks: PendingRecurringTask[]) => Promise<number>;

/** 移动任务回调类型 */
export type MoveTaskCallback = (task: TaskItem) => void;

export class ReminderModal extends Modal {
  private tasks: TaskItem[];
  private pendingRecurringTasks: PendingRecurringTask[];
  private onGenerate?: GenerateCallback;
  private onMoveTask?: MoveTaskCallback;

  constructor(
    app: App,
    tasks: TaskItem[],
    pendingRecurringTasks: PendingRecurringTask[] = [],
    onGenerate?: GenerateCallback,
    onMoveTask?: MoveTaskCallback
  ) {
    super(app);
    this.tasks = tasks;
    this.pendingRecurringTasks = pendingRecurringTasks;
    this.onGenerate = onGenerate;
    this.onMoveTask = onMoveTask;
  }

  onOpen() {
    const { contentEl, titleEl } = this;

    // 设置标题
    titleEl.setText(`📋 今日待办提醒 (${this.tasks.length})`);

    // 创建任务列表容器
    const container = contentEl.createDiv({ cls: 'task-reminder-list' });

    // 按来源分组显示
    const groupedTasks = this.groupTasksBySource();

    for (const [source, tasks] of Object.entries(groupedTasks)) {
      if (tasks.length === 0) continue;

      // 来源分组标题
      const groupEl = container.createDiv({ cls: 'task-reminder-group' });
      const groupTitle = groupEl.createDiv({ cls: 'task-reminder-group-title' });
      groupTitle.setText(`${tasks[0].sourceLabel} (${tasks.length})`);

      // 任务列表
      for (const task of tasks) {
        const itemEl = groupEl.createDiv({ cls: 'task-reminder-item' });

        // 任务图标
        const iconEl = itemEl.createSpan({ cls: 'task-icon' });
        iconEl.setText(task.isMeeting ? '🗓️' : '•');

        // 任务文本
        const textEl = itemEl.createSpan({ cls: 'task-text' });
        textEl.setText(task.text);

        if (task.isMeeting) {
          textEl.addClass('task-meeting');
        }

        // 过期标记
        if (task.dueDate && this.isOverdue(task.dueDate)) {
          const overdueEl = itemEl.createSpan({ cls: 'task-overdue' });
          overdueEl.setText('⚠️ 过期');
        }

        // F6: 移动按钮（仅 daily 来源任务）
        if (task.source === 'daily' && this.onMoveTask) {
          const moveBtn = itemEl.createEl('button', {
            cls: 'task-reminder-move-btn',
            attr: { 'aria-label': '移动到其他日期' }
          });
          moveBtn.setText('📅');
          moveBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止冒泡，避免触发跳转
            this.onMoveTask!(task);
          });
        }

        // 点击跳转到文件
        itemEl.addEventListener('click', () => this.navigateToTask(task));
        itemEl.style.cursor = 'pointer';
        itemEl.setAttribute('title', task.fullText);

        // F6: 桌面端右键菜单
        if (Platform.isDesktop && task.source === 'daily' && this.onMoveTask) {
          itemEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMoveMenu(task, e);
          });
        }

        // F6: 移动端长按手势
        if (Platform.isMobile && task.source === 'daily' && this.onMoveTask) {
          this.setupLongPressGesture(itemEl, task);
        }
      }
    }

    // 渲染待生成的周期任务区域
    this.renderPendingSection(container);

    // 底部按钮
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    // 如果有待生成的周期任务，显示生成按钮
    if (this.pendingRecurringTasks.length > 0 && this.onGenerate) {
      const generateBtn = btnContainer.createEl('button', {
        text: `🔄 生成到 Daily Note (${this.pendingRecurringTasks.length})`
      });
      generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true;
        generateBtn.setText('生成中...');

        try {
          const count = await this.onGenerate!(this.pendingRecurringTasks);
          new Notice(`✅ 已生成 ${count} 个周期任务到 Daily Note`);
          this.close();
        } catch (e) {
          new Notice(`❌ 生成失败: ${(e as Error).message}`);
          generateBtn.disabled = false;
          generateBtn.setText(`🔄 生成到 Daily Note (${this.pendingRecurringTasks.length})`);
        }
      });
    }

    const closeBtn = btnContainer.createEl('button', { text: '知道了 ✓' });
    closeBtn.addClass('mod-cta');
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }

  /**
   * 按来源分组任务
   */
  private groupTasksBySource(): Record<string, TaskItem[]> {
    const groups: Record<string, TaskItem[]> = {
      daily: [],
      nike: [],
      holiday: [],
      recurring: []
    };

    for (const task of this.tasks) {
      if (groups[task.source]) {
        groups[task.source].push(task);
      }
    }

    return groups;
  }

  /**
   * 渲染待生成的周期任务区域
   */
  private renderPendingSection(container: HTMLElement): void {
    if (this.pendingRecurringTasks.length === 0) {
      return;
    }

    const sectionEl = container.createDiv({ cls: 'task-reminder-group task-reminder-pending' });
    const titleEl = sectionEl.createDiv({ cls: 'task-reminder-group-title' });
    titleEl.setText(`🔄 待生成 (${this.pendingRecurringTasks.length})`);

    for (const task of this.pendingRecurringTasks) {
      const itemEl = sectionEl.createDiv({ cls: 'task-reminder-item task-pending-item' });

      const iconEl = itemEl.createSpan({ cls: 'task-icon' });
      iconEl.setText('○');

      const textEl = itemEl.createSpan({ cls: 'task-text task-pending-text' });
      textEl.setText(task.name);

      const typeEl = itemEl.createSpan({ cls: 'task-type-label' });
      typeEl.setText(task.type);
    }
  }

  /**
   * 检查是否过期
   * 修复 P1-2：使用本地时间而非 UTC
   */
  private isOverdue(dueDate: string): boolean {
    const today = moment().format('YYYY-MM-DD');
    return dueDate < today;
  }

  /**
   * 导航到任务所在文件
   */
  private async navigateToTask(task: TaskItem): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);

    if (file && file instanceof TFile) {
      // 在新标签页打开文件
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);

      // 如果有行号，滚动到对应位置
      if (task.line !== undefined) {
        // 等待编辑器加载
        setTimeout(() => {
          const view = leaf.view as any;
          if (view?.editor) {
            const line = task.line!;
            view.editor.setCursor({ line, ch: 0 });
            view.editor.scrollIntoView(
              { from: { line, ch: 0 }, to: { line, ch: 0 } },
              true
            );
          }
        }, 100);
      }
    }

    this.close();
  }

  /**
   * F6: 显示移动菜单
   */
  private showMoveMenu(task: TaskItem, event: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle('移动到...')
        .setIcon('calendar')
        .onClick(() => this.onMoveTask?.(task));
    });
    menu.showAtMouseEvent(event);
  }

  /**
   * F6: 设置移动端长按手势
   */
  private setupLongPressGesture(itemEl: HTMLElement, task: TaskItem): void {
    let touchTimer: number | null = null;

    itemEl.addEventListener('touchstart', (e) => {
      touchTimer = window.setTimeout(() => {
        // 触发移动菜单
        const touch = e.touches[0];
        const menu = new Menu();
        menu.addItem((item) => {
          item.setTitle('移动到...')
            .setIcon('calendar')
            .onClick(() => this.onMoveTask?.(task));
        });
        menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
      }, 500); // 500ms 长按延迟
    }, { passive: true });

    itemEl.addEventListener('touchend', () => {
      if (touchTimer) {
        window.clearTimeout(touchTimer);
        touchTimer = null;
      }
    });

    itemEl.addEventListener('touchmove', () => {
      if (touchTimer) {
        window.clearTimeout(touchTimer);
        touchTimer = null;
      }
    });
  }
}
