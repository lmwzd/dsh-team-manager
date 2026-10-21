# 配置、开发与验证

用户操作见 [README](../README.md)，版本变化见 [更新记录](../CHANGELOG.md)。本文对应 0.2.2 的实际实现；自检与源码核对不能代替真实 GUI 操作验收。

## 组件与运行边界

要求 Node.js 20 或更高版本。[包清单](../package.json)不声明 `engines.dsh`，也不绑定 DSH 运行时依赖版本；兼容性取决于实际接口及注册结果。

[组合补丁](../cordis.patch.yml)注册两个条目：

- `dsh-team-manager`：设置页、Skill 和 Subagent 管理。
- `dsh-team-manager/recycle`：独立的会话回收站，默认关闭。

回收站由组件页的独立开关控制，不使用 `recycleEnabled` 配置字段。主组件与回收站各自拥有生命周期；Skill/Subagent 开关不控制回收站。模块开关经 `configEditor.edit()` 保存，再按 Loader 生命周期重载。

[回收站适配层](../lib/recycle/mount.js)在存储服务准备后先挂载 trash，再挂载 delete。组件关闭时一并撤下删除路由、回收路由、服务及定时器，避免退化为永久删除。复制来的上游文件头中描述独立 delete/trash 的旧说明，不代表整合组件的开关行为。

## 主组件配置

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `skillEnabled` | `true` | Skill 管理与自动调用附加策略 |
| `subagentEnabled` | `true` | Subagent 管理及派发工具 |
| `skillsDir` | `~/.dsh/skills` | 默认值遵循 DSH_HOME；自定义路径支持 `~` |
| `agentsDir` | `~/.dsh/agents` | 默认值遵循 DSH_HOME；自定义路径支持 `~` |
| `importRoots` | `[]` | 额外允许读取的导入根目录 |
| `provider` | `spawn` | 宿主子代理派发 provider，不是模型渠道 |
| `toolName` | `run_subagent` | 成员派发工具名 |
| `leafDenyTools` | `subagent`, `subagent_fork`, `workflow`, `ralph` | 叶子成员受限的派生工具，始终追加本插件派发工具名 |

关闭管理模块不会删除定义文件。关闭 Skill 管理不等于停用已有技能；关闭 Subagent 会撤下管理 API 与派发工具。两个模块都关闭时，设置页仍能重新启用。切换前先保存表单。

默认数据位置从 DSH_HOME 取得；未设置时使用用户的 `.dsh`。导入根还包括宿主工作区和经目录选择器授权的路径。

## HTTP 与兼容性处理

| 接口 | 用途 |
| --- | --- |
| `/dsh-team-manager/api/modules` | Skill/Subagent 模块状态；回收站状态取实际服务 |
| `/dsh-team-manager/api/skill/*` | 技能管理 |
| `/dsh-team-manager/api/subagent/*` | 角色管理与模型目录 |
| `/dsh-team-manager/api/status` | 主组件停用原因与处理结果 |
| `/session-delete/api/delete` | 删除并交给已挂载的回收站服务 |
| `/session-delete/api/trash/*` | 查询、恢复、清理与保留期设置 |

保存备注和自动调用分别使用 `POST /dsh-team-manager/api/skill/skills/note` 与 `POST /dsh-team-manager/api/skill/skills/auto`。

接口优先使用宿主 connection admission；缺失时执行结构化 loopback／同源检查。保存路径、名称和请求体受校验，不能把这些接口当作无鉴权的远程管理接口。

[兼容性守卫](../lib/compatibility.js)检查所需接口；缺失接口、重复注册或受保护的初始化异常会回滚本次注册，并尝试持久停用主组件。客户端渲染边界会报告冲突。修复原因后需重新启用；停用服务自身不可用时无法保证持久停用，应查看宿主日志。

普通文件错误、网络失败和输入错误不视为兼容性故障。接口存在性检查不能证明未来语义兼容，也无法提前捕获模块导入或语法解析失败。

## Skill 状态与备注

源码：[文件与状态层](../lib/skill/skills.js)、[Host](../lib/skill/index.js)、[客户端](../lib/skill/client.js)。

- 自动调用状态：`<skillsDir>/.dsh-team-manager/auto.json`。兼容回退读取旧 `.teammaneger/auto.json`，首次写入后使用新位置。
- 备注：同目录的 `notes.json`，按目录 ID 保存，最多 160 字符，换行归一化为单行；不会改技能正文。删除技能同步清理相关状态。
- 技能启停：在 `SKILL.md` 和 `SKILL.md.disabled` 间改名。

附加提示策略通过公开的 `systemPrompt.section()` 注册，在后续模型步骤重新读取可调用技能。匹配依据是名称与 description；停用及 `disable-model-invocation: true` 的技能被排除，备注不进入策略。

卡片的绝对定位按钮承接标题和空白处点击。非交互层使用低权重 `:where()` 规则使点击穿透，备注和功能按钮恢复独立 `pointer-events`；这些选择器的权重顺序受回归检查约束。

备注失焦提交，Enter 触发失焦。当前 Escape 分支同时更新 React 状态并触发 blur，不能可靠承诺取消保存，因此用户指南不把 Escape 撤销列为已实现功能。

## Subagent 派发边界

