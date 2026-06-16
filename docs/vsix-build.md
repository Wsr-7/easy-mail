# VSIX 构建与没有安装 VS Code 时的处理

## 能不能在没有安装 VS Code 的机器上创建 VSIX

可以。创建 `.vsix` 不要求本机安装 VS Code 桌面软件。

通常需要：

```text
1. Node.js
2. npm
3. @vscode/vsce
4. TypeScript 编译工具链
```

VS Code 插件项目本质是 Node.js / TypeScript 项目。构建 `.vsix` 时执行的是 `vsce package`，它会读取 `package.json`、编译产物和插件资源并打包。

## 典型命令

```powershell
rtk powershell -NoProfile -Command "cd 'F:/otherProjects/codex/email-analysis/vscode-extension'; npm install"
rtk powershell -NoProfile -Command "cd 'F:/otherProjects/codex/email-analysis/vscode-extension'; npx @vscode/vsce package"
```

如果不希望临时使用 `npx`，也可以安装为 dev dependency：

```powershell
rtk powershell -NoProfile -Command "cd 'F:/otherProjects/codex/email-analysis/vscode-extension'; npm install --save-dev @vscode/vsce"
rtk powershell -NoProfile -Command "cd 'F:/otherProjects/codex/email-analysis/vscode-extension'; npm run package"
```

## 没有 VS Code 时不能做什么

没有安装 VS Code，仍然可以构建 `.vsix`，但不能在本机完成完整人工验证：

```text
可以：
- 编译 TypeScript
- 运行单元测试
- 打包 .vsix
- 检查 package.json contribution points

不可以或不方便：
- 启动 Extension Development Host
- 真实打开 sidebar / webview
- 验证 GitHub Copilot 登录态
- 验证 Language Model API 实际 consent 流程
```

## 推荐验证矩阵

```text
构建机器：
- Node.js 可用
- npm install 成功
- npm run compile 成功
- vsce package 成功

试用机器：
- Windows
- classic Outlook
- VS Code
- GitHub Copilot 已登录
- 可以运行 VBScript / cscript.exe
- 可以读取 Outlook COM
```

## 插件调用 Copilot 的前提

VS Code 插件使用 VS Code Language Model API：

```ts
const models = await vscode.lm.selectChatModels({
  vendor: 'copilot'
});
```

前提：

```text
1. 用户安装 VS Code。
2. 用户安装并登录 GitHub Copilot。
3. 用户授权该插件调用 language model。
4. 当前 Copilot 订阅和组织策略允许模型调用。
```

这不是 Microsoft 365 Copilot，也不是共享团队模型服务。每个用户使用自己的 GitHub Copilot 权限和 quota。

