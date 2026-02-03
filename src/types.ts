/**
 * Task Reminder Plugin - Type Definitions
 * 根据 SPEC.md §4.4.2 定义
 */

/** 任务来源类型 */
export type TaskSource = 'daily' | 'nike' | 'holiday' | 'recurring';

/** 来源标签映射 */
export const SOURCE_LABELS: Record<TaskSource, string> = {
  daily: '📅 Daily',
  nike: '👟 Nike',
  holiday: '🎉 Holiday',
  recurring: '🔄 周期'
};

/** 单个任务项 */
export interface TaskItem {
  /** 唯一标识（path:line） */
  id: string;
  /** 任务来源 */
  source: TaskSource;
  /** 显示标签如 "📅 Daily" */
  sourceLabel: string;
  /** 任务文本（截断后，max 60 chars） */
  text: string;
  /** 完整文本 */
  fullText: string;
  /** 是否为会议（通过 #meeting 标签） */
  isMeeting: boolean;
  /** 来源文件路径 */
  filePath: string;
  /** 任务所在行号（用于跳转） */
  line?: number;
  /** 截止日期 */
  dueDate?: string;
}

/** 任务数据查询结果 */
export interface TaskDataResult {
  /** 所有任务列表 */
  tasks: TaskItem[];
  /** Daily Note 任务数量 */
  dailyCount: number;
  /** Nike 项目任务数量 */
  nikeCount: number;
  /** 节假日任务数量 */
  holidayCount: number;
  /** 周期任务数量 */
  recurringCount: number;
  /** 各数据源的错误信息 */
  errors: TaskSourceError[];
}

/** 数据源错误信息 */
export interface TaskSourceError {
  /** 来源名称 */
  source: string;
  /** 错误消息 */
  message: string;
  /** 是否可恢复 */
  recoverable: boolean;
}

/** 周期任务类型 */
export type RecurringType = 'daily' | 'weekly' | 'monthly';

/** 周期任务配置项 */
export interface RecurringTaskConfig {
  /** 任务名称 */
  name: string;
  /** 类型：daily/weekly/monthly */
  type: RecurringType;
  /** 触发条件 */
  trigger: string;
  /** 模式：replace/accumulate/skip */
  mode: string;
}

/** 周期任务状态 */
export interface RecurringTaskStatus {
  /** 任务名称 */
  fileName: string;
  /** 类型 */
  type: RecurringType;
  /** 是否已在日记中 */
  existsInDaily: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
}

/** 待生成的周期任务 */
export interface PendingRecurringTask {
  /** 任务名称 */
  name: string;
  /** 类型 */
  type: RecurringType;
  /** 触发条件 */
  trigger: string;
}

/** 周期任务数据结果（扩展版） */
export interface RecurringTaskResult {
  /** 已在日记中的未完成任务 */
  tasks: TaskItem[];
  /** 待生成的任务（未写入日记） */
  pendingTasks: PendingRecurringTask[];
}

/** Dataview API 类型（简化版） */
export interface DataviewApi {
  pages: (source?: string) => DataviewPages;
  page: (path: string) => DataviewPage | null;
}

export interface DataviewPages {
  file: {
    tasks: DataviewTasks;
  };
  where: (fn: (p: DataviewPage) => boolean) => DataviewPages;
  map: <T>(fn: (p: DataviewPage) => T) => T[];
  array: () => DataviewPage[];
}

export interface DataviewTasks {
  where: (fn: (t: DataviewTask) => boolean) => DataviewTasks;
  groupBy: (fn: (t: DataviewTask) => any) => DataviewTaskGroup[];
  array: () => DataviewTask[];
}

export interface DataviewTask {
  text: string;
  completed: boolean;
  checked: boolean;
  tags: string[];
  link: DataviewLink;
  line: number;
  path: string;
}

export interface DataviewPage {
  file: {
    name: string;
    path: string;
    folder: string;
    link: DataviewLink;
    tags: string[];
    frontmatter: Record<string, any>;
    day?: { ts: number };
  };
  [key: string]: any;
}

export interface DataviewLink {
  path: string;
  display?: string;
}

export interface DataviewTaskGroup {
  key: any;
  rows: DataviewTask[];
}