源码：[角色解析](../lib/subagent/agents.js)、[Host 派发](../lib/subagent/index.js)、[表单](../lib/subagent/client.js)。

角色定义为 `<agentsDir>/<name>.md`。frontmatter 支持 `name`、`display_name`、`description`、`model`、`thinking`、`deep`、`maxChildren`、`background`、`maxRounds`；正文作为角色设定。

保存或删除会重建工具名单。每次派发重新读取所选定义，因此新任务使用新设定，已有会话不热替换人设。文件留空模型时不写固定路由，由宿主继承策略决定；指定模型时通过 `agentOptions` 传递渠道与模型。思考强度优先使用模型声明的词汇，必要时映射别名或回退模型默认并记录日志。

派发使用公开的 `subagents.startActivation()`，在 `agent/created` 时为预留子会话 ID 安装人设和工具限制。子代理只获得显式任务提示，不自动共享主会话全文。后台派发返回 ID，并由宿主通知完成；插件或宿主重载后不能保证旧角色组合恢复，应重新按名称启动。

### 深度、数量与轮次

- `deep: 0` 是叶子角色，移除受限派生工具；默认 deny 名单与当前宿主工具取交集。
- `deep >= 1` 是子代理以下的相对深度预算，启动时使用 `maxDepth = childDepth + deep`。界面开关保存 0／1；手工配置更大值后再通过表单保存会归一为 1。
- `maxChildren` 默认 1、0 为不限。只在 `run_subagent` 派发前检查调用方角色的直接下级目录记录，不拦截内置 `subagent`、`subagent_fork`、`workflow` 路径，也不是原子的并发配额锁。
- 名称优先来自当前插件生命周期内的会话映射；重载后尝试扫描人设中的 `name:`。无法识别、文件不可读或 `listChildren` 不可用／读取失败时放行。不能假设宿主目录只包含活跃下级。
- `maxRounds` 当前可保存、展示和校验，但没有传入宿主派发参数，不能承诺该角色的轮次限制实际生效。

[五人模板](../examples/agents/README.md)是可选示例，安装不会复制或覆盖用户定义；示例不包含本机模型渠道和思考强度。

## 会话回收站的数据与清理

源码：[组件入口](../lib/recycle/component.js)、[生命周期适配](../lib/recycle/mount.js)、[存储](../lib/recycle/trash.js)、[客户端](../lib/recycle/client.js)。原 MIT 声明在 [LICENSE](../lib/recycle/LICENSE)。

沿用 `<DSH_HOME>/session-delete/trash.json` 和 `session-delete/logs/`，保留旧记录与保留期。请关闭旧独立插件，避免两个存储实例同时写同一索引。

保留期默认 7 天，范围 3–30 天。启用时执行到期清理，此后每 6 小时检查。手动彻底删除和清空需确认，到期清理不逐条询问；完成后均无法恢复。恢复依赖宿主重新关联工作区，原工作区注册丢失时应先解决错误再重试。

索引加载采用共享 Promise，启动清理与首次查询等待同一次加载，避免首次请求误用默认保留期或空索引。

## 客户端构建

| 文件 | 职责 |
| --- | --- |
| [lib/ui.css](../lib/ui.css) | 主题别名与共享样式 |
| [Skill](../lib/skill/client.js) / [Subagent](../lib/subagent/client.js) | 两个管理页面 |
| [回收站客户端](../lib/recycle/client.js) | 菜单、侧栏、回收面板与确认框 |
| [lib/tail.js](../lib/tail.js) | 页签、模块开关与设置入口 |
| [lib/client.js](../lib/client.js) | Web 壳加载的生成产物，勿手改 |

```bash
node tools/assemble-client.mjs
npm test
```

宿主 `--dsw-alias-*` 在 body 上定义，插件的 `--tm-*` 别名也应声明在 `body`，避免向上继承失败；引用附字面量兜底。[主题表](../tools/shell-tokens.css)供检查对照。

文档示意图有独立生成脚本：[generate-doc-diagrams.py](../tools/generate-doc-diagrams.py)。安装 Pillow 后运行，生成 PNG 与 SVG；在非 Windows 环境通过 `DOCS_FONT` 和 `DOCS_FONT_BOLD` 指定中文字体。图是说明产物，不用于证明实际页面显示正确。

## 检查与发布

[测试入口](../tools/test-all.mjs)按顺序执行清单、组装一致性、设计系统、文档链接与模板、模块组合、回收站、备注和成员派发等验证。测试使用隔离目录与宿主替身。

可选宿主检查：

```bash
node tools/host-compat-check.mjs <解包后的-app-boot-入口> <运行时-package.json>
node tools/installed-check.mjs <已安装的-lib/index.js-绝对路径>
```

也可设置 `DSH_APP_BOOT`／`DSH_RUNTIME_MANIFEST`。缺少路径或宿主未导出评估器时会跳过；清单检查不代表真实接口均可运行。

发布前运行自检并检查实际 tarball 包含图片、模板、运行代码、图标及许可证，排除本地发布脚本、凭据和临时文件。安装后按管理器结果刷新或重启。真实 GUI 验收需覆盖两个组件入口、备注聚焦与保存、按钮独立性、成员导入与派发、恢复及清理确认；本次图文更新没有完成该浏览器验收。
