/**
 * Task Reminder Plugin - Settings Module
 * 根据 SPEC.md §2.2 配置项定义
 */

import { App, PluginSettingTab, Setting, Notice, TFolder, TFile, AbstractInputSuggest, TAbstractFile } from 'obsidian';
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
  /** F6: 移动任务前显示确认对话框 */
  confirmBeforeMove: boolean;
  /** F6: 是否允许移动任务到过去日期 */
  allowMoveToPast: boolean;
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
  lastReminderDate: '',
  confirmBeforeMove: true,
  allowMoveToPast: false
};

/**
 * 文件夹路径自动补全建议器
 */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(inputStr: string): TFolder[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();

    abstractFiles.forEach((folder: TAbstractFile) => {
      if (
        folder instanceof TFolder &&
        folder.path.toLowerCase().includes(lowerCaseInputStr)
      ) {
        folders.push(folder);
      }
    });

    // 按路径长度排序，优先显示较短的路径
    return folders.sort((a, b) => a.path.length - b.path.length).slice(0, 20);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.createEl('div', { text: folder.path, cls: 'suggestion-content' });
  }

  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    this.inputEl.trigger('input');
    this.close();
  }
}

/**
 * 文件路径自动补全建议器（用于 .md 文件）
 */
class FileSuggest extends AbstractInputSuggest<TFile> {
  private inputEl: HTMLInputElement;
  private extension: string;

  constructor(app: App, inputEl: HTMLInputElement, extension: string = 'md') {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.extension = extension;
  }

  getSuggestions(inputStr: string): TFile[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const files: TFile[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();

    abstractFiles.forEach((file: TAbstractFile) => {
      if (
        file instanceof TFile &&
        file.extension === this.extension &&
        file.path.toLowerCase().includes(lowerCaseInputStr)
      ) {
        files.push(file);
      }
    });

    // 按路径长度排序，优先显示较短的路径
    return files.sort((a, b) => a.path.length - b.path.length).slice(0, 20);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl('div', { text: file.path, cls: 'suggestion-content' });
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    this.inputEl.trigger('input');
    this.close();
  }
}

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

    // Daily Note 路径（带自动补全）
    new Setting(containerEl)
      .setName('Daily Note 路径')
      .setDesc('Daily Note 文件夹路径（输入时自动搜索）')
      .addText(text => {
        text
          .setPlaceholder('输入搜索文件夹...')
          .setValue(this.plugin.settings.dailyNotePath)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotePath = value;
            await this.plugin.saveSettings();
          });
        // 添加文件夹自动补全
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('包含 Daily Note 任务')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.taskSources.daily)
        .onChange(async (value) => {
          this.plugin.settings.taskSources.daily = value;
          await this.plugin.saveSettings();
        }));

    // Nike 日历路径（带自动补全）
    new Setting(containerEl)
      .setName('Nike 日历路径')
      .setDesc('Nike 项目日历文件夹路径（输入时自动搜索）')
      .addText(text => {
        text
          .setPlaceholder('输入搜索文件夹...')
          .setValue(this.plugin.settings.nikePath)
          .onChange(async (value) => {
            this.plugin.settings.nikePath = value;
            await this.plugin.saveSettings();
          });
        // 添加文件夹自动补全
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('包含 Nike 项目任务')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.taskSources.nike)
        .onChange(async (value) => {
          this.plugin.settings.taskSources.nike = value;
          await this.plugin.saveSettings();
        }));

    // 周期任务配置文件（带文件自动补全）
    new Setting(containerEl)
      .setName('周期任务配置文件')
      .setDesc('周期任务配置表格所在的 .md 文件（输入时自动搜索）')
      .addText(text => {
        text
          .setPlaceholder('输入搜索文件...')
          .setValue(this.plugin.settings.recurringConfigPath)
          .onChange(async (value) => {
            this.plugin.settings.recurringConfigPath = value;
            await this.plugin.saveSettings();
          });
        // 添加文件自动补全（限 .md 文件）
        new FileSuggest(this.app, text.inputEl, 'md');
      });

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

    // 任务移动设置 (F6)
    containerEl.createEl('h2', { text: '任务移动设置' });

    new Setting(containerEl)
      .setName('移动前确认')
      .setDesc('移动任务到其他日期前显示确认对话框')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.confirmBeforeMove)
        .onChange(async (value) => {
          this.plugin.settings.confirmBeforeMove = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('允许移动到过去')
      .setDesc('允许将任务移动到过去的日期')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.allowMoveToPast)
        .onChange(async (value) => {
          this.plugin.settings.allowMoveToPast = value;
          await this.plugin.saveSettings();
        }));
  }
}
