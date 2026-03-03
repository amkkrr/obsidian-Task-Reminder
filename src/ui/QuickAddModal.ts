/**
 * QuickAddModal - F5 快速添加 Todo 弹窗
 * 根据 SPEC.md v1.3.0 §2.1 F5 规格实现
 */

import { App, Modal, Notice, moment } from 'obsidian';
import { DailyNoteService } from '../services/DailyNoteService';
import { DatePickerModal } from './DatePickerModal';

export class QuickAddModal extends Modal {
  private dailyNoteService: DailyNoteService;
  private inputEl: HTMLInputElement;
  private allowPastDates: boolean;
  private initialContent: string;

  constructor(app: App, dailyNoteService: DailyNoteService, allowPastDates: boolean = false, initialContent: string = '') {
    super(app);
    this.dailyNoteService = dailyNoteService;
    this.allowPastDates = allowPastDates;
    this.initialContent = initialContent;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;

    // 设置弹窗样式类
    this.modalEl.addClass('quick-add-modal');

    titleEl.setText('➕ 快速添加 Todo');

    // 输入框容器
    const inputContainer = contentEl.createDiv({ cls: 'quick-add-input-container' });
    this.inputEl = inputContainer.createEl('input', {
      type: 'text',
      placeholder: '输入任务内容...',
      cls: 'quick-add-input'
    });

    // 如果有初始内容，设置到输入框
    if (this.initialContent) {
      this.inputEl.value = this.initialContent;
      // 将光标放到内容末尾
      setTimeout(() => {
        this.inputEl.focus();
        this.inputEl.setSelectionRange(this.initialContent.length, this.initialContent.length);
      }, 10);
    } else {
      // 自动聚焦
      this.inputEl.focus();
    }

    // 快捷键支持
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd + Enter: 添加到今天
          this.addToDate(moment());
        } else {
          // Enter: 打开日期选择
          this.openDatePicker();
        }
      }
    });

    // 提示文字
    const hintEl = contentEl.createDiv({ cls: 'quick-add-hint' });
    hintEl.setText('提示：按 Enter 选择日期，Ctrl/Cmd+Enter 直接添加到今天');

    // 按钮区域
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const todayBtn = btnContainer.createEl('button', { text: '📅 今天' });
    todayBtn.addEventListener('click', () => this.addToDate(moment()));

    const pickDateBtn = btnContainer.createEl('button', { text: '🗓️ 选择日期...' });
    pickDateBtn.addClass('mod-cta');
    pickDateBtn.addEventListener('click', () => this.openDatePicker());
  }

  /**
   * 打开日期选择器
   */
  private openDatePicker(): void {
    const content = this.inputEl.value.trim();
    if (!content) {
      new Notice('请输入任务内容');
      this.inputEl.focus();
      return;
    }

    new DatePickerModal(this.app, {
      title: '选择目标日期',
      allowPastDates: this.allowPastDates,
      onSelect: (date) => this.addToDate(date),
    }).open();
  }

  /**
   * 添加任务到指定日期
   */
  private async addToDate(date: moment.Moment): Promise<void> {
    const content = this.inputEl.value.trim();
    if (!content) {
      new Notice('请输入任务内容');
      this.inputEl.focus();
      return;
    }

    try {
      await this.dailyNoteService.writeTask(content, date);
      new Notice(`✅ 已添加到 ${date.format('YYYY-MM-DD')}`);

      // 清空输入框，支持连续添加
      this.inputEl.value = '';
      this.inputEl.focus();
    } catch (e) {
      new Notice(`❌ 添加失败: ${(e as Error).message}`);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
