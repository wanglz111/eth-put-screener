# ETH 卖 Put 机会筛选器

面向 Cloudflare Workers 的 MVP 方案文档

## 1. 项目概述

这个项目要做的是一个 `ETH Options Put Seller Screener`，用于自动筛选适合卖出 ETH Put 的期权合约。

系统目标不是自动下单，而是把原本人工查看行情、期权链、IV、Delta、DTE 的过程标准化，输出一组可操作的候选交易。

当前 MVP 约束：

- 仅支持 `ETH`
- 仅支持 `PUT`
- 优先满足 Cloudflare 免费版额度

目标策略：

- 标的：ETH
- 策略：`Cash-Secured Put`
- 到期区间：`30-45 DTE`
- Delta 区间：`0.10-0.20`
- 市场环境：高 IV
- 输出：推荐的 `Top 3` 卖 Put 机会

## 2. 你的目的

从当前文档内容来看，你的目的可以归纳为三件事：

1. 把一套“卖 Put 收租”的主观判断流程，沉淀成明确的量化筛选规则。
2. 先做一个可运行的 MVP，通过 API 和简单 Dashboard 输出推荐结果。
3. 方案从一开始就按 Cloudflare Workers 部署方式设计，避免先按传统 Node 服务写一版再迁移。

## 3. MVP 范围

### 3.1 包含内容

- 获取 ETH Spot Price
- 获取 ETH 期权链
- 获取或估算 IV
- 计算 DTE、Put Delta、Yield、Score
- 根据策略规则筛选候选合约
- 输出推荐交易结果
- 提供最小 HTTP API
- 提供一个只读静态 Dashboard
- 支持定时刷新数据

### 3.2 不包含内容

- 自动交易
- 真实资金托管
- 多资产组合风控
- 历史回测引擎
- 复杂 Greeks 全量分析
- Wheel 策略自动切换执行
- 多标的支持
- Call 策略支持

## 4. 核心业务规则

### 4.1 输入数据

系统至少需要以下输入：

- `spot_price`
- `option_chain`
- `implied_volatility`
- `risk_free_rate`
- `current_time`

建议将外部数据源做成可替换 Provider，不要把交易所 API 直接写死在策略层。

### 4.2 基础筛选条件

- `IV >= 60%`
- `30 <= DTE <= 45`
- `0.10 <= abs(delta) <= 0.20`
- `position_yield >= 2%`

### 4.3 行权价搜索范围

根据现价生成候选区间：

```text
strike_range = spot * (0.80 - 0.95)
```

默认步长：

```text
step = 1% of spot
```

如果交易所期权链本身已经给出完整 strike 列表，则优先使用真实链上/交易所可交易 strike，而不是本地虚拟生成值。

### 4.4 收益指标

```text
position_yield = premium / strike
```

可选增加年化视角：

```text
annualized_yield = position_yield * (365 / DTE)
```

MVP 阶段推荐同时保存 `position_yield` 和 `annualized_yield`，但筛选先以 `position_yield` 为主，避免过度优化。

## 5. 计算模型

### 5.1 Black-Scholes

```text
d1 = (ln(S / K) + (r + σ² / 2)T) / (σ * sqrt(T))
d2 = d1 - σ * sqrt(T)
```

其中：

- `S` = spot price
- `K` = strike
- `T` = years to expiry
- `σ` = implied volatility
- `r` = risk-free rate

### 5.2 Put Delta

```text
delta_put = N(d1) - 1
```

说明：

- Put Delta 一般为负值
- 筛选时使用 `abs(delta_put)` 更直接
- Delta 可近似理解为到期进入价内的概率代理变量，但不能等同于真实概率

### 5.3 推荐评分

MVP 推荐使用简单线性评分，先保证可解释性：

```text
score =
  yield_weight * normalized_yield +
  iv_weight * normalized_iv -
  delta_weight * normalized_abs_delta
```

建议初始权重：

- `yield_weight = 0.5`
- `iv_weight = 0.3`
- `delta_weight = 0.2`

说明：

- `yield` 越高越好
- `iv` 越高越好
- `abs(delta)` 越接近上限，风险通常越高，因此作为负项

## 6. 输出结果

### 6.1 推荐结果字段

每条推荐至少包含：

- `underlying`
- `spot_price`
- `expiry`
- `dte`
- `strike`
- `premium`
- `iv`
- `delta`
- `position_yield`
- `annualized_yield`
- `score`
- `assignment_probability_proxy`
- `source`
- `generated_at`

### 6.2 示例输出

```text
SELL PUT

Underlying: ETH
Strike: 1750
DTE: 34
Delta: -0.16
IV: 68%
Premium: 60
Yield: 3.43%
Annualized Yield: 36.8%
Assignment Proxy: 16%
```

