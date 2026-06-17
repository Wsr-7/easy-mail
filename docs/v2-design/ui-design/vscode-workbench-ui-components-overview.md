# VS Code 插件 UI 布局与组件速查

> 目标：先建立 VS Code 插件 UI 的官方概念地图，知道各种组件的官方名称、位置、作用、效果、常见用法，以及应该查哪类 API。
>
> 适用场景：准备设计一个带侧边栏、Dashboard、状态提示、右键菜单等交互的 VS Code 插件。

## 1. 先记住总概念

在 VS Code 官方文档里，插件对界面的扩展通常属于 **Workbench Contributions**。你不是随意往 VS Code 任意位置“插 HTML”，而是通过官方允许的扩展点，把能力放进已有的工作台结构里。

最常见的几类是：

- `viewsContainers`：贡献一个视图容器，比如 Activity Bar 上的新图标入口。
- `views`：往某个容器里放一个或多个视图。
- `menus`：给工具栏、右键菜单、标题栏等位置加动作。
- `commands`：注册可执行命令，供命令面板、按钮、菜单复用。
- `configuration`：把插件配置放进 Settings，而不是自造设置页。
- `walkthroughs`：首次安装或首次使用时的引导页。

一句话理解：

- 想做“左侧功能入口 + 列表”：先看 `View Container` + `Tree View`
- 想做“左侧自定义小面板”：先看 `Webview View`
- 想做“主区域 Dashboard 大屏”：先看 `Webview Panel`
- 想做“接管某类文件编辑”：先看 `Custom Editor`
- 想做“按钮、右键、顶部操作”：先看 `menus` + `commands`

## 2. 工作台布局总览

| 区域 | 官方名称 | 你通常会拿它做什么 | 常见技术入口 |
| --- | --- | --- | --- |
| 左右窄图标栏 | Activity Bar | 放插件主入口图标，也就是 View Container | `contributes.viewsContainers.activitybar` |
| 左侧主栏 | Primary Side Bar | 展示树、列表、分组视图 | `contributes.views` + Tree View / Webview View |
| 右侧辅助栏 | Secondary Side Bar | 放被拖过去的视图，或在新版本能力下作为补充位置 | 以 `views` 为主，直挂 `secondarySidebar` 需关注版本状态 |
| 中间标签页区域 | Editor Area | 做 Dashboard、可视化页面、富交互主界面 | `createWebviewPanel`, Custom Editor |
| 底部区域 | Panel | 放输出、日志、结果视图 | `createOutputChannel`, `viewsContainers.panel` |
| 底部状态条 | Status Bar | 放轻量状态和快捷操作 | `createStatusBarItem` |
| 顶部命令入口 | Command Palette | 放用户能搜到的命令 | `commands.registerCommand`, `contributes.commands` |
| 右键菜单/标题栏 | Menus / Actions | 放上下文相关动作 | `contributes.menus` |
| 临时弹出交互 | Quick Pick / Notifications | 做选择器、提示、确认 | `showQuickPick`, `showInformationMessage` 等 |

## 3. 组件逐个看

### 3.1 Activity Bar 与 View Container

**官方名称**

- `Activity Bar`
- `View Container`

**它是什么**

Activity Bar 是 VS Code 左侧或顶部布局中的那排入口图标。插件放上去的图标，本质上代表一个 `View Container`。

**作用**

- 给插件一个稳定主入口
- 容纳一个或多个 `View`
- 适合“产品级功能模块”，比如 Git、扩展、测试、AI 助手

**效果**

- 用户点击图标后，打开对应的 Side Bar 内容
- 一个容器里通常有多个可折叠子视图

