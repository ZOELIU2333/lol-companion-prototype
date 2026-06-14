# Claude Code Implementation Handoff

你将在仓库 `/Users/liudan/Documents/personal/lol-companion-prototype` 中实现 26.12 海克斯大乱斗数据升级。

## 开始前

1. 阅读并严格遵循：
   - `docs/superpowers/specs/2026-06-14-aram-mayhem-26-12-multi-source-data-design.md`
   - `docs/superpowers/plans/2026-06-14-aram-mayhem-26-12-data-implementation.md`
   - `docs/data-source-matrix.md`
2. 从当前 `main` 创建独立分支：

```bash
git switch -c claude/mayhem-26-12-data
```

3. 不要在 `main` 上直接开发，不要重写或压缩现有提交历史。
4. 工作区可能包含用户或其他代理的改动。不要删除、回滚或覆盖与你任务无关的变化。

## 核心产品口径

- 本轮只实现 **海克斯大乱斗（ARAM: Mayhem）**，不是斗魂竞技场。
- 当前基线版本是 **26.12**，但每日更新流程必须先检测当前正式版本，不能永久写死 26.12。
- 海克斯大乱斗统计使用 **全分段大样本**。
- 匹配/排位继续使用 **韩服钻石以上**，本轮不要修改其口径。
- 推荐提供两种模式：
  - `strength`：默认强度推荐。
  - `off-meta`：黑科技推荐。
- 黑科技正式推荐必须有同版本 **至少 500 场**结构化统计样本。
- 社区帖子、攻略、点赞和浏览量只能发现候选，不能作为胜率或场次证据。

## 数据源边界

官方身份和规则来源：

- Riot 国服及全球版本公告。
- CommunityDragon。
- Data Dragon。

结构化统计来源：

- METAsrc ARAM: Mayhem。
- OP.GG ARAM: Mayhem。

社区及组合候选来源：

- `aramgg.com`
- `arammayhem.com`
- 后续可合法、稳定访问的国内外玩家社区。

每个站点必须使用独立适配器。遇到登录墙、验证码、Cloudflare 挑战或明确禁止自动抓取时停止该来源，不得绕过保护。单站失败要记录健康状态，不能拖垮整个更新流程。

## 实施顺序

严格按实施计划的 Task 1 到 Task 10 执行。不要跳过测试直接堆 UI。

优先完成并单独提交：

1. Mayhem 专用类型、模式隔离和版本校验。
2. 当前正式版本检测。
3. 26.12 官方强化身份、名称、描述和图标缓存。
4. METAsrc 与 OP.GG 结构化统计适配器。
5. 国内外社区黑科技候选池。
6. 多源去重、冲突检测、500 场门槛和快照生成。
7. 强度/黑科技实时三选一评分。
8. Live Client Data 已选强化与候选字段。
9. 紧凑 UI 切换。
10. 每日 GitHub Actions 与文档。

## 实现限制

- 新代码使用独立的 `src/features/mayhem/` 和 `data/mayhem/` 数据域。
- 不要把现有 `arenaAugments` 或 `ArenaRecommendation` 直接改名后冒充 Mayhem 数据。
- 旧本地标签评分只能作为明确标注的兜底：
  - `本地规则兜底 · 非版本统计`
- 不得伪造：
  - 候选强化。
  - 已选强化。
  - 样本量。
  - 胜率。
  - 组合概率。
- Live Client Data 没有暴露某字段时返回空数组或 unavailable，并在 UI 明确等待同步。
- 不要在对局过程中临时抓多个第三方网页；应用读取预生成、已校验的本地快照。
- UI 保持当前插件密度，不增加新手教学或大段说明。
- 装备继续只显示图标。
- 不要顺手重构玩家情报、排位推荐或 Windows 打包流程。

## 评分要求

强度模式：

```text
胜率 40%
样本稳定性与跨来源一致性 25%
英雄适配 20%
已选强化协同 15%
```

黑科技模式：

```text
组合收益 35%
稀有度 25%
英雄适配 20%
跨来源稳定性 20%
```

海克斯大乱斗是 5v5 胜负制。禁止引入斗魂竞技场的前四率、平均名次或回合概念。

## 测试和提交纪律

- 使用 TDD：先写失败测试，再实现最小代码。
- 每个实施计划 Task 完成后单独提交。
- 提交信息保持聚焦，不把多个无关任务揉在一起。
- 不要提交 `node_modules`、`dist`、`src-tauri/target` 或临时抓取文件。
- 外部 HTML fixture 应尽量小，只保留解析测试需要的字段。
- 生成数据必须保留来源 URL、版本、采集时间、样本量和健康状态。

每个阶段至少运行对应测试。最终必须运行：

```bash
npm run data:mayhem:check
npm run test
npm run lint
npm run build
npm run tauri:build -- --no-bundle
cargo check --manifest-path src-tauri/Cargo.toml
```

## 完成后交付

不要直接合并到 `main`。完成后提供：

1. 分支名和最终 commit SHA。
2. 按 Task 1-10 列出的完成状态。
3. 实际成功的数据源及每个来源抓取的记录数量。
4. 失败或受限的数据源及具体原因。
5. 当前快照版本、生成时间、强化覆盖率和推荐数量。
6. 黑科技推荐中最低样本量。
7. 所有验证命令的结果摘要。
8. 已知限制，特别是 Live Client Data 是否真实暴露已选强化和当前三候选。
9. `git diff main...HEAD --stat` 输出。

完成后停止，不要自行合并。Codex 会做独立代码审查、数据抽样、UI 验证和 Windows 构建验收。
