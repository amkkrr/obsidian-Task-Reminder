/**
 * Task Data Service - 统一数据获取服务
 * 根据 SPEC.md §4.4.1 定义
 */

import { App } from 'obsidian';
import { TaskReminderSettings } from '../settings';
import { TaskItem, TaskDataResult, TaskSourceError, DataviewApi, PendingRecurringTask } from '../types';
import { DailyTaskSource } from './DailyTaskSource';
import { NikeTaskSource } from './NikeTaskSource';
import { HolidayTaskSource } from './HolidayTaskSource';
import { RecurringTaskSource } from './RecurringTaskSource';

/** 缓存配置 */
const CACHE_TTL = 60000; // 60秒

export class TaskDataService {
  private app: App;
  private settings: TaskReminderSettings;
  private cache: TaskDataResult | null = null;
  private cacheTime: number = 0;

  private dailySource: DailyTaskSource;
  private nikeSource: NikeTaskSource;
  private holidaySource: HolidayTaskSource;
  private recurringSource: RecurringTaskSource;

  constructor(app: App, settings: TaskReminderSettings) {
    this.app = app;
    this.settings = settings;

    this.dailySource = new DailyTaskSource(app, settings);
    this.nikeSource = new NikeTaskSource(app, settings);
    this.holidaySource = new HolidayTaskSource(app, settings);
    this.recurringSource = new RecurringTaskSource(app, settings);
  }

  /** 获取 Dataview API */
  private getDataviewApi(): DataviewApi | null {
    return (this.app as any).plugins?.plugins?.dataview?.api || null;
  }

  /** 检查缓存是否有效 */
  private isCacheValid(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTime) < CACHE_TTL;
  }

  /** 清除缓存 */
  public invalidateCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  /** 更新设置引用 */
  public updateSettings(settings: TaskReminderSettings): void {
    this.settings = settings;
    this.dailySource.updateSettings(settings);
    this.nikeSource.updateSettings(settings);
    this.holidaySource.updateSettings(settings);
    this.recurringSource.updateSettings(settings);
    this.invalidateCache();
  }

  /**
   * 获取今日所有任务
   */
  async getTodayTasks(): Promise<TaskItem[]> {
    const result = await this.getTaskData();
    return result.tasks;
  }

  /**
   * 获取今日任务数量
   */
  async getTaskCount(): Promise<number> {
    const result = await this.getTaskData();
    return result.tasks.length;
  }

  /**
   * 获取完整数据结果（含分类统计）
   */
  async getTaskData(): Promise<TaskDataResult> {
    // 检查缓存
    if (this.isCacheValid() && this.cache) {
      return this.cache;
    }

    const dv = this.getDataviewApi();
    if (!dv) {
      return {
        tasks: [],
        dailyCount: 0,
        nikeCount: 0,
        holidayCount: 0,
        recurringCount: 0,
        errors: [{
          source: 'dataview',
          message: '需要安装并启用 Dataview 插件',
          recoverable: false
        }]
      };
    }

    const allTasks: TaskItem[] = [];
    const errors: TaskSourceError[] = [];

    // 获取 Daily Note 任务
    if (this.settings.taskSources.daily) {
      try {
        const dailyTasks = await this.dailySource.getTasks(dv);
        allTasks.push(...dailyTasks);
      } catch (e) {
        console.warn('[TaskReminder] Daily tasks query failed:', e);
        errors.push({
          source: 'daily',
          message: e instanceof Error ? e.message : String(e),
          recoverable: true
        });
      }
    }

    // 获取 Nike 项目任务
    if (this.settings.taskSources.nike) {
      try {
        const nikeTasks = await this.nikeSource.getTasks(dv);
        allTasks.push(...nikeTasks);
      } catch (e) {
        console.warn('[TaskReminder] Nike tasks query failed:', e);
        errors.push({
          source: 'nike',
          message: e instanceof Error ? e.message : String(e),
          recoverable: true
        });
      }
    }

    // 获取节假日任务
    if (this.settings.taskSources.holiday) {
      try {
        const holidayTasks = await this.holidaySource.getTasks(dv);
        allTasks.push(...holidayTasks);
      } catch (e) {
        console.warn('[TaskReminder] Holiday tasks query failed:', e);
        errors.push({
          source: 'holiday',
          message: e instanceof Error ? e.message : String(e),
          recoverable: true
        });
      }
    }

    // 获取周期任务
    if (this.settings.taskSources.recurring) {
      try {
        const recurringTasks = await this.recurringSource.getTasks(dv);
        allTasks.push(...recurringTasks);
      } catch (e) {
        console.warn('[TaskReminder] Recurring tasks query failed:', e);
        errors.push({
          source: 'recurring',
          message: e instanceof Error ? e.message : String(e),
          recoverable: true
        });
      }
    }

    // 计算各来源数量
    const result: TaskDataResult = {
      tasks: allTasks,
      dailyCount: allTasks.filter(t => t.source === 'daily').length,
      nikeCount: allTasks.filter(t => t.source === 'nike').length,
      holidayCount: allTasks.filter(t => t.source === 'holiday').length,
      recurringCount: allTasks.filter(t => t.source === 'recurring').length,
      errors
    };

    // 更新缓存
    this.cache = result;
    this.cacheTime = Date.now();

    return result;
  }

  /**
   * 获取待生成的周期任务（F4 功能）
   * 修复 P0-2：若 dailyNotePath 未配置，返回空数组
   */
  async getPendingRecurringTasks(): Promise<PendingRecurringTask[]> {
    if (!this.settings.taskSources.recurring) {
      return [];
    }

    // P0-2: 若 dailyNotePath 未配置，不返回待生成任务
    if (!this.settings.dailyNotePath?.trim()) {
      return [];
    }

    const dv = this.getDataviewApi();
    if (!dv) {
      return [];
    }

    try {
      const result = await this.recurringSource.getFullResult(dv);
      return result.pendingTasks;
    } catch (e) {
      console.warn('[TaskReminder] Failed to get pending recurring tasks:', e);
      return [];
    }
  }
}
