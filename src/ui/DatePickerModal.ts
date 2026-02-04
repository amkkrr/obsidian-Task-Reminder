/**
 * DatePickerModal - 共享日期选择组件
 * 用于 F5 快速添加 Todo 和 F6 移动任务日期
 * 根据 SPEC.md v1.3.0 §2.1 DatePickerModal 规格实现
 */

import { App, Modal, Notice, Platform } from 'obsidian';
import { DatePickerOptions, DateShortcut } from '../types';

export class DatePickerModal extends Modal {
  private options: DatePickerOptions;
  private selectedDate: moment.Moment;
  private currentMonth: moment.Moment;
  private calendarContainer: HTMLElement | null = null;

  /** 快捷选项（表驱动） */
  private readonly shortcuts: DateShortcut[] = [
    { label: '今天', getDate: () => moment() },
    { label: '明天', getDate: () => moment().add(1, 'day') },
    { label: '后天', getDate: () => moment().add(2, 'days') },
    { label: '下周一', getDate: () => moment().day(8) },
    { label: '下周六', getDate: () => moment().day(13) },
  ];

  constructor(app: App, options: DatePickerOptions) {
    super(app);
    this.options = options;
    this.selectedDate = options.initialDate?.clone() || moment();
    this.currentMonth = this.selectedDate.clone();
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;

    // 设置弹窗样式类
    this.modalEl.addClass('date-picker-modal');

    titleEl.setText(this.options.title || '选择日期');

    // 快捷选项区域
    const quickOptions = contentEl.createDiv({ cls: 'date-picker-quick-options' });
    for (const shortcut of this.shortcuts) {
      const btn = quickOptions.createEl('button', {
        text: shortcut.label,
        cls: 'date-picker-shortcut-btn'
      });
      btn.addEventListener('click', () => this.selectDate(shortcut.getDate()));
    }

    // 日历容器
    this.calendarContainer = contentEl.createDiv({ cls: 'date-picker-calendar' });
    this.renderCalendar();

    // 相对日期输入框
    const inputContainer = contentEl.createDiv({ cls: 'date-picker-input' });
    const inputLabel = inputContainer.createEl('label', { text: '快速输入：' });
    const input = inputContainer.createEl('input', {
      type: 'text',
      placeholder: '+3 或 2026-02-10',
      cls: 'date-picker-text-input'
    });
    inputLabel.appendChild(input);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const parsed = this.parseInput(input.value);
        if (parsed) {
          this.selectDate(parsed);
        } else {
          new Notice('无效的日期格式');
        }
      }
    });

    // 按钮区域
    const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancelBtn = btnContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => {
      this.options.onCancel?.();
      this.close();
    });

    // 移动端滑动手势支持
    if (Platform.isMobile) {
      this.setupSwipeGestures();
    }
  }

  /**
   * 渲染日历网格
   */
  private renderCalendar(): void {
    if (!this.calendarContainer) return;
    this.calendarContainer.empty();

    // 月份导航
    const nav = this.calendarContainer.createDiv({ cls: 'calendar-nav' });

    const prevBtn = nav.createEl('button', {
      text: '◀',
      cls: 'calendar-nav-btn',
      attr: { 'aria-label': '上个月' }
    });
    prevBtn.addEventListener('click', () => {
      this.currentMonth.subtract(1, 'month');
      this.renderCalendar();
    });

    const monthLabel = nav.createSpan({ cls: 'calendar-month-label' });
    monthLabel.setText(this.currentMonth.format('YYYY年 M月'));

    const nextBtn = nav.createEl('button', {
      text: '▶',
      cls: 'calendar-nav-btn',
      attr: { 'aria-label': '下个月' }
    });
    nextBtn.addEventListener('click', () => {
      this.currentMonth.add(1, 'month');
      this.renderCalendar();
    });

    // 星期标题行
    const weekHeader = this.calendarContainer.createDiv({ cls: 'calendar-week-header' });
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    for (const day of weekDays) {
      weekHeader.createSpan({ text: day, cls: 'calendar-week-day' });
    }

    // 日期网格
    const grid = this.calendarContainer.createDiv({ cls: 'calendar-grid' });
    const startOfMonth = this.currentMonth.clone().startOf('month');
    const endOfMonth = this.currentMonth.clone().endOf('month');
    const startDay = startOfMonth.isoWeekday(); // 1=周一, 7=周日

    // 填充月初空白
    for (let i = 1; i < startDay; i++) {
      grid.createDiv({ cls: 'calendar-day empty' });
    }

    // 渲染日期
    const today = moment().format('YYYY-MM-DD');
    const daysInMonth = endOfMonth.date() as number;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = this.currentMonth.clone().date(d);
      const dateStr = date.format('YYYY-MM-DD');
      const dayEl = grid.createDiv({
        cls: 'calendar-day',
        text: String(d)
      });

      // 今天高亮
      if (dateStr === today) {
        dayEl.addClass('is-today');
      }

      // 已选日期标记
      if (dateStr === this.selectedDate.format('YYYY-MM-DD')) {
        dayEl.addClass('is-selected');
      }

      // 过去日期处理
      if (dateStr < today && !this.options.allowPastDates) {
        dayEl.addClass('is-past');
      } else {
        dayEl.addEventListener('click', () => this.selectDate(date));
      }
    }
  }

  /**
   * 解析用户输入
   * 支持 +N 格式（如 +3 表示 3 天后）和 YYYY-MM-DD 格式
   */
  private parseInput(value: string): moment.Moment | null {
    value = value.trim();

    // 相对日期格式 +N
    if (value.startsWith('+')) {
      const days = parseInt(value.slice(1), 10);
      if (!isNaN(days) && days >= 0) {
        return moment().add(days, 'days');
      }
    }

    // 绝对日期格式 YYYY-MM-DD
    const parsed = moment(value, 'YYYY-MM-DD', true);
    if (parsed.isValid()) {
      // 检查是否允许过去日期
      if (!this.options.allowPastDates && parsed.isBefore(moment(), 'day')) {
        new Notice('不允许选择过去日期');
        return null;
      }
      return parsed;
    }

    return null;
  }

  /**
   * 选择日期并关闭弹窗
   */
  private selectDate(date: moment.Moment): void {
    // 过去日期检查
    if (!this.options.allowPastDates && date.isBefore(moment(), 'day')) {
      new Notice('不允许选择过去日期');
      return;
    }

    this.options.onSelect(date);
    this.close();
  }

  /**
   * 设置移动端滑动手势
   */
  private setupSwipeGestures(): void {
    if (!this.calendarContainer) return;

    let touchStartX = 0;
    let touchEndX = 0;

    this.calendarContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.calendarContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe(touchStartX, touchEndX);
    }, { passive: true });
  }

  /**
   * 处理滑动手势
   */
  private handleSwipe(startX: number, endX: number): void {
    const threshold = 50; // 最小滑动距离
    const diff = endX - startX;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0) {
      // 向右滑动 -> 上个月
      this.currentMonth.subtract(1, 'month');
    } else {
      // 向左滑动 -> 下个月
      this.currentMonth.add(1, 'month');
    }

    this.renderCalendar();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
