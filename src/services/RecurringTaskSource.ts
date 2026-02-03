/**
 * Recurring 周期任务数据源
 * 根据 SPEC.md §3.4 定义
 */

import { App, moment } from 'obsidian';
import { TaskReminderSettings } from '../settings';
import { TaskItem, DataviewApi, SOURCE_LABELS, RecurringTaskConfig, PendingRecurringTask, RecurringTaskResult } from '../types';

export class RecurringTaskSource {
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
   * 获取今日周期任务（仅返回已存在于 Daily Note 且未完成的任务）
   * 修复 P0-1：避免与 pendingTasks 重复展示
   */
  async getTasks(dv: DataviewApi): Promise<TaskItem[]> {
    // 复用 getFullResult，只返回已存在的任务部分
    const result = await this.getFullResult(dv);
    return result.tasks;
  }

  /**
   * 解析周期任务配置文件
   */
  private async parseConfigFile(configPath: string): Promise<RecurringTaskConfig[]> {
    const file = this.app.vault.getAbstractFileByPath(configPath);
    if (!file) {
      console.warn(`[TaskReminder] Recurring config file not found: ${configPath}`);
      return [];
    }

    const content = await this.app.vault.read(file as any);
    const configs: RecurringTaskConfig[] = [];

    // 解析表格
    // | 任务名称 | 类型 | 触发条件 | 模式 |
    const tableRegex = /\|\s*([^|]+)\s*\|\s*(daily|weekly|monthly)\s*\|\s*([^|]+)\s*\|\s*(replace|accumulate|skip)\s*\|/gi;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      const name = match[1].trim();
      const type = match[2].trim().toLowerCase() as 'daily' | 'weekly' | 'monthly';
      const trigger = match[3].trim();
      const mode = match[4].trim().toLowerCase();

      // 跳过表头
      if (name === '任务名称' || name.includes('---')) {
        continue;
      }

      configs.push({ name, type, trigger, mode });
    }

    return configs;
  }

  /**
   * 筛选今日应显示的任务
   */
  private filterTodayTasks(configs: RecurringTaskConfig[]): RecurringTaskConfig[] {
    const todayWeekday = moment().isoWeekday(); // 1-7 (周一-周日)
    const todayDay = moment().date();           // 1-31
    const todayMonth = moment().month() + 1;    // 1-12

    return configs.filter(config => {
      if (config.type === 'daily') {
        return true;
      }

      if (config.type === 'weekly') {
        return parseInt(config.trigger) === todayWeekday;
      }

      if (config.type === 'monthly') {
        // 解析 "1 (3,6,9,12)" 格式
        const monthlyMatch = config.trigger.match(/^(\d+)(?:\s*\(([^)]+)\))?$/);
        if (monthlyMatch) {
          const day = parseInt(monthlyMatch[1]);
          if (day !== todayDay) {
            return false;
          }

          // 检查月份限制
          if (monthlyMatch[2]) {
            const months = monthlyMatch[2].split(',').map(m => parseInt(m.trim()));
            return months.includes(todayMonth);
          }

          return true;
        }
      }

      return false;
    });
  }

  /**
   * 检查日记中周期任务的完成状态
   */
  private async checkDailyNoteStatus(configs: RecurringTaskConfig[]): Promise<Map<string, { existsInDaily: boolean; isCompleted: boolean }>> {
    const statusMap = new Map<string, { existsInDaily: boolean; isCompleted: boolean }>();

    const dailyPath = this.getDailyNotePath();
    const file = this.app.vault.getAbstractFileByPath(dailyPath);

    if (!file) {
      // 日记不存在，所有任务都视为不存在
      for (const config of configs) {
        statusMap.set(config.name, { existsInDaily: false, isCompleted: false });
      }
      return statusMap;
    }

    const content = await this.app.vault.read(file as any);

    for (const config of configs) {
      const name = config.name;

      // 检查未完成的任务
      const pendingRegex = new RegExp(`- \\[ \\] 🔄\\s+${this.escapeRegex(name)}`, 'i');
      // 检查已完成的任务
      const completedRegex = new RegExp(`- \\[x\\] 🔄\\s+${this.escapeRegex(name)}`, 'i');

      const isPending = pendingRegex.test(content);
      const isCompleted = completedRegex.test(content);

      statusMap.set(name, {
        existsInDaily: isPending || isCompleted,
        isCompleted
      });
    }

    return statusMap;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取完整的周期任务结果（包含待生成任务）
   * 用于 F4 功能
   */
  async getFullResult(dv: DataviewApi): Promise<RecurringTaskResult> {
    const configPath = this.settings.recurringConfigPath;
    if (!configPath) {
      return { tasks: [], pendingTasks: [] };
    }

    const tasks: TaskItem[] = [];
    const pendingTasks: PendingRecurringTask[] = [];
    const todayStr = moment().format('YYYY-MM-DD');

    try {
      // 1. 解析配置表
      const configs = await this.parseConfigFile(configPath);
      if (configs.length === 0) {
        return { tasks: [], pendingTasks: [] };
      }

      // 2. 筛选今日应显示的任务
      const todayConfigs = this.filterTodayTasks(configs);

      // 3. 检查日记中的完成状态
      const dailyStatus = await this.checkDailyNoteStatus(todayConfigs);

      // 4. 分类：已存在未完成 / 待生成
      for (const config of todayConfigs) {
        const status = dailyStatus.get(config.name);

        // 已完成，跳过
        if (status?.isCompleted) {
          continue;
        }

        // 已存在但未完成 → 加入任务列表
        if (status?.existsInDaily) {
          tasks.push({
            id: `recurring:${config.name}`,
            source: 'recurring',
            sourceLabel: SOURCE_LABELS.recurring,
            text: config.name,
            fullText: `🔄 ${config.name}`,
            isMeeting: false,
            filePath: this.getDailyNotePath(),
            line: undefined,
            dueDate: todayStr
          });
        } else {
          // 不存在 → 待生成
          pendingTasks.push({
            name: config.name,
            type: config.type,
            trigger: config.trigger
          });
        }
      }
    } catch (e) {
      console.error('[TaskReminder] Error querying recurring tasks:', e);
      throw e;
    }

    return { tasks, pendingTasks };
  }

  /**
   * 获取今日日记路径（公开方法，供写入服务使用）
   */
  getDailyNotePath(): string {
    const dailyPath = this.settings.dailyNotePath;
    const year = moment().format('YYYY');
    const month = moment().month() + 1;
    const dateStr = moment().format('YYYY-MM-DD');

    return `${dailyPath}/${year}/${this.monthNames[month]}/${dateStr}.md`;
  }
}