## 7. Cloudflare Workers 架构方案

### 7.1 设计原则

- 优先单 Worker 架构，减少运维复杂度
- 抓取和计算只在 Cron 中执行，不放到用户请求链路
- 首页尽量使用静态资源，减少 Worker 动态请求
- 存储优先只保留“最新推荐 + 运行状态”，避免一开始就做历史仓库
- 外部交易所 API 通过 Provider 抽象隔离
- 优先满足 Cloudflare 免费版额度，再考虑功能扩展

### 7.2 推荐架构

```text
Cloudflare Worker
  |- HTTP API (read only)
  |- Scheduled Cron Job
  |- Strategy Engine
  |- Provider Adapters
  |- Static Dashboard Assets

Bindings
  |- KV: latest cache / runtime config
  |- Secrets: API keys
  |- D1: optional fallback storage (phase 2)
```

### 7.3 数据流

```text
Cron Trigger
  -> fetch market data
  -> normalize provider response
  -> compute metrics
  -> apply filters
  -> score candidates
  -> write latest result to KV
  -> update refresh status in KV

Dashboard / API Request
  -> read latest result from KV
  -> fallback to D1 only if enabled
  -> return JSON / render page
```

### 7.4 为什么适合 Workers

- 这是低写入、中读取、计算相对轻量的场景
- 核心任务是定时抓取和读多写少查询，不需要长连接业务状态
- API 返回的是筛选结果，不是高频撮合交易，不依赖传统常驻服务
- 把动态计算前置到 Cron 后，用户访问路径几乎只剩 KV 读取
- 部署、Secrets、Cron、KV 在同一平台内，免费版也容易控制成本

## 8. 技术栈建议

### 8.1 推荐栈

| 层 | 推荐 | 用途 | 结论 |
| --- | --- | --- | --- |
| Runtime | Cloudflare Workers + TypeScript | API、调度、计算 | 必选 |
| HTTP 框架 | Hono | 路由、中间件、Cloudflare 适配 | 推荐 |
| 缓存/主存储 | Cloudflare KV | 保存最新推荐和运行状态 | 必选 |
| 数据库 | Cloudflare D1 | 历史快照、兜底读取 | 二期可选 |
| 对象存储 | Cloudflare R2 | 保存原始期权链快照 | 暂不需要 |
| 定时任务 | Cron Triggers | 定时抓取行情 | 必选 |
| 日志 | Workers Logs | 运行排错 | 推荐 |
| 指标分析 | Analytics Engine | 请求级别指标分析 | 可选 |
| 前端 | Worker 同仓静态页面 | 内部 Dashboard | 推荐 |

### 8.2 具体选型结论

#### 运行时

选择 `Cloudflare Workers + TypeScript`。

原因：

- 原生支持 `fetch`，天然适合调用第三方行情 API
- 部署简单
- 可以同时承载 API、调度任务和页面
- 不需要自己维护容器或 Node 服务器

#### API 层

推荐 `Hono`。

原因：

- 对 Workers 适配成熟
- 写法接近标准 Web API
- 路由清晰，适合小到中型 API 项目

如果你想把依赖压到最低，也可以直接使用原生 `fetch` handler；但从可维护性看，MVP 用 Hono 更合适。

#### 主存储

推荐 `KV` 作为 MVP 主存储。

原因：

- 你的核心需求是“读最新结果”，不是复杂查询
- 最新推荐、刷新状态、运行配置都非常适合 KV
- 读多写少，KV 能把成本和复杂度都压低
- 免费版下也更容易控制额度

建议只使用一个 KV namespace，但拆成多个 key，不要把所有内容塞进一个大 JSON。

建议 key：

- `eth:put:latest_market`
- `eth:put:latest_recommendations`
- `eth:put:last_refresh_status`
- `eth:put:config`

#### 数据库

`D1` 改为二期可选，而不是 MVP 必需项。

适用场景：

- 你需要保存历史推荐记录
- 你需要对比不同时间点的筛选结果
- KV 数据丢失或过期后，需要结构化兜底
- 后续要做统计和回测

如果你前期只支持 ETH Put，且只关心“当前推荐是什么”，可以先不上 D1。

#### 原始数据存档

`R2` 在当前阶段不建议接入。

原因：

- 你还没有原始数据回放需求
- 先接入只会增加维护面
- 免费版优先时应避免非必要存储

#### 前端

推荐先做一个与 Worker 同仓部署的简单 Dashboard。

建议方式：

- 一个 `/` 页面展示最新推荐
- 一个 `/api/*` 提供 JSON 数据
- 前端先做极简静态页面，不要先上复杂 SPA

MVP 阶段不建议先拆成独立前后端两个项目。

## 9. 不建议当前就上的技术

