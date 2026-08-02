# Windows 故障排查

## 应用打不开

先运行便携版 `LOL-Companion-Portable.exe`。启动失败会显示原生错误框，其中包含日志目录或恢复说明。

默认日志目录：

```text
%LOCALAPPDATA%\LOL Companion\logs
```

日志按天滚动，最多保留七个文件。不要手动发布原始 lockfile；应用内“导出诊断包”只包含脱敏日志和版本清单。

## WebView2 缺失

NSIS 默认使用 `downloadBootstrapper`：电脑联网时会自动下载 WebView2。若仍失败：

1. 安装 Microsoft Edge WebView2 Evergreen Runtime。
2. 重启 Windows。
3. 再运行安装器或便携版。

Windows 10/11 的较新版本通常已包含 WebView2。离线电脑应先在另一台电脑下载官方 Evergreen Standalone Installer。

## 找不到 League

应用依次检查：

1. `LEAGUE_CLIENT_LOCKFILE` 指定路径。
2. 正在运行的 `LeagueClientUx.exe` 路径。
3. Riot 卸载注册表位置。
4. 常见盘符和 `Program Files` 路径。

League 安装在特殊目录时，可在启动前设置：

```powershell
$env:LEAGUE_CLIENT_LOCKFILE = "D:\Games\Riot Games\League of Legends\lockfile"
Start-Process .\LOL-Companion-Portable.exe
```

没有 League 或客户端未启动时，海克斯组合与离线目录仍可使用；在诊断面板选择“使用手动模式”，再用图标选三个候选。

## LCU 已发现但连接失败

- 确认 League Client 没有正在更新或重启。
- 点击“重新检测”。
- 不要复制 lockfile 内容到 Issue；其中包含本机 LCU 密码。
- 若持续失败，导出诊断包。

## Live Client 没有实时金币或装备

`https://127.0.0.1:2999/liveclientdata/allgamedata` 只在实际游戏进程运行时可用。客户端大厅、选人和结算阶段显示不可用是正常现象。

诊断显示“实时数据已过期”时：

1. 确认已经进入对局，而不是仅停留在选人界面。
2. 等待 3 秒或点击“重新检测”。
3. 检查安全软件是否阻止本机 2999 端口。

## 海克斯图标或候选没出现

- 自动候选能力显示“不支持”不代表应用损坏：不同客户端版本可能不公开该 LCU 接口。
- 打开“手动修正三个候选”，通过中文、英文或 API 名称搜索并选择三个图标。
- 远程图标失败时应用会显示内置占位图，但文字与机制数据仍可使用。
- 若内置目录校验失败，不要继续依赖旧推荐；下载新的已验证构建。

## 缓存损坏

诊断面板会显示“运行缓存损坏，已回退到内置数据”。点击“丢弃无效缓存”；这只删除明确的运行缓存文件，不会删除日志、设置或游戏文件。

## 导出诊断

展开“路线详情” → “Windows 连接诊断” → “导出诊断包”。ZIP 默认写到日志目录的上一级，内容限制为：

- `diagnostics-manifest.json`
- `logs/lol-companion.*.log`

导出过程会再次脱敏 LCU 密码、Riot API Key、`X-Riot-Token`、`Authorization` 和常见 JSON 密钥。

