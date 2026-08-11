# LCU 与 Live Client 稳定连接设计

## 背景

Windows 构建 `31187790714` 已解决启动黑屏，但实机诊断显示两个独立的数据连接问题：

- League Client 自动发现找到了运行中 `LeagueClientUx.exe` 所在目录及其 `lockfile`，但现有严格解析器返回 `Process:InvalidFormat`。手动选择同一文件仍复用相同解析器，因此同样验证失败，LCU 最终进入 `no-lockfile`，大厅、选人和顶部连接状态只能使用 Demo。
- Live Client Data 在实际对局中能够短暂连接，但当前实现为每次轮询创建新的 HTTPS 客户端，请求总超时只有 900ms，并在任意一次失败后立即把前端快照清空。失败原因被折叠为 `None`，日志无法区分连接、TLS、HTTP、JSON 或字段解析失败。

诊断包还包含 `plugin:window|start_dragging not allowed by ACL`，该问题属于窗口拖动权限噪音，不影响 LCU 或 Live Client 数据连接，不纳入本次范围。

## 目标

1. 兼容已观察到的国服/WeGame lockfile 变体，让自动发现和手动选择都能建立 LCU 会话。
2. 让 Live Client Data 在正常网络与本机调度抖动下保持稳定，不因单次瞬时失败清空整个实时页面。
3. 让顶部连接状态由 LCU 与 Live Client 的真实证据共同决定；任一真实数据源可用时不得显示 Demo。
4. 为两条通道提供可诊断且不泄露凭据的失败分类。
5. 保持对局结束后的正确退场：短暂保留最近快照，但不得无限冒充实时数据。

## 非目标

- 不尝试从浏览器直接访问 `127.0.0.1:2999`。
- 不记录、导出或展示 lockfile 原文、认证令牌或 Authorization 请求头。
- 不使用 `wmic`、PowerShell、`reg.exe` 或会弹出终端窗口的发现方式。
- 不在本次改动中实现未确认存在的自动海克斯候选接口。
- 不把过期 Live Client 快照标记为实时。

## 方案选择

### 采用：根因修复加双数据源防抖

同时修复 lockfile 兼容性、Live Client 连接生命周期、错误分类与前端聚合状态。该方案改动面适中，但能完整覆盖实机暴露的两类问题，并避免单个通道拖累整个应用。

### 未采用：只放宽解析和延长超时

改动较小，但仍会在单次 Live Client 失败时丢失页面，也无法正确表达“LCU 异常但对局实时数据正常”的状态。

### 暂缓：读取进程命令行中的 LCU 凭据

从 `LeagueClientUx.exe` 命令行读取 `--app-port` 与 `--remoting-auth-token` 可作为未来备用，但需要额外的 Windows 底层进程访问与更严格的敏感数据边界。只有兼容解析仍无法覆盖实机格式时才启用该路径。

## 架构

### 1. LCU lockfile 兼容解析

`src-tauri/src/lcu/lockfile.rs` 继续作为唯一解析入口。解析前执行有限且明确的规范化：

- 去除 UTF-8 BOM；
- 去除尾部换行以及文件末尾的 NUL；
- 保留令牌内容，不对内部字符做破坏性 trim；
- 以进程名、PID、端口和末尾协议为结构边界，允许认证令牌内部含有额外冒号。

解析结果仍必须满足：

- PID 是有效正整数；
- 端口是 `1..=65535`；
- 认证令牌非空；
- 协议是大小写归一化后的 `http` 或 `https`；
- 必要结构字段存在。

解析错误扩展为安全类别，例如 `FieldCount`、`InvalidPid`、`InvalidPort`、`EmptyPassword` 与 `InvalidProtocol`。发现遥测只能记录错误类别、字段数量和脱敏路径，不得记录任何字段值。自动发现、保存路径复用和手动选择必须调用同一解析器。

### 2. Live Client 后端连接器

`src-tauri/src/live_client.rs` 拆分为三个清晰单元：

- 客户端构造：通过进程级惰性单例复用 `reqwest::Client`，启用本机自签名证书兼容；
- 单次读取：负责 HTTP、状态码、JSON 和字段解析，并返回结构化错误；
- 稳定状态：记录最近一次成功快照、成功时间和连续失败状态。

默认读取策略：

- 每轮请求超时约 2.5 秒；
- 第一次瞬时失败后短暂退避并重试一次；
- 轮询仍由现有前端节奏触发，不允许同一读取器产生重叠请求；
- 连接拒绝、超时、TLS、非成功 HTTP、JSON 与 payload 解析分别分类。