**常见使用方式**

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "easyMail",
          "title": "Easy Mail",
          "icon": "media/easy-mail.svg"
        }
      ]
    }
  }
}
```

**什么时候用**

- 你的插件是一个长期驻留的功能区
- 你要放多个视图
- 你希望用户能像使用 Explorer / Source Control 一样使用它

**不适合**

- 只是一个偶尔触发的小工具
- 只是一个一次性设置页

## 3.2 Side Bar / Views

**官方名称**

- `Primary Side Bar`
- `Secondary Side Bar`
- `View`

**它是什么**

`View` 是容器里的具体内容块。一个 View 可以是树、欢迎页、Webview 视图，也可以带工具栏动作。

**作用**

- 展示结构化内容
- 作为插件主工作流的入口面板
- 承载筛选、刷新、创建、跳转等轻量交互

**效果**

- 出现在 Side Bar 或 Panel 中
- 可以被用户拖动位置
- 可以显示标题、图标、空状态、进度、工具栏动作

**常见使用方式**

```json
{
  "contributes": {
    "views": {
      "easyMail": [
        {
          "id": "easyMail.accounts",
          "name": "Accounts",
          "icon": "media/accounts.svg"
        }
      ]
    }
  }
}
```

**注意**

- 用户把某个 View 拖到 `Secondary Side Bar` 是稳定体验。
- 官方 `contribution-points` 文档长期以 `activitybar` / `panel` 为主。
- `secondarySidebar` 作为直接贡献目标在近版本更新记录里出现过，设计时要关注你目标 VS Code 版本和 API 状态。

## 3.3 Tree View

**官方名称**

- `Tree View`
- `TreeDataProvider`
- `TreeItem`

**它是什么**

VS Code 原生树状列表，最像文件树、依赖树、任务树。

**作用**

- 展示层级结构
- 展示列表 + 分组 + 节点动作
- 适合资源浏览、任务队列、账号列表、邮件文件夹树、模板树

**效果**

- 原生外观，和 VS Code 其他内置视图一致
- 支持展开/折叠、图标、描述、tooltip、上下文菜单、标题栏按钮

**常见使用方式**

```ts
const treeView = vscode.window.createTreeView('easyMail.accounts', {
  treeDataProvider: new EasyMailTreeProvider()
});
```

**你一般要实现**

```ts
class EasyMailTreeProvider implements vscode.TreeDataProvider<Node> {
  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Node): Thenable<Node[]> {
    return Promise.resolve([]);
  }
}
```

**适合**

- 数据驱动
- 需要原生感
- 需要支持右键、标题按钮、节点刷新

**不适合**

- 复杂表单
- 图表、大量自定义布局
- 高自由度交互界面

## 3.4 Webview View

**官方名称**

- `Webview View`
- `registerWebviewViewProvider`

**它是什么**

放在 Side Bar 或 Panel 中的自定义 HTML 视图。位置像普通 View，但内容是你自己写的 HTML/CSS/JS。

**作用**

- 在侧边栏里做 richer UI
- 放表单、卡片、说明、状态看板、小型控制面板

**效果**

- 比 Tree View 自由很多
- 但仍然嵌在 View 这个框架里，不是独立大页面

**常见使用方式**

```ts
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    'easyMail.dashboardSidebar',
    new EasyMailSidebarProvider(context.extensionUri)
  )
);
```

**适合**

- 侧边栏里想做更丰富的布局
- 需要表单、按钮组、分段说明

**不适合**

- 想做“主工作区大屏”
- 需要复杂多页签主界面时

## 3.5 Webview Panel

**官方名称**

- `Webview Panel`
- `createWebviewPanel`

**它是什么**

在编辑器标签页区域打开的独立页面。很多插件的 Dashboard、欢迎页、配置大屏、图表页面，本质都是它。

**作用**

- 做主面板
- 承载复杂交互页面
- 展示图表、可视化、邮件预览、富文本配置、向导

**效果**

- 以标签页形式出现在 Editor Area
- 自由度最高
- 可以像网页应用一样设计布局

**常见使用方式**

```ts
const panel = vscode.window.createWebviewPanel(
  'easyMailDashboard',
  'Easy Mail Dashboard',
  vscode.ViewColumn.One,
  {
    enableScripts: true
  }
);
```

**适合**

- 你说的 “main panel dashboard”
- 大屏、复杂设置中心、可视化流程、预览页

**不适合**

- 只想展示层级列表
- 简单状态提示

## 3.6 Custom Editor

**官方名称**

- `Custom Editor`
- `CustomTextEditorProvider`
- `CustomReadonlyEditorProvider`

**它是什么**

插件接管某类文件在编辑器区域里的打开方式，用自定义 UI 代替普通文本编辑器。

**作用**

- 用可视化方式编辑特定文件格式
- 比如 `.csv`、`.json`、流程定义、模板文件、邮件设计稿

**效果**

- 用户打开某类文件时，看到的是你的界面，不是原始文本

**适合**

- 文件类型有明确格式
- “打开文件”就是主交互入口

**不适合**

- 没有特定文件对象
- 只是一个一般性 Dashboard

## 3.7 Panel Area 与 Output Channel

**官方名称**

- `Panel`
- `Output Channel`

**它是什么**

Panel 是编辑器下方那块区域，默认有 Terminal、Output、Problems 等。插件最常见的落点是自己的输出通道。

**作用**

- 打日志
- 显示任务输出
- 给用户和开发者排错

**效果**

- 用户可以切到你的输出页看日志
- 很适合后台同步、索引、邮件发送、认证流程等任务输出

**常见使用方式**

```ts
const output = vscode.window.createOutputChannel('Easy Mail');
output.appendLine('Easy Mail started');
output.show(true);
```

**适合**

- 运行日志
- 调试信息
- 后台任务状态

**不适合**

- 复杂交互界面

## 3.8 Status Bar

**官方名称**

- `Status Bar`
- `Status Bar Item`

**它是什么**

窗口底部那一条状态栏里的一个小入口。

**作用**

- 显示当前状态
- 提供一键操作
- 提供弱打断、持续可见的反馈

**效果**

- 典型样式如 `$(sync~spin) Sending...`
- 点击可触发命令

**常见使用方式**

```ts
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
item.text = '$(mail) Easy Mail';
item.tooltip = 'Open Easy Mail Dashboard';
item.command = 'easyMail.openDashboard';
item.show();
```

**适合**

- 当前账号状态
- 同步中/发送中
- 快速打开 Dashboard

**不适合**

- 很多按钮堆在一起
- 长文案和复杂流程

## 3.9 Actions 与 Menus

**官方名称**

- `View Actions`
- `Editor Actions`
- `Context Menus`
- `menus` contribution point

**它是什么**

VS Code 里的很多“按钮”本质上都是命令加菜单位置。你把一个命令贡献到某个 `menu location`，它就会出现在对应区域。

**常见位置**

- `view/title`：某个 View 标题栏右上角动作
- `view/item/context`：View 内节点右键菜单
- `explorer/context`：资源管理器右键菜单
- `editor/context`：编辑器右键菜单
- `editor/title`：编辑器标签页标题区域
- `commandPalette`：命令面板中是否显示

**常见使用方式**

```json
{
  "contributes": {
    "commands": [
      {
        "command": "easyMail.refreshAccounts",
        "title": "Refresh Accounts"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "easyMail.refreshAccounts",
          "when": "view == easyMail.accounts",
          "group": "navigation"
        }
      ],
      "explorer/context": [
        {
          "command": "easyMail.createDraftFromFile",
          "when": "resourceExtname == .md",
          "group": "navigation"
        }
      ]
    }
  }
}
```

**适合**

- 刷新
- 新建
- 打开
- 导入
- 对当前节点或文件做操作

**设计建议**

- 用 `when` 条件控制上下文，不要到处都显示
- 大动作放子菜单
- 标题栏动作不要太多

## 3.10 Command Palette

**官方名称**

- `Command Palette`

**它是什么**

`Ctrl+Shift+P` 打开的命令入口。命令系统是很多 UI 的基础。

**作用**

- 给高级用户一个统一入口
- 让按钮、菜单、快捷键都复用同一命令

**效果**

- 用户可搜索命令名称
- 常与分类前缀一起使用，如 `Easy Mail: Open Dashboard`

**常见使用方式**

```json
{
  "contributes": {
    "commands": [
      {
        "command": "easyMail.openDashboard",
        "title": "Open Dashboard",
        "category": "Easy Mail"
      }
    ]
  }
}
```

## 3.11 Quick Pick / Quick Input

**官方名称**

- `Quick Pick`
- `Quick Input`

**它是什么**

顶部弹出的轻量选择器/输入器。

**作用**

- 让用户快速选账号、模板、工作区、命令分支
- 适合轻流程，不需要完整页面

**效果**

- 像一个全局弹出框
- 输入、过滤、单选、多步选择都可以

**常见使用方式**

```ts
const choice = await vscode.window.showQuickPick(
  ['Send mail', 'Preview mail', 'Open dashboard'],
  { placeHolder: 'Choose an Easy Mail action' }
);
```

**适合**

- 轻量选择
- 一到两步向导

**不适合**

- 复杂长表单
- 需要很多状态联动

## 3.12 Notifications

**官方名称**

- `Notifications`

**它是什么**

右下角弹出的消息提示。

**作用**

- 提示成功、失败、警告
- 让用户对关键结果有反馈

**效果**

- 信息提示、警告提示、错误提示
- 可附带操作按钮

**常见使用方式**

```ts
vscode.window.showInformationMessage(
  'Mail sent successfully',
  'Open log',
  'Open dashboard'
);
```

**适合**

- 任务结束反馈
- 权限失败提醒
- 引导用户下一步动作

**不适合**

- 高频刷屏
- 持续状态展示

## 3.13 Walkthroughs

**官方名称**

- `Walkthroughs`

**它是什么**

安装后或首次使用时的图文引导清单页。

**作用**

- 做 onboarding
- 告诉用户怎么配置、怎么授权、怎么完成第一步

**效果**

- 出现在编辑器区域
- 支持分步骤、图片、命令入口

**适合**

- 首次安装要配置账号
- 首次使用要走一条标准流程

**不适合**

- 日常主界面

## 4. 一个很实用的选择口诀

### 你想展示“结构”

优先选 `Tree View`

### 你想展示“自定义侧边栏小界面”

优先选 `Webview View`

### 你想展示“主区域 Dashboard 大屏”

优先选 `Webview Panel`

### 你想“接管某种文件的打开方式”

优先选 `Custom Editor`

### 你想给用户一个“全局快捷入口”

优先选 `Command Palette` + `Status Bar Item`

### 你想把操作附着到具体对象

优先选 `menus`，尤其是 `view/item/context`、`explorer/context`、`editor/context`

## 5. 对你这个插件设计最相关的组合

如果你准备做一个带 “Dashboard 大屏” 的 VS Code 插件，最常见、也最稳的一套组合是：

1. `Activity Bar` + 自定义 `View Container`
2. 容器里放一个 `Tree View` 作为功能导航或资源列表
3. 复杂说明/表单可放一个 `Webview View`
4. 主工作区用 `Webview Panel` 打开大屏或详情页
5. 用 `Status Bar Item` 显示当前连接状态或发送状态
6. 用 `Output Channel` 放日志
7. 用 `Quick Pick` 做轻量选择流程
8. 用 `Context Menus` 和 `View Actions` 挂快捷操作

这是很多成熟插件都会采用的结构，因为职责比较清晰：

- 侧边栏负责导航和列表
- 编辑器区域负责主内容和复杂交互
- 状态栏负责弱提示
- 通知负责强提示
- 输出面板负责日志

## 6. 官方文档入口

### 布局与 UX

- VS Code 用户界面总览  
  <https://code.visualstudio.com/docs/getstarted/userinterface>
- Views UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/views>
- Status Bar UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/status-bar>
- Context Menus UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/context-menus>
- Command Palette UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/command-palette>
- Quick Picks UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/quick-picks>
- Notifications UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/notifications>
- Walkthroughs UX Guidelines  
  <https://code.visualstudio.com/api/ux-guidelines/walkthroughs>

### API 与贡献点

- Contribution Points  
  <https://code.visualstudio.com/api/references/contribution-points>
- VS Code API Reference  
  <https://code.visualstudio.com/api/references/vscode-api>
- Tree View API Guide  
  <https://code.visualstudio.com/api/extension-guides/tree-view>
- Webview API Guide  
  <https://code.visualstudio.com/api/extension-guides/webview>
- Custom Editors Guide  
  <https://code.visualstudio.com/api/extension-guides/custom-editors>

## 7. 补充网上资料

- CODE Magazine: *Building a VS Code Extension Using Vue.js*  
  <https://www.codemag.com/article/2107071>

这篇不是官方文档，但适合快速形成“侧边栏 / Activity Bar / Editor / Panel / Status Bar 各自扮演什么角色”的直觉。

## 8. 最后给你一个设计建议

在 VS Code 里，**先想“放在哪个官方容器里”，再想“里面长什么样”**。  
很多新手一上来会先想做一个“自由布局的大页面”，但 VS Code 扩展设计更推荐这样拆：

- 导航和对象列表放 `Tree View`
- 大块交互和可视化放 `Webview Panel`
- 轻量筛选或表单放 `Webview View`
- 零散操作放 `menus` / `actions`
- 短流程选择放 `Quick Pick`

如果后续你愿意，我可以下一步继续给你整理一份更贴近实战的文档：

- `Tree View vs Webview View vs Webview Panel` 如何选
- 一个典型 Dashboard 型插件的 UI 信息架构草图
- `package.json contributes` 的最小骨架模板
