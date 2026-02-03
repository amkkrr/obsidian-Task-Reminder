/**
 * Holiday 节假日任务数据源
 * 根据 SPEC.md §3.3 定义
 */

import { App, moment } from 'obsidian';
import { TaskReminderSettings } from '../settings';
import { TaskItem, DataviewApi, SOURCE_LABELS } from '../types';

export class HolidayTaskSource {
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
   * 获取今日节假日任务
   */
  async getTasks(dv: DataviewApi): Promise<TaskItem[]> {
    const tasks: TaskItem[] = [];
    const todayStr = moment().format('YYYY-MM-DD');
    const today = moment().startOf('day');

    try {
      // 使用 Dataview 查询所有节假日页面
      const pages = dv.pages()
        .where((p: any) => {
          // 检查 #holiday 标签
          const tags = p.file?.tags || [];
          if (tags.includes('#holiday')) return true;

          // 检查 type: holiday
          if (p.type === 'holiday') return true;

          // 检查 type 数组包含 holiday
          if (Array.isArray(p.type) && p.type.includes('holiday')) return true;

          return false;
        })
        .array();

      for (const page of pages) {
        // 解析日期（优先级：p.date > p.file.day > p.file.name）
        const pageDate = this.resolveDateFromPage(page);

        // 只包含今天的节假日（不含过期）
        if (pageDate && pageDate.isSame(today, 'day')) {
          const filePath = page.file?.path || '';
          const fileName = page.name || page.file?.name || '';

          tasks.push({
            id: `${filePath}:0`,
            source: 'holiday',
            sourceLabel: SOURCE_LABELS.holiday,
            text: fileName,
            fullText: fileName,
            isMeeting: false,
            filePath,
            line: 0,
            dueDate: todayStr
          });
        }
      }
    } catch (e) {
      console.error('[TaskReminder] Error querying holiday tasks:', e);
      throw e;
    }

    return tasks;
  }

  /**
   * 从页面解析日期
   * 优先级：p.date > p.file.day > p.file.name
   */
  private resolveDateFromPage(page: any): moment.Moment | null {
    // 1. p.date frontmatter 字段
    if (page.date) {
      const parsed = this.parseDate(page.date);
      if (parsed) return parsed;
    }

    // 2. p.file.day（Daily Notes 格式）
    if (page.file?.day) {
      const parsed = this.parseDate(page.file.day);
      if (parsed) return parsed;
    }

    // 3. p.file.name（尝试解析文件名为日期）
    if (page.file?.name) {
      const parsed = moment(page.file.name, ['YYYY-MM-DD', 'YYYY/MM/DD'], true);
      if (parsed.isValid()) return parsed;
    }

    return null;
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
