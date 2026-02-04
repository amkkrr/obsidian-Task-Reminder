# F7: Daily Note 模板支持

> **文档版本**: 2026-02-04-a
> **状态**: 🔲 待实现
> **目标版本**: v1.4.0
> **依赖**: F4, F5, F6（Daily Note 自动创建场景）

---

## 1. 功能概述

当自动创建 Daily Note 时（F4 周期任务生成 / F5 添加任务 / F6 移动任务），使用用户指定的模板文件替代硬编码模板。

### 1.1 触发场景

| 场景 | 触发条件 |
|------|---------|
| F4 周期任务生成 | 今日 Daily Note 不存在时 |
| F5 快速添加 | 目标日期 Daily Note 不存在时 |
| F6 移动任务 | 目标日期 Daily Note 不存在时 |

### 1.2 向后兼容

- 未配置模板路径时，行为与现有逻辑完全一致
- 模板文件不存在时，降级使用默认模板并警告

---

## 2. 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `dailyNoteTemplatePath` | string | `""` | 模板文件路径（.md 文件） |

### 2.1 设置 UI 映射

| 配置项 | 设置界面位置 | UI 控件 | 说明文案 |
|--------|-------------|---------|---------|
| `dailyNoteTemplatePath` | 数据源配置 → Daily Note 路径下方 | FileSuggest 输入框 | "Daily Note 模板：创建新日记时使用的模板文件（留空则使用默认模板）" |

### 2.2 设置界面示意

```
│ ── 数据源配置 ──                                     │
│                                                      │
│ Daily Note 路径                    [📁] 00 - Daily   │
│ Daily Note 模板                    [📄] Templates/...│  ← 新增
│ 创建新日记时使用的模板文件（留空使用默认模板）          │
│ 包含 Daily Note 任务                      [开关] ✓   │
```

---

## 3. 模板变量

模板文件中支持以下变量（使用 `{{variable}}` 语法）：

| 变量 | 说明 | 示例输出 |
|------|------|---------|
| `{{date}}` | 日期 YYYY-MM-DD | `2026-02-04` |
| `{{date:format}}` | 自定义日期格式 | `{{date:YYYY年M月D日}}` → `2026年2月4日` |
| `{{day}}` | 星期（英文） | `Tuesday` |
| `{{day:zh}}` | 星期（中文） | `星期二` |
| `{{time}}` | 当前时间 HH:mm | `14:30` |
| `{{title}}` | 文件名（不含扩展名） | `2026-02-04` |

### 3.1 示例模板文件

文件路径: `Templates/Daily Note.md`

```markdown
---
date: {{date}}
day: {{day}}
created: {{date}} {{time}}
tags: [daily]
---

# {{date}} {{day:zh}}

## 📋 今日任务

## 📝 笔记

## 🌙 日终回顾

```

---

## 4. 技术设计

### 4.1 类型定义更新

```typescript
// src/settings.ts
export interface TaskReminderSettings {
  // ... 现有字段
  dailyNoteTemplatePath: string;  // 新增：模板文件路径
}

export const DEFAULT_SETTINGS: TaskReminderSettings = {
  // ... 现有默认值
  dailyNoteTemplatePath: '',
};
```

### 4.2 DailyNoteService 更新

```typescript
// src/services/DailyNoteService.ts 新增/修改方法

/**
 * 使用模板创建 Daily Note（替换现有 createDailyNoteForDate）
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
      const templateContent = await this.app.vault.read(templateFile);
      content = this.processTemplate(templateContent, date);
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
 * 处理模板变量
 */
private processTemplate(template: string, date: moment.Moment): string {
  const dayZhMap: Record<number, string> = {
    0: '星期日', 1: '星期一', 2: '星期二', 3: '星期三',
    4: '星期四', 5: '星期五', 6: '星期六'
  };

  return template
    // 自定义日期格式 {{date:FORMAT}}
    .replace(/\{\{date:([^}]+)\}\}/g, (_, format) => date.format(format))
    // 基础变量
    .replace(/\{\{date\}\}/g, date.format('YYYY-MM-DD'))
    .replace(/\{\{day\}\}/g, date.format('dddd'))
    .replace(/\{\{day:zh\}\}/g, dayZhMap[date.day()])
    .replace(/\{\{time\}\}/g, moment().format('HH:mm'))
    .replace(/\{\{title\}\}/g, date.format('YYYY-MM-DD'));
}

/**
 * 默认模板（向后兼容）
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
```

---

## 5. 错误处理

| 错误场景 | 触发条件 | 用户提示 | 行为 |
|---------|---------|---------|------|
| 模板文件不存在 | 配置了路径但文件不存在 | Notice: "模板文件不存在，使用默认模板" | 降级使用默认模板 |
| 模板读取失败 | 文件损坏或权限问题 | Notice: "模板读取失败: {error}" | 降级使用默认模板 |
| 模板变量语法错误 | 无法解析的变量 | 静默保留原文 | 不替换，保留 `{{unknown}}` |

---

## 6. 测试计划

| 测试项 | 预期结果 | 验收标准 |
|--------|----------|---------|
| 未配置模板 | 使用默认模板创建 | 内容与现有逻辑一致 |
| 配置有效模板 | 使用模板内容创建 | 变量正确替换 |
| 模板文件不存在 | 降级 + 警告 | Notice 提示 + 使用默认模板 |
| 变量替换 `{{date}}` | 替换为目标日期 | 格式 YYYY-MM-DD |
| 变量替换 `{{date:YYYY年M月}}` | 自定义格式 | 正确解析 moment 格式 |
| 变量替换 `{{day:zh}}` | 中文星期 | 星期一~星期日 |
| 未知变量 `{{unknown}}` | 保留原文 | 不报错，不替换 |
| F4 触发模板 | 新建文件使用模板 | 周期任务追加在模板内容后 |
| F5 触发模板 | 新建文件使用模板 | 任务追加在模板内容后 |
| F6 触发模板 | 新建文件使用模板 | 移动的任务追加在模板内容后 |

---

## 7. 修订记录

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 2026-02-04-a | 2026-02-04 | 初始草案 |
