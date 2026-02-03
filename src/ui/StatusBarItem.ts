/**
 * Status Bar Item - 状态栏组件
 * 根据 SPEC.md §2.1/F3 定义
 */

import { App } from 'obsidian';
import { TaskDataService } from '../services/TaskDataService';

export class StatusBarItem {
  private app: App;
  private element: HTMLElement;
  private dataService: TaskDataService;
  private onClick: () => void;

  constructor(
    app: App,
    element: HTMLElement,
    dataService: TaskDataService,
    onClick: () => void
  ) {
    this.app = app;
    this.element = element;
    this.dataService = dataService;
    this.onClick = onClick;

    this.setup();
  }

  /**
   * 初始化状态栏项
   */
  private setup(): void {
    this.element.addClass('task-reminder-status');
    this.element.setText('📋 ...');
    this.element.setAttribute('aria-label', '加载中...');

    // 点击事件
    this.element.onClickEvent(() => {
      this.onClick();
    });
  }

  /**
   * 更新显示
   */
  async update(): Promise<void> {
    // 检查 Dataview 是否可用
    const dvApi = (this.app as any).plugins?.plugins?.dataview?.api;
    if (!dvApi) {
      this.element.setText('📋 ?');
      this.element.setAttribute('aria-label', '需要 Dataview 插件');
      return;
    }

    try {
      const count = await this.dataService.getTaskCount();
      this.element.setText(`📋 ${count}`);
      this.element.setAttribute('aria-label', `今日待办: ${count} 项`);

      // 根据数量设置样式
      this.element.removeClass('has-tasks', 'no-tasks');
      if (count > 0) {
        this.element.addClass('has-tasks');
      } else {
        this.element.addClass('no-tasks');
      }
    } catch (e) {
      console.error('[TaskReminder] Status bar update failed:', e);
      this.element.setText('📋 !');
      this.element.setAttribute('aria-label', '获取任务失败');
    }
  }

  /**
   * 设置加载状态
   */
  setLoading(): void {
    this.element.setText('📋 ...');
    this.element.setAttribute('aria-label', '加载中...');
  }
}
