# Task Reminder

一个 Obsidian 插件，在启动时显示今日待办任务提醒弹窗。

## 功能特性

- ⏰ **启动时自动提醒** - Obsidian 启动后延迟显示今日待办任务
- 🔄 **每日只弹一次** - 基于 vault 独立的防重复机制
- 📋 **状态栏指示器** - 实时显示待办数量，点击查看详情（仅桌面端）
- 📱 **移动端支持** - 支持 iOS 和 Android（状态栏功能除外）
- 🎯 **多数据源支持**
  - 📅 Daily Note 任务
  - 👟 Nike 项目任务
  - 🎉 节假日任务
  - 🔄 周期任务
- 🗓️ **会议高亮** - 自动识别并高亮 `#meeting` 标签的任务
- 🔗 **点击跳转** - 点击任务直接打开文件并定位到任务行

## 安装

### 前置要求

- Obsidian v1.4.0 或更高版本
- [Dataview 插件](https://github.com/blacksmithgu/obsidian-dataview)（必需）

### 手动安装

1. 下载最新版本的 `main.js`、`manifest.json` 和 `styles.css`
2. 在 vault 的 `.obsidian/plugins/` 目录下创建 `task-reminder` 文件夹
3. 将下载的文件复制到该文件夹
4. 重启 Obsidian
5. 在设置 → 第三方插件中启用 "Task Reminder"

## 配置

在插件设置中配置以下选项：

### 基础设置

| 设置 | 默认值 | 说明 |
|------|--------|------|
| 启用自动提醒 | ✅ | 是否在启动时自动显示提醒 |
| 延迟时间 | 30 秒 | 启动后等待多久再弹窗（建议等待同步完成） |
| 通知时长 | 8 秒 | Notice 通知显示时间 |
| 提醒样式 | 两者都显示 | 可选：两者都显示 / 仅通知栏 / 仅弹窗 |
| 显示状态栏 | ✅ | 是否在状态栏显示待办数量 |

### 数据源配置

| 设置 | 说明 |
|------|------|
| Daily Note 路径 | Daily Note 文件夹路径，如 `00 - Daily Plan` |
| Nike 日历路径 | Nike 项目日历文件夹路径 |
| 周期任务配置 | 周期任务配置表格所在的文件路径 |

## 数据源格式

### Daily Note 任务

```markdown
// 文件: 00 - Daily Plan/2026/02.February/2026-02-03.md
- [ ] 完成规格书审计 #work
- [ ] 10:00 团队周会 #meeting  ← 会议任务会高亮显示
- [x] 已完成的任务（不会显示）
```

### Nike 项目任务

文件需要包含以下 frontmatter：

```yaml
---
Due Date: 2026-02-03
Done: false
---
```

### 节假日任务

满足以下任一条件：
- 包含 `#holiday` 标签
- frontmatter 中 `type: holiday`

### 周期任务

配置文件格式：

```markdown
| 任务名称 | 类型 | 触发条件 | 模式 |
|---------|------|---------|------|
| 晨间日记 | daily | - | replace |
| 周报 | weekly | 5 | accumulate |
| 月度复盘 | monthly | 1 | skip |
```

## 命令

- **Show today's task reminder** - 手动触发显示今日任务提醒（忽略"已弹过"状态）

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听变更）
npm run dev

# 生产构建
npm run build
```

## 许可证

MIT License

## 致谢

- [Obsidian](https://obsidian.md/)
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview)