日志只在状态或错误类别变化时记录，避免每 2.5 秒刷屏。日志可以包含 HTTP 状态码和失败类别，不得包含响应正文、URL 查询参数、凭据或玩家隐私字段。

### 3. Fresh、Reconnecting 与 Unavailable

Live Client 命令不再只返回“快照或 null”，而是返回带状态的读取结果：

- `fresh`：本轮成功读取；
- `reconnecting`：本轮失败，但最近一次成功快照未超过 10 秒；
- `unavailable`：从未成功，或最近成功快照已超过 10 秒。

`reconnecting` 必须附带快照年龄，前端可以继续展示最近数据，但必须显示“正在重连 · N 秒前”，不得标为实时。`unavailable` 清除实时快照。对局结束后 2999 持续不可用，最多约 10 秒后自动退出实时状态。

### 4. 前端连接证据聚合

`useCompanionSession` 不再让 LCU 检测 effect 单独拥有整个连接状态。新增纯函数根据两条通道的证据派生顶部状态：

- LCU 可用且尚无 Live Client：`已连接客户端`；
- Live Client `fresh`：`实时对局`；
- Live Client `fresh` 且 LCU 不可用：`实时对局 · LCU 待恢复`；
- Live Client `reconnecting`：保持对局上下文，并显示重连状态；
- 两条通道都不可用：`Demo 模式 · 未连接客户端`。

LCU 仍负责大厅、选人、队伍、阶段和模式。Live Client 负责实际对局中的游戏时间、英雄、等级、金币和装备。当 LCU 不可用但 Live Client `fresh` 时，应用使用 `gameMode` 推导排位或竞技场，并使用 `championName` 映射当前英雄，从真实数据填充可确认的字段；未确认字段保持缺失或手动状态，不使用 Demo 值冒充实时值。

诊断面板继续分别显示 League Client 与 Live Client，顶部聚合状态不会掩盖某条通道的故障。

## 错误处理与隐私

- LCU 解析失败必须在界面显示安全、可操作的类别说明；手动选择失败不能只返回“验证失败”。
- Live Client 瞬时失败进入 `reconnecting`，超过新鲜度阈值才进入 `unavailable`。
- 所有错误路径不得抛出到 React 顶层，也不得终止其他数据源轮询。
- 诊断导出维持现有白名单，只包含 manifest 和脱敏日志。
- 新增测试断言错误日志、Debug 输出和导出内容均不含认证令牌。

## 测试设计

### Rust 单元测试

- 标准五字段 lockfile；
- 带 BOM、尾部 NUL 与多余换行；
- 认证令牌含冒号；
- 无效 PID、端口、空令牌和错误协议；
- 错误类别与 Debug 输出不泄露令牌；
- Live Client 成功解析、未知字段、HTTP/JSON/payload 错误分类；
- 首次成功、单次失败、连续失败、10 秒过期和恢复连接状态机；
- 日志状态去重。

### 前端单元测试

- LCU ready、Live unavailable 推导为“已连接客户端”；
- LCU unavailable、Live fresh 推导为“实时对局 · LCU 待恢复”；
- Live reconnecting 保留快照并显示年龄；
- 两条通道均不可用才推导为 Demo；
- Live 模式和英雄映射不会用未确认的 Demo 字段覆盖真实数据。

### 回归与构建

- 全部现有数据校验、Vitest、lint 与前端生产构建；
- Cargo test 与 Cargo check；
- GitHub Actions Windows x64 Portable、启动冒烟与 NSIS 安装器；
- 安装版与便携版两个 Artifact 均存在。

## Windows 验收

1. 大厅：League Client/LCU 正常，Live Client 明确等待实际对局。
2. 选人：读取阶段、模式、英雄与队伍信息。
3. 进入游戏：读取时间、英雄、等级、金币与装备，顶部显示实时对局。
4. 短暂失败：显示正在重连，最近快照带年龄且界面不退回 Demo。
5. 持续失败或退出游戏：约 10 秒后清除实时快照。
6. LCU 暂时失败但 Live Client 正常：保持实时对局，同时单独提示 LCU 待恢复。
7. 导出诊断：能看到失败类别和状态变化，但不存在凭据、lockfile 原文或响应正文。

## 发布

修复在 `codex/arena-rebuild` 分支完成。所有本地门禁通过后推送 GitHub，手动触发 `Windows Installer` 工作流，确认安装版与便携版 Artifact 均绑定到修复提交，再交付 Windows 实机复测。
