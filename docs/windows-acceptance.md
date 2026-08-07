# Windows 验收清单

目标平台：Windows 10/11 x64。每个发布候选都应记录版本、artifact run、测试人和日期。

## 安装与启动

- [ ] `LOL-Companion-Windows-Portable` 解压后可启动，20 秒内出现窗口或 ready 日志。
- [ ] 断网且未启动 League 时，便携版能打开并进入离线/手动路径。
- [ ] NSIS `*-setup.exe` 能按当前用户安装，无需管理员权限。
- [ ] 安装后开始菜单或安装目录可启动应用。
- [ ] NSIS 卸载后应用文件和快捷方式已移除，用户日志可按产品约定保留。
- [ ] Installer 与 Portable 的 SHA-256 和 `SHA256SUMS.txt` 一致。

## League 与实时数据

- [ ] League 安装在默认路径时可自动发现。
- [ ] League 分别安装在 `C:`、`D:` 和自定义目录时，可由进程、注册表或手动选择发现。
- [ ] `LEAGUE_CLIENT_LOCKFILE` 自定义路径优先且有效。
- [ ] 登录 League Client 并停留首页后，LOL Companion 在十秒内从未连接变为正常。
- [ ] 自动发现失败时，“选择 League 目录”和“选择 lockfile”均可验证并保存路径。
- [ ] 保存路径后退出并重新启动 LOL Companion，无需再次选择即可连接。
- [ ] 连续运行五分钟并保持自动检测，期间没有 Terminal、cmd、PowerShell、`wmic` 或 `reg.exe` 窗口弹出。
- [ ] 进入竞技场后自动更新英雄、等级、金币、装备和游戏时间。
- [ ] 只停留在大厅或选人时，Live Client 2999 显示不可用但 LCU 保持正常；这不算连接失败。
- [ ] 离开对局后 Live Client 2999 状态变为不可用，不继续冒充实时数据。
- [ ] 人为暂停数据超过阈值后显示“实时数据已过期”。

## 海克斯与构筑

- [ ] 自动候选可用时显示三个游戏原生图标。
- [ ] 自动候选不支持时可手动搜索并选择恰好三个图标。
- [ ] 页面顺序固定为“本轮选什么 → 回城买什么 → 这套怎么成型”。
- [ ] 稳健、上限、黑科技三条路线互不重复；没有可信黑科技时明确说明不可用。
- [ ] 回城建议只推荐当前金币买得起的组件，并展示第一件成装和后续装备。
- [ ] 已拥有组件会从剩余价格和购买路径中扣除。
- [ ] 图标网络失败时显示内置占位图，不出现空白布局。

## 数据与故障恢复

- [ ] 内置海克斯目录和英雄/装备目录在离线启动时可用。
- [ ] 损坏运行缓存时回退内置目录，并可点击“丢弃无效缓存”。
- [ ] 目录 manifest 不匹配时停止使用不可信数据并显示恢复动作。
- [ ] WebView2 缺失时 NSIS 触发 bootstrapper 或诊断显示安装说明。
- [ ] League 未找到时仍可进入手动 Arena 模式。

## 隐私与诊断

- [ ] 日志连续运行后最多保留七个日文件。
- [ ] 诊断 ZIP 仅包含批准的日志和 manifest 文件。
- [ ] ZIP 与日志中不存在 LCU 密码、Riot API Key、`X-Riot-Token` 或 `Authorization` 值。
- [ ] ZIP 与日志中不存在 raw lockfile、LCU 响应正文或未脱敏的 Windows 用户名。
- [ ] 导出成功显示 ZIP 的实际完整路径并可复制；不可写目录时显示导出失败。
- [ ] 启动崩溃时原生错误框包含日志目录或恢复说明。

## CI 发布门禁

- [ ] `Validate` 的目录检查、测试、lint、前端构建和 Cargo check 全部通过。
- [ ] `Windows Installer` 的 Cargo check/test、Portable build、PID 冒烟、NSIS build 和文件断言全部通过。
- [ ] 正常成功运行产生 `LOL-Companion-Windows-Installer` 与 `LOL-Companion-Windows-Portable`。
- [ ] 失败运行只额外产生 `LOL-Companion-Windows-Diagnostics`，不会上传伪成功安装包。