- `Durable Objects`：当前不需要强一致会话状态
- `Queues`：除非后续有大量异步抓取和重试需求
- `Workflows`：MVP 的调度链路比较短，Cron 即可
- `ORM`：当前表结构简单，直接 SQL 更直观
- `WebSocket`：推荐场景不是实时撮合盘，不需要
- `React/Vite` 独立前端：当前首页静态化优先
- `单一超大 KV key`：虽然能用，但不利于更新和排错

## 10. 建议的数据源抽象

建议统一接口：

```ts
interface MarketDataProvider {
  getSpotPrice(): Promise<number>;
  getOptionChain(): Promise<OptionContract[]>;
  getImpliedVolatility(): Promise<number | null>;
}
```

候选来源：

- Spot：Binance、Coinbase、OKX
- Option Chain：Deribit、OKX
- IV：Deribit 或交易所链上字段

建议：

- Spot 和 Option Chain 可以来自不同 Provider
- IV 如果期权链已给出合约 IV，优先使用合约级数据
- `risk_free_rate` 从 US Treasury Fiscal Data API 实时获取（Treasury Bills 平均利率），失败时回退到默认值 0.02

## 11. KV 数据模型建议

### 11.1 Namespace

建议先只建一个 namespace：

- `OPTION_PUT_CACHE`

### 11.2 Keys

#### `eth:put:latest_market`

```json
{
  "underlying": "ETH",
  "spot_price": 2010,
  "market_iv": 0.68,
  "risk_free_rate": 0.02,
  "source": "deribit",
  "captured_at": "2026-03-09T00:00:00Z"
}
```

#### `eth:put:latest_recommendations`

```json
{
  "underlying": "ETH",
  "strategy": "cash_secured_put",
  "generated_at": "2026-03-09T00:00:00Z",
  "items": [
    {
      "rank": 1,
      "expiry": "2026-04-10",
      "dte": 32,
      "strike": 1750,
      "premium": 60,
      "iv": 0.68,
      "delta": -0.16,
      "position_yield": 0.0343,
      "annualized_yield": 0.391,
      "score": 0.82
    }
  ]
}
```

#### `eth:put:last_refresh_status`

```json
{
  "ok": true,
  "started_at": "2026-03-09T00:00:00Z",
  "finished_at": "2026-03-09T00:00:04Z",
  "provider": "deribit",
  "message": "refresh completed"
}
```

#### `eth:put:config`

```json
{
  "min_iv": 0.6,
  "min_dte": 30,
  "max_dte": 45,
  "min_abs_delta": 0.1,
  "max_abs_delta": 0.2,
  "min_position_yield": 0.02
}
```

## 12. D1 数据模型建议（二期可选）

### 12.1 `market_snapshots`

```sql
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  underlying TEXT NOT NULL,
  spot_price REAL NOT NULL,
  iv REAL,
  risk_free_rate REAL NOT NULL,
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL
);
```

### 12.2 `option_candidates`

```sql
CREATE TABLE option_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  underlying TEXT NOT NULL,
  expiry TEXT NOT NULL,
  dte INTEGER NOT NULL,
  strike REAL NOT NULL,
  premium REAL NOT NULL,
  iv REAL,
  delta REAL,
  position_yield REAL,
  annualized_yield REAL,
  score REAL,
  source TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
```

### 12.3 `recommendations`

```sql
CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rank INTEGER NOT NULL,
  underlying TEXT NOT NULL,
  expiry TEXT NOT NULL,
  dte INTEGER NOT NULL,
  strike REAL NOT NULL,
  premium REAL NOT NULL,
  iv REAL,
  delta REAL,
  position_yield REAL,
  annualized_yield REAL,
  score REAL,
  generated_at TEXT NOT NULL
);
```

## 13. API 设计

### 13.1 对外接口

#### `GET /api/health`

用途：

- 健康检查

返回示例：

```json
{
  "ok": true,
  "time": "2026-03-09T00:00:00Z"
}
```

#### `GET /api/market/latest`

用途：

- 返回 KV 中的最新市场快照

#### `GET /api/recommendations`

用途：

- 返回 KV 中的最新推荐列表

查询参数：

- `limit=3`

#### `POST /api/refresh`

用途：

- 手动触发重新抓取和计算

说明：

- 必须加鉴权
- 不应对公网开放

#### `GET /api/status`

用途：

- 返回最近一次 Cron 刷新状态

当前 MVP 不建议先开放 `GET /api/strikes`，避免把中间态查询做重。

## 14. Worker 内部模块划分

建议目录：

```text
src/
  index.ts
  routes/
    health.ts
    market.ts
    recommendations.ts
    status.ts
  providers/
    spot.ts
    options.ts
    volatility.ts
  strategy/
    blackScholes.ts
    delta.ts
    filters.ts
    scoring.ts
  storage/
    kv.ts
  jobs/
    refreshMarketData.ts
  types/
    market.ts
    option.ts
```

