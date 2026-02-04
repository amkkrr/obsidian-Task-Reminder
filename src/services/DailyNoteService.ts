/**
 * Daily Note 写入服务
 * 用于 F4 周期任务生成、F5 快速添加、F6 移动任务功能
 */

import { App, TFile, TFolder, moment, Notice } from 'obsidian';
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
   * 修复 P0-2：路径规范化处理
   */
  getDailyNotePath(): string {
    return this.getDailyNotePathForDate(moment());
  }

  /**
   * 获取指定日期的 Daily Note 路径（F5/F6 使用）
   * @param date 目标日期
   */
  getDailyNotePathForDate(date: moment.Moment): string {
    let dailyPath = this.settings.dailyNotePath?.trim() || '';
    // 去掉尾随斜杠，避免 //
    dailyPath = dailyPath.replace(/\/+$/, '');

    const year = date.format('YYYY');
    const month = date.month() + 1;
    const dateStr = date.format('YYYY-MM-DD');

    return `${dailyPath}/${year}/${this.monthNames[month]}/${dateStr}.md`;
  }

  /**
   * 检查 dailyNotePath 是否已配置
   */
  isDailyNotePathConfigured(): boolean {
    return !!this.settings.dailyNotePath?.trim();
  }

  /**
   * F5: 写入单个任务到指定日期的 Daily Note
   * @param content 任务内容（不含 `- [ ]` 前缀）
   * @param date 目标日期
   */
  async writeTask(content: string, date: moment.Moment): Promise<void> {
    if (!this.isDailyNotePathConfigured()) {
      throw new Error('请先在设置中配置 Daily Note 路径');
    }

    const taskLine = `- [ ] ${content}`;
    await this.writeTaskLine(taskLine, date);
  }

  /**
   * F6: 写入完整任务行到指定日期（用于移动任务）
   * @param taskLine 完整任务行（如 `- [ ] 任务内容`）
   * @param date 目标日期
   */
  async writeTaskLine(taskLine: string, date: moment.Moment): Promise<void> {
    if (!this.isDailyNotePathConfigured()) {
      throw new Error('请先在设置中配置 Daily Note 路径');
    }

    const dailyPath = this.getDailyNotePathForDate(date);
    let file = this.app.vault.getAbstractFileByPath(dailyPath);

    // 如果文件不存在，创建它
    if (!file) {
      file = await this.createDailyNoteForDate(dailyPath, date);
    }

    if (!(file instanceof TFile)) {
      throw new Error(`无法访问日记文件: ${dailyPath}`);
    }

    // 读取现有内容
    let fileContent = await this.app.vault.read(file);

    // 追加到文件末尾
    if (fileContent.length > 0 && !fileContent.endsWith('\n')) {
      fileContent += '\n';
    }
    fileContent += taskLine + '\n';

    await this.app.vault.modify(file, fileContent);
  }

  /**
   * 创建指定日期的 Daily Note（F5/F6 使用）
   * P0-1: 统一调用 createDailyNoteWithTemplate
   */
  private async createDailyNoteForDate(path: string, date: moment.Moment): Promise<TFile> {
    return await this.createDailyNoteWithTemplate(path, date);
  }

  /**
   * 将周期任务写入 Daily Note
   * @param tasks 待生成的周期任务列表
   * @returns 成功写入的任务数量
   * 修复 P0-2：写入前校验 dailyNotePath
   * 修复 P1-3：添加去重和二次确认
   */
  async writeRecurringTasks(tasks: PendingRecurringTask[]): Promise<number> {
    if (tasks.length === 0) {
      return 0;
    }

    // P0-2: 校验 dailyNotePath 是否已配置
    if (!this.isDailyNotePathConfigured()) {
      throw new Error('请先在设置中配置 Daily Note 路径');
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

    // P1-3: 写入前重新读取内容，确保获取最新状态
    let content = await this.app.vault.read(file);

    // P1-3: 对输入任务按名称去重
    const uniqueTasks = this.deduplicateTasks(tasks);

    // P1-3: 过滤掉已存在于文件中的任务
    const tasksToWrite = uniqueTasks.filter(task => {
      const taskPattern = new RegExp(`- \\[.\\] 🔄\\s+${this.escapeRegex(task.name)}`, 'i');
      return !taskPattern.test(content);
    });

    if (tasksToWrite.length === 0) {
      return 0;
    }

    // 生成任务文本
    const taskLines = tasksToWrite.map(task => `- [ ] 🔄 ${task.name}`).join('\n');

    // 追加到文件末尾
    if (content.length > 0 && !content.endsWith('\n')) {
      content += '\n';
    }
    content += '\n' + taskLines + '\n';

    // 写入文件
    await this.app.vault.modify(file, content);

    return tasksToWrite.length;
  }

  /**
   * 对任务按名称去重
   */
  private deduplicateTasks(tasks: PendingRecurringTask[]): PendingRecurringTask[] {
    const seen = new Set<string>();
    return tasks.filter(task => {
      if (seen.has(task.name)) {
        return false;
      }
      seen.add(task.name);
      return true;
    });
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 创建 Daily Note 文件（F4 使用）
   * P0-1: 统一调用 createDailyNoteWithTemplate
   */
  private async createDailyNote(path: string): Promise<TFile> {
    return await this.createDailyNoteWithTemplate(path, moment());
  }

  /**
   * F7: 使用模板创建 Daily Note
   * 统一创建入口，F4/F5/F6 均调用此方法
   */
  private async createDailyNoteWithTemplate(
    path: string,
    date: moment.Moment
  ): Promise<TFile> {
    // 1. 确保目录存在
    const folderPath = path.substring(0, path.lastIndexOf('/'));
    await this.ensureFolderExists(folderPath);

    // 2. 获取模板内容
    let content: string;
    const templatePath = this.settings.dailyNoteTemplatePath?.trim();

    if (templatePath) {
      const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
      if (templateFile instanceof TFile) {
        // P0-4: 模板读取失败降级处理
        try {
          const templateContent = await this.app.vault.read(templateFile);
          content = this.processTemplate(templateContent, date);
        } catch (error) {
          console.error(`[TaskReminder] 模板读取失败: ${error}`);
          new Notice(`模板读取失败，使用默认模板: ${error}`, 5000);
          content = this.getDefaultTemplate(date);
        }
      } else {
        // 模板文件不存在，使用默认模板并警告
        console.warn(`[TaskReminder] 模板文件不存在: ${templatePath}`);
        new Notice(`模板文件不存在，使用默认模板: ${templatePath}`, 5000);
        content = this.getDefaultTemplate(date);
      }
    } else {
      // 未配置模板，使用默认
      content = this.getDefaultTemplate(date);
    }

    return await this.app.vault.create(path, content);
  }

  /**
   * F7: 处理模板变量
   */
  private processTemplate(template: string, date: moment.Moment): string {
    // P1-2: 固定英文星期映射表（不受 locale 影响）
    const dayEnMap: Record<number, string> = {
      0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
      4: 'Thursday', 5: 'Friday', 6: 'Saturday'
    };
    const dayZhMap: Record<number, string> = {
      0: '星期日', 1: '星期一', 2: '星期二', 3: '星期三',
      4: '星期四', 5: '星期五', 6: '星期六'
    };

    return template
      // 自定义日期格式 {{date:FORMAT}}
      .replace(/\{\{date:([^}]+)\}\}/g, (_, format) => date.format(format))
      // 基础变量
      .replace(/\{\{date\}\}/g, date.format('YYYY-MM-DD'))
      .replace(/\{\{day\}\}/g, dayEnMap[date.day()])  // 使用映射表确保英文
      .replace(/\{\{day:zh\}\}/g, dayZhMap[date.day()])
      .replace(/\{\{time\}\}/g, moment().format('HH:mm'))  // P1-3: 创建时刻
      .replace(/\{\{title\}\}/g, date.format('YYYY-MM-DD'));
  }

  /**
   * F7: 默认模板（向后兼容）
   */
  private getDefaultTemplate(date: moment.Moment): string {
    const dateStr = date.format('YYYY-MM-DD');
    const dayOfWeek = date.format('dddd');
    return `---
date: ${dateStr}
day: ${dayOfWeek}
---

# ${dateStr}

`;
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
