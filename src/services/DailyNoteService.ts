/**
 * Daily Note 写入服务
 * 用于 F4 周期任务生成功能
 */

import { App, TFile, TFolder, moment } from 'obsidian';
import { TaskReminderSettings } from '../settings';
import { PendingRecurringTask } from '../types';

export class DailyNoteService {
  private app: App;
  private settings: TaskReminderSettings;

  /** 月份名称映射 */
  private readonly monthNames = [
    '', '01.January', '02.February', '03.March', '04.April', '05.May', '06.June',
    '07.July', '08.August', '09.September', '10.October', '11.November', '12.December'
  ];

  constructor(app: App, settings: TaskReminderSettings) {
    this.app = app;
    this.settings = settings;
  }

  updateSettings(settings: TaskReminderSettings): void {
    this.settings = settings;
  }

  /**
   * 获取今日日记路径
   */
  getDailyNotePath(): string {
    const dailyPath = this.settings.dailyNotePath;
    const year = moment().format('YYYY');
    const month = moment().month() + 1;
    const dateStr = moment().format('YYYY-MM-DD');

    return `${dailyPath}/${year}/${this.monthNames[month]}/${dateStr}.md`;
  }

  /**
   * 将周期任务写入 Daily Note
   * @param tasks 待生成的周期任务列表
   * @returns 成功写入的任务数量
   */
  async writeRecurringTasks(tasks: PendingRecurringTask[]): Promise<number> {
    if (tasks.length === 0) {
      return 0;
    }

    const dailyPath = this.getDailyNotePath();
    let file = this.app.vault.getAbstractFileByPath(dailyPath);

    // 如果文件不存在，创建它
    if (!file) {
      file = await this.createDailyNote(dailyPath);
    }

    if (!(file instanceof TFile)) {
      throw new Error(`无法访问日记文件: ${dailyPath}`);
    }

    // 读取现有内容
    let content = await this.app.vault.read(file);

    // 生成任务文本
    const taskLines = tasks.map(task => `- [ ] 🔄 ${task.name}`).join('\n');

    // 追加到文件末尾
    if (content.length > 0 && !content.endsWith('\n')) {
      content += '\n';
    }
    content += '\n' + taskLines + '\n';

    // 写入文件
    await this.app.vault.modify(file, content);

    return tasks.length;
  }

  /**
   * 创建 Daily Note 文件（含基础 frontmatter）
   */
  private async createDailyNote(path: string): Promise<TFile> {
    // 确保目录存在
    const folderPath = path.substring(0, path.lastIndexOf('/'));
    await this.ensureFolderExists(folderPath);

    // 创建基础内容
    const dateStr = moment().format('YYYY-MM-DD');
    const dayOfWeek = moment().format('dddd');
    const content = `---
date: ${dateStr}
day: ${dayOfWeek}
---

# ${dateStr}

`;

    // 创建文件
    return await this.app.vault.create(path, content);
  }

  /**
   * 确保文件夹存在
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (folder instanceof TFolder) {
      return;
    }

    // 递归创建父目录
    const parts = folderPath.split('/');
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
}
