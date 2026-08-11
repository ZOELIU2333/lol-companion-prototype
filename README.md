# LOL Companion

Windows-first《英雄联盟》竞技场决策助手。它在本地读取 League Client（LCU）与游戏内 Live Client Data，把当前英雄、本轮三个海克斯、金币和装备合并成三条不同构筑路线：稳健、上限、黑科技。

核心界面固定为三个问题：

1. 本轮选什么：显示游戏原生海克斯图标与当前排序。
2. 回城买什么：根据现有装备、配方与金币给出买得起的组件和成装目标。
3. 这套怎么成型：解释海克斯、英雄机制和装备如何触发、放大或冲突。

自动候选接口不可用时，仍可用图标手动选择三个候选；离线时继续使用随应用打包且已校验的数据目录。

## Windows 安装

普通用户不需要安装 Node.js、Rust 或 Tauri。

1. 打开仓库的 `Actions` → `Windows Installer`。
2. 选择最近一次成功运行。
3. 优先下载 `LOL-Companion-Windows-Installer` 并运行 `*-setup.exe`。
4. 安装器异常时，下载 `LOL-Companion-Windows-Portable`，解压后运行 `LOL-Companion-Portable.exe`。
5. 用 artifact 内的 `SHA256SUMS.txt` 校验文件哈希。

当前构建尚未签名，Windows SmartScreen 可能提示风险。只应运行从本仓库 GitHub Actions 下载、且哈希匹配的文件。

NSIS 使用当前用户安装，不要求管理员权限。WebView2 缺失时安装器会联网下载官方 bootstrapper；Windows 10/11 通常已自带 WebView2 Runtime。

## 实时数据边界

- LCU：客户端阶段、模式、英雄、玩家及可能存在的竞技场候选接口。
- Live Client Data：游戏时间、等级、金币、当前装备。
- CommunityDragon：中英文竞技场海克斯目录和原生图标。
- Data Dragon：英雄、技能、装备、配方和金币。
- 手动输入：LCU 不公开本轮候选时的可靠回退。

本项目不会注入游戏进程，也不是 DirectX 覆盖层；它是本地 Tauri 悬浮窗口。

## 连接诊断

竞技场路线详情中包含 Windows 连接诊断，覆盖：

- Desktop Shell / WebView2
- League 安装发现与 LCU
- Live Client Data 新鲜度
- 海克斯候选能力
- 内置目录与运行缓存
- 脱敏日志与诊断包导出

日志最多保留七天，并在写入与导出时移除 LCU 密码、Riot Token、Authorization 和常见 JSON 密钥。详见 [Windows 故障排查](docs/windows-troubleshooting.md)。

## 本地开发

要求 Node.js 20.19+、npm 10、stable Rust 和对应平台的 Tauri 2 系统依赖。

```bash
git clone https://github.com/ZOELIU2333/lol-companion-prototype.git
cd lol-companion-prototype
npm ci
npm run dev
```

桌面开发：

```bash
npm run tauri:dev
```

浏览器 Demo 使用模拟对局，不能访问本机 LCU/Live Client。

## 严格验证

```bash
npm run verify
```

该命令依次校验竞技场与游戏目录、149 个前端测试、lint、生产构建和 Rust check。GitHub `Validate` 工作流不可忽略失败；`Arena Data` 每日验证 CommunityDragon 两个语言源，有变化时上传标准化 diff，不直接改仓库。

## 数据更新

```bash
npm run data:arena:import
npm run data:game:import
npm run data:arena:check
npm run data:game:check
```

验收清单见 [Windows 验收](docs/windows-acceptance.md)。
