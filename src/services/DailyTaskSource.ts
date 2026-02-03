/**
 * Daily Note 任务数据源
 * 根据 SPEC.md §3.1 定义
 */

import { App, moment } from 'obsidian';
import { TaskReminderSettings } from '../settings';
import { TaskItem, DataviewApi, SOURCE_LABELS } from '../types';

export class DailyTaskSource {
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
   * 获取 Daily Note 中的未完成任务
   */
  async getTasks(dv: DataviewApi): Promise<TaskItem[]> {
    const dailyPath = this.settings.dailyNotePath;
    if (!dailyPath) {
      return [];
    }

    // 检查路径是否存在
    const folder = this.app.vault.getAbstractFileByPath(dailyPath);
    if (!folder) {
      console.warn(`[TaskReminder] Daily Note path not found: ${dailyPath}`);
      return [];
    }

    const tasks: TaskItem[] = [];
    const todayStr = moment().format('YYYY-MM-DD');
    const today = moment().startOf('day');

    try {
      // 使用 Dataview 查询
      const pages = dv.pages(`"${dailyPath}"`);
      const allTasks = pages.file.tasks
        .where((t: any) => !t.completed && !t.checked)
        .array();

      for (const task of allTasks) {
        // 从文件路径提取日期
        const filePath = task.path || task.link?.path || '';
        const fileName = filePath.split('/').pop()?.replace('.md', '') || '';
        const fileDate = moment(fileName, 'YYYY-MM-DD', true);

        // 只包含今天或之前的任务（包含过期）
        if (fileDate.isValid() && fileDate.isSameOrBefore(today, 'day')) {
          const isMeeting = this.isMeetingTask(task.tags || []);
          const fullText = task.text || '';
          const text = this.truncateText(fullText, 60);

          tasks.push({
            id: `${filePath}:${task.line}`,
            source: 'daily',
            sourceLabel: SOURCE_LABELS.daily,
            text,
            fullText,
            isMeeting,
            filePath,
            line: task.line,
            dueDate: fileName
          });
        }
      }
    } catch (e) {
      console.error('[TaskReminder] Error querying daily tasks:', e);
      throw e;
    }

    return tasks;
  }

  /**
   * 检查是否为会议任务
   * 匹配: #meeting, #Meeting, #team-meeting 等
   */
  private isMeetingTask(tags: string[]): boolean {
    return tags.some(tag =>
      tag.toLowerCase().includes('meeting')
    );
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    // 移除任务标记和标签
    let cleaned = text
      .replace(/^[\s-]*\[.\]\s*/, '') // 移除任务标记
      .replace(/#\S+/g, '')           // 移除标签
      .trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength - 3) + '...';
  }
}
