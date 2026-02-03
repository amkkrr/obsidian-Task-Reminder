/**
 * Reminder Modal - 任务提醒弹窗
 * 根据 SPEC.md §4.6 定义
 */

import { App, Modal, TFile } from 'obsidian';
import { TaskItem } from '../types';

export class ReminderModal extends Modal {
  private tasks: TaskItem[];

  constructor(app: App, tasks: TaskItem[]) {
    super(app);
    this.tasks = tasks;
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

        // 点击跳转到文件
        itemEl.addEventListener('click', () => this.navigateToTask(task));
        itemEl.style.cursor = 'pointer';
        itemEl.setAttribute('title', task.fullText);
      }
    }

    // 底部按钮
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
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
   * 检查是否过期
   */
  private isOverdue(dueDate: string): boolean {
    const today = new Date().toISOString().split('T')[0];
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
}
