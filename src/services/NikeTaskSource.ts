/**
 * Nike 项目任务数据源
 * 根据 SPEC.md §3.2 定义
 */

import { App, moment } from 'obsidian';
import { TaskReminderSettings } from '../settings';
import { TaskItem, DataviewApi, SOURCE_LABELS } from '../types';

export class NikeTaskSource {
  private app: App;
  private settings: TaskReminderSettings;

  constructor(app: App, settings: TaskReminderSettings) {
    this.app = app;
    this.settings = settings;
  }

  updateSettings(settings: TaskReminderSettings): void {
    this.settings = settings;
  }

  /**
   * 获取 Nike 项目中的待办事件
   */
  async getTasks(dv: DataviewApi): Promise<TaskItem[]> {
    const nikePath = this.settings.nikePath;
    if (!nikePath) {
      return [];
    }

    // 检查路径是否存在
    const folder = this.app.vault.getAbstractFileByPath(nikePath);
    if (!folder) {
      console.warn(`[TaskReminder] Nike path not found: ${nikePath}`);
      return [];
    }

    const tasks: TaskItem[] = [];
    const today = moment().startOf('day');

    try {
      // 使用 Dataview 查询
      const pages = dv.pages(`"${nikePath}"`)
        .where((p: any) => {
          // 文件夹路径包含 events
          const pathParts = (p.file?.folder || '').split('/');
          return pathParts.some((part: string) => part.toLowerCase() === 'events');
        })
        .where((p: any) => {
          // Done 字段存在且不为 true
          const frontmatter = p.file?.frontmatter || p;
          return 'Done' in frontmatter && frontmatter.Done !== true;
        })
        .array();

      for (const page of pages) {
        // 解析 Due Date
        const dueDate = page['Due Date'];
        const parsedDate = this.parseDate(dueDate);

        // 只包含今天或之前的任务
        if (parsedDate && parsedDate.isSameOrBefore(today, 'day')) {
          const filePath = page.file?.path || '';
          const fileName = page.file?.name || '';
          const dueDateStr = parsedDate.format('YYYY-MM-DD');

          tasks.push({
            id: `${filePath}:0`,
            source: 'nike',
            sourceLabel: SOURCE_LABELS.nike,
            text: fileName,
            fullText: fileName,
            isMeeting: false,
            filePath,
            line: 0,
            dueDate: dueDateStr
          });
        }
      }
    } catch (e) {
      console.error('[TaskReminder] Error querying Nike tasks:', e);
      throw e;
    }

    return tasks;
  }

  /**
   * 解析日期值
   */
  private parseDate(dateValue: any): moment.Moment | null {
    if (!dateValue) return null;

    // Dataview 日期对象
    if (dateValue.ts) {
      return moment(dateValue.ts);
    }

    // 字符串日期
    if (typeof dateValue === 'string') {
      const parsed = moment(dateValue, ['YYYY-MM-DD', 'YYYY/MM/DD'], true);
      return parsed.isValid() ? parsed : null;
    }

    // 其他类型
    const parsed = moment(dateValue);
    return parsed.isValid() ? parsed : null;
  }
}
