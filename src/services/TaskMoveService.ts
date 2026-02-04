/**
 * TaskMoveService - F6 任务移动服务
 * 实现 Write-Then-Delete 一致性保证
 * 根据 SPEC.md v1.3.0 §2.1 F6 规格实现
 */

import { App, TFile, moment } from 'obsidian';
import { TaskItem, TaskMoveResult } from '../types';
import { TaskReminderSettings } from '../settings';
import { DailyNoteService } from './DailyNoteService';

export class TaskMoveService {
  private app: App;
  private dailyNoteService: DailyNoteService;
  private settings: TaskReminderSettings;

  constructor(app: App, dailyNoteService: DailyNoteService, settings: TaskReminderSettings) {
    this.app = app;
    this.dailyNoteService = dailyNoteService;
    this.settings = settings;
  }

  /**
   * 更新设置引用
   */
  updateSettings(settings: TaskReminderSettings): void {
    this.settings = settings;
  }

  /**
   * 移动任务到目标日期
   * 实现 Write-Then-Delete 一致性保证
   * @param task 要移动的任务
   * @param targetDate 目标日期
   */
  async moveTask(task: TaskItem, targetDate: moment.Moment): Promise<TaskMoveResult> {
    const fromPath = task.filePath;
    const toPath = this.dailyNoteService.getDailyNotePathForDate(targetDate);

    // 早返回：仅支持 daily 来源
    if (task.source !== 'daily') {
      throw new Error('仅支持移动 Daily Note 中的任务');
    }

    // 早返回：行号必须存在
    if (task.line === undefined) {
      throw new Error('任务行号信息缺失');
    }

    // 早返回：过去日期检查
    if (!this.settings.allowMoveToPast && targetDate.isBefore(moment(), 'day')) {
      throw new Error('不允许移动到过去日期');
    }

    // 早返回：不能移动到同一文件
    if (fromPath === toPath) {
      throw new Error('任务已在目标日期');
    }

    // 1. 读取原文件
    const fromFile = this.app.vault.getAbstractFileByPath(fromPath);
    if (!(fromFile instanceof TFile)) {
      throw new Error(`原文件不存在: ${fromPath}`);
    }

    const fromContent = await this.app.vault.read(fromFile);
    const lines = fromContent.split('\n');

    // 2. 获取任务行
    if (task.line >= lines.length) {
      throw new Error('任务行号超出文件范围');
    }
    const taskLine = lines[task.line];

    // 3. Write-Then-Delete: 先写入目标文件
    // 若失败则抛出异常，原文件不变
    await this.dailyNoteService.writeTaskLine(taskLine, targetDate);

    // 4. 写入成功后，删除源文件中的任务行
    try {
      lines.splice(task.line, 1);
      await this.app.vault.modify(fromFile, lines.join('\n'));
    } catch (deleteError) {
      // 删除失败时任务会重复，但数据不会丢失
      console.warn('[TaskMoveService] 删除源任务行失败，任务可能重复:', deleteError);
      return {
        success: true,
        fromPath,
        toPath,
        taskText: task.fullText,
        error: '任务已复制到目标日期，但源文件删除失败，请手动清理'
      };
    }

    return {
      success: true,
      fromPath,
      toPath,
      taskText: task.fullText
    };
  }

  /**
   * 检查任务是否可移动
   */
  canMoveTask(task: TaskItem): { canMove: boolean; reason?: string } {
    if (task.source !== 'daily') {
      return { canMove: false, reason: '仅支持移动 Daily Note 中的任务' };
    }
    if (task.line === undefined) {
      return { canMove: false, reason: '任务行号信息缺失' };
    }
    return { canMove: true };
  }
}