如果二期接入 D1，再增加：

```text
  repositories/
    snapshots.ts
    recommendations.ts
```

## 15. 定时任务设计

建议初始刷新频率：

- 免费版优先：每 `4` 小时一次
- 需要更高新鲜度：每 `1` 小时一次

MVP 原因：

- 对筛选工具已足够
- 可以降低第三方 API 压力
- 也更符合 Worker 的轻量调度模型

不建议免费版一开始就做高频 Cron。

## 16. 免费版容量评估

### 16.1 Cloudflare 免费版关键额度

- Workers：`100,000 requests/day`
- Workers 速率限制：`1,000 requests/min`
- Cron Triggers：最多 `5`
- KV：`100,000 reads/day`
- KV：`1,000 writes/day`

这类额度对当前单标的、预计算、KV 读取的场景是够用的。

### 16.2 抓取频率评估

假设每次 Cron 执行：

- 请求 3 个外部接口
- 写入 3 个 KV key

如果每 `1` 小时抓一次：

- `24` 次/天
- `72` 次外部 fetch/天
- `72` 次 KV 写入/天

如果每 `4` 小时抓一次：

- `6` 次/天
- `18` 次外部 fetch/天
- `18` 次 KV 写入/天

两种频率都远低于 KV 免费写入上限。

### 16.3 访问量评估

如果首页静态化，用户每次访问只额外请求：

- `GET /api/recommendations`
- `GET /api/market/latest`

则每次访问约消耗 `2` 个 Worker 请求和 `2` 个 KV 读。

在 `1` 小时抓一次的情况下，粗略可承受：

- 约 `49,000+` 次访问/天

这已经远高于你当前阶段的实际需求。

### 16.4 真正的风险点

- 前端高频轮询
- 用户请求时实时抓第三方 API
- 把历史查询也放到高频接口上
- 把所有内容塞进一个大 KV value 并频繁整体重写

### 16.5 推荐结论

免费版优先时，建议默认方案：

- 静态首页
- KV 作为主存储
- 每 `4` 小时一次 Cron
- 如需要更高时效，再切到每 `1` 小时一次

## 17. 实现顺序

### Phase 1

- 初始化 Worker 项目
- 接入 Hono
- 建立基础路由
- 配置 KV
- 提供静态首页

### Phase 2

- 接入 Spot Provider
- 接入 Option Chain Provider
- 建立统一数据结构

### Phase 3

- 实现 Black-Scholes 和 Delta
- 实现 DTE、Yield、Score
- 输出推荐结果
- 将结果写入 KV

### Phase 4

- 接入 Cron Trigger
- 提供 Dashboard
- 增加刷新状态输出

### Phase 5

- 增加错误处理
- 增加 provider fallback
- 增加监控与日志
- 视需求接入 D1

## 18. 风险与注意事项

### 18.1 外部数据风险

- 不同交易所期权链字段命名可能不同
- 有些 Provider 不直接给标准化 IV 或 Greeks
- 行权价、到期日、premium 口径必须统一

### 18.2 计算风险

- `premium / strike` 是简化收益指标，不代表真实全成本收益
- Delta 只是概率代理变量，不是严格 assignment probability
- IV 需要确认是合约级 IV 还是指数级 IV

### 18.3 平台风险

- Worker 不适合长时间重 CPU 计算
- 不适合大规模历史回测
- 外部 API 速率限制可能成为首个瓶颈
- KV 更适合“最新状态”，不适合复杂历史查询

## 19. 当前推荐方案

如果现在就开始开发，推荐直接按下面的最小可行架构推进：

- 单个 Cloudflare Worker
- TypeScript
- Hono
- KV
- Cron Trigger
- 静态首页
- 仅支持 ETH Put

这是最稳妥的 MVP 路线。

等你验证推荐逻辑有效后，再考虑：

- D1 历史存储
- R2 原始快照归档
- Provider 多路容灾
- 历史回测
- Wheel Mode
- 更复杂的风险评分

## 20. 参考资料

- Cloudflare Workers Overview: https://developers.cloudflare.com/workers/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare KV: https://developers.cloudflare.com/kv/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
- Hono on Cloudflare Workers: https://hono.dev/docs/getting-started/cloudflare-workers

## 21. 一句话结论

这个项目适合先做成一个运行在 Cloudflare Workers 上的轻量筛选服务，而不是传统交易系统。免费版优先时，核心重点应放在三件事上：

- 数据源标准化
- 指标计算正确
- 推荐结果稳定可解释
- 请求路径足够轻

只要这三件事成立，后续再扩展 UI、回测和自动化执行都比较顺。
