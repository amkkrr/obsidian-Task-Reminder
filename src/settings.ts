/**
 * Task Reminder Plugin - Settings Module
 * 根据 SPEC.md §2.2 配置项定义
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type TaskReminderPlugin from './main';

/** 提醒样式类型 */
export type ReminderStyle = 'both' | 'notice' | 'modal';

/** 任务来源开关 */
export interface TaskSourcesSettings {
  daily: boolean;
  nike: boolean;
  holiday: boolean;
  recurring: boolean;
}

/** 插件设置接口 */
export interface TaskReminderSettings {
  /** 是否启用自动提醒 */
  enabled: boolean;
  /** 启动后延迟弹窗时间（毫秒） */
  popupDelay: number;
  /** Notice 通知显示时长（毫秒） */
  popupDuration: number;
  /** 提醒样式 */
  reminderStyle: ReminderStyle;
  /** 是否显示状态栏指示器 */
  showStatusBar: boolean;
  /** 任务来源开关 */
  taskSources: TaskSourcesSettings;
  /** Daily Note 文件夹路径 */
  dailyNotePath: string;
  /** Nike 日历文件夹路径 */
  nikePath: string;
  /** 周期任务配置文件路径 */
  recurringConfigPath: string;
  /** 上次提醒日期（用于防重复） */
  lastReminderDate: string;
}

/** 默认设置 */
export const DEFAULT_SETTINGS: TaskReminderSettings = {
  enabled: true,
  popupDelay: 30000,
  popupDuration: 8000,
  reminderStyle: 'both',
  showStatusBar: true,
  taskSources: {
    daily: true,
    nike: true,
    holiday: true,
    recurring: true
  },
  dailyNotePath: '',
  nikePath: '',
  recurringConfigPath: '',
  lastReminderDate: ''
};

/** 设置面板 */
export class TaskReminderSettingTab extends PluginSettingTab {
  plugin: TaskReminderPlugin;

  constructor(app: App, plugin: TaskReminderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 检查 Dataview 是否可用
    const dvApi = (this.app as any).plugins?.plugins?.dataview?.api;
    if (!dvApi) {
      const warningEl = containerEl.createDiv({ cls: 'task-reminder-warning' });
      warningEl.createEl('p', {
        text: '⚠️ 需要安装并启用 Dataview 插件',
        cls: 'mod-warning'
      });
      const linkEl = warningEl.createEl('a', {
        text: '查看安装指南',
        href: 'https://github.com/blacksmithgu/obsidian-dataview'
      });
      linkEl.setAttr('target', '_blank');
    }

    // 基础设置
    containerEl.createEl('h2', { text: '基础设置' });

    new Setting(containerEl)
      .setName('启用自动提醒')
      .setDesc('Obsidian 启动时自动显示今日任务提醒')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enabled)
        .onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('延迟时间（秒）')
      .setDesc('启动后等待多少秒再弹窗（建议等待同步完成）')
      .addSlider(slider => slider
        .setLimits(5, 120, 5)
        .setValue(this.plugin.settings.popupDelay / 1000)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.popupDelay = value * 1000;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('通知显示时长（秒）')
      .setDesc('Notice 通知在屏幕上显示的时间')
      .addSlider(slider => slider
        .setLimits(3, 30, 1)
        .setValue(this.plugin.settings.popupDuration / 1000)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.popupDuration = value * 1000;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('提醒样式')
      .setDesc('选择提醒的显示方式')
      .addDropdown(dropdown => dropdown
        .addOption('both', '两者都显示')
        .addOption('notice', '仅通知栏')
        .addOption('modal', '仅弹窗')
        .setValue(this.plugin.settings.reminderStyle)
        .onChange(async (value: ReminderStyle) => {
          this.plugin.settings.reminderStyle = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('显示状态栏指示器')
      .setDesc('在状态栏显示今日待办数量')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showStatusBar)
        .onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
          new Notice('需要重启 Obsidian 以应用状态栏设置');
        }));

    // 数据源配置
    containerEl.createEl('h2', { text: '数据源配置' });

    new Setting(containerEl)
      .setName('Daily Note 路径')
      .setDesc('Daily Note 文件夹路径（如：00 - Daily Plan）')
      .addText(text => text
        .setPlaceholder('00 - Daily Plan')
        .setValue(this.plugin.settings.dailyNotePath)
        .onChange(async (value) => {
          this.plugin.settings.dailyNotePath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含 Daily Note 任务')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.taskSources.daily)
        .onChange(async (value) => {
          this.plugin.settings.taskSources.daily = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Nike 日历路径')
      .setDesc('Nike 项目日历文件夹路径')
      .addText(text => text
        .setPlaceholder('03 - Working/01.Nike/03.Nike Calendar')
        .setValue(this.plugin.settings.nikePath)
        .onChange(async (value) => {
          this.plugin.settings.nikePath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含 Nike 项目任务')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.taskSources.nike)
        .onChange(async (value) => {
          this.plugin.settings.taskSources.nike = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('周期任务配置文件')
      .setDesc('周期任务配置表格所在的文件路径')
      .addText(text => text
        .setPlaceholder('06 - DATA FILE/recurring-tasks.md')
        .setValue(this.plugin.settings.recurringConfigPath)
        .onChange(async (value) => {
          this.plugin.settings.recurringConfigPath = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含周期任务')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.taskSources.recurring)
        .onChange(async (value) => {
          this.plugin.settings.taskSources.recurring = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含节假日')
      .setDesc('包含带有 #holiday 标签或 type: holiday 的任务')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.taskSources.holiday)
        .onChange(async (value) => {
          this.plugin.settings.taskSources.holiday = value;
          await this.plugin.saveSettings();
        }));
  }
}
