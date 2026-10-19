# dsh-team-manager

独立的 DSH 插件，界面品牌名 TeamManeger，内含 Skill 与 Subagent 两个管理模块，不依赖安装旧版 SkillManager 或 SubagentManager。

运行要求：Node.js >=20。插件不声明 `engines.dsh`，也不在依赖或 peer 依赖中绑定 `@deepseek-ai/dsh` / `dsh-*` 包；不匹配 DSH 版本号，不需要 DSH 版本豁免。能否运行由实际宿主接口及注册结果决定，公开 API 同样可能发生不兼容变化。

插件在执行注册前检查所需的宿主/客户端接口。检测到接口缺失、注册冲突或受保护的初始化失败时，会回滚本次已完成的注册，并通过宿主 `pluginManager` 自动持久停用 TeamManeger。客户端组件渲染错误会报告给 Host，由 Host 处理停用；修复原因后需要在插件管理器中重新启用。如果宿主的停用接口本身不可用，则无法保证完成持久停用，需要查看宿主日志并手动处理。

普通文件读写失败、网络失败或用户输入错误不属于兼容性失败，不应因此停用插件。接口存在性检查无法识别所有未来的语义变化，也无法在代码执行前捕获模块导入或语法解析失败。Subagent 派发使用当前公开的 `subagents.startActivation`，在子代理启动前按其身份应用角色提示和工具限制，不依赖已移除的 `start` / `startContinuable`。后台子代理在 DSH 重启后继续运行时，角色组合的恢复能力取决于公开接口支持；跨重启恢复的限制会在派发结果中明确提示。

设置 → TeamManeger 中有两个页签及两个独立开关：

- Skill：列表、搜索、新建、编辑、启停、导入，以及每个技能自己的「自动调用」开关。
- Subagent：列表、搜索、新建、编辑、导入及 `run_subagent` 按名称派发。

模块开关保存到 TeamManeger 自身的插件配置，通过 DSH configEditor 校验、持久化并按正常 Loader 生命周期应用。关闭 Skill 管理会撤下其管理 API；关闭 Subagent 会撤下其管理 API 和 `run_subagent`。两个都关闭时，设置页仍可用，能够重新开启。

关闭模块不会删除技能或子代理文件。关闭 Skill 管理也不会停用已存在的技能；单个技能的启停仍由技能列表中的操作控制。修改模块配置会重载插件，请先保存编辑中的表单。

## 自动调用

每个 Skill 卡片右侧有「自动调用」开关。开启后，本插件把该技能注册为一段系统提示策略：每次模型步骤开始时，模型会先检查任务是否匹配技能描述；匹配时必须先调用 `skill` 工具加载完整指令，再执行任务，不需要用户点名。关闭时保持 DSH 默认行为（模型自行判断，或由用户明确点名）。

- 自动调用状态保存在 `<skillsDir>/.dsh-team-manager/auto.json`，不写入 `SKILL.md`，因此编辑/迁移技能文件不会带出私有字段。
- 技能停用（`SKILL.md.disabled`）或声明 `disable-model-invocation: true` 时不会进入自动调用策略；界面会禁用该开关，接口也会拒绝开启。
- 删除技能会同时清理它的自动调用记录。
- 此功能依赖宿主公开的 `systemPrompt.section()`；启用 Skill 模块但缺少此接口时，运行时接口检查会触发自动停用。
- 系统提示策略在每个模型步骤重新计算，开关改动后从下一条消息起生效；界面点击后也会重新读取列表。

## 子代理派生限制

每个 Subagent 的表单里有「可再派生子代理」开关，开启后才显示「子代理数量上限」。

- **关闭开关** = 叶子代理：它自己干活，但生成子代理的工具（`subagent`、`subagent_fork`、`workflow`、`ralph` 及本插件的 `run_subagent`）会从它的会话里移除，它无法再开下级。
- **开启开关** = 可以派生，数量上限由旁边的输入框决定：**0 = 不设限**，默认 **1**。落盘为 frontmatter 的 `maxChildren`，等于 1（默认值）时不写入。
- 上限只统计**直接下级**，且在派发前检查：达到上限时本次派发被拒绝，并说明是哪个 Subagent、上限多少、已有几个下级。
- 上限记在**调用方**（正在派生的那个 Subagent）自己的定义文件上，每个 Subagent 各算各的。

**边界（如实说明）**：

- 宿主 `subagents` 服务没有「子代理数量」概念，它的 `SubagentStartRequest` 只有 `maxDepth`。因此本上限由本插件的派发工具自行计数并拦截。
- 因此它**只能约束走 `run_subagent` 的派发**。其他路径（内置 `subagent` / `subagent_fork` / `workflow` 工具）不经此处计数，除非把开关关闭、连带把这些工具一并移除。
- 计数依赖宿主公开接口 `ctx.subagents.listChildren()`。该接口不可用时，上限**不生效**（放行而不是拦截），以免因读不到目录而误拦正常派发。
- 插件重载后，子会话与角色定义的关联会丢失：此时回退为从该会话的人设正文里识别角色名。两者都识别不到时视为未命名会话，不施加上限。

## 安装

包名 `dsh-team-manager`。使用 DSH 插件管理器安装本地 tgz。升级已有包后如安装器提示 restart-required，需要重启 DSH 并刷新页面。独立版与整合版同时启用可能重复注册 run_subagent；请使用其中一套。

本包由旧名 `teammaneger` 重命名而来。若曾安装旧名版本，请先禁用或卸载旧条目再启用本包，避免两个条目同时注册同一批路由与工具。自动调用开关的状态文件已改为 `<skillsDir>/.dsh-team-manager/auto.json`；升级时会自动回退读取旧的 `.teammaneger/auto.json`，首次写入后以新目录为准，因此重命名本身不会关闭你已开启的开关。

安装与升级不使用 DSH 版本匹配或版本豁免。自动停用后，先检查宿主日志中的缺失接口或冲突原因；更新插件或解决重复注册，再从插件管理器重新启用。

## 配置

| 配置项 | 默认值 | 用途 |
| --- | --- | --- |
| skillEnabled | true | Skill 管理模块开关 |
| subagentEnabled | true | Subagent 管理模块及派发工具开关 |
| skillsDir | ~/.dsh/skills | 技能目录，默认遵循 DSH_HOME |
| agentsDir | ~/.dsh/agents | 子代理目录，默认遵循 DSH_HOME |
| importRoots | [] | 两个模块允许读取的额外导入目录 |
| provider | spawn | 子代理派发 provider |
| toolName | run_subagent | 派发工具名 |
| leafDenyTools | subagent, subagent_fork, workflow, ralph | 叶子子代理派生工具限制 |

模块配置接口为 `/dsh-team-manager/api/modules`；两个管理 API 分别为 `/dsh-team-manager/api/skill/*` 与 `/dsh-team-manager/api/subagent/*`。自动调用开关使用 `POST /dsh-team-manager/api/skill/skills/auto`。接口复用现有浏览器身份和同源检查。

## 验证

`npm test` 使用临时目录及宿主服务替身，覆盖：

- 模块开关的四种组合、配置保存和模拟重启、路由和工具清理、配置保留、无效输入、跨源请求拒绝、请求大小限制和保存失败；
- 自动调用的文件层、HTTP API、模拟重启、删除清理、停用/`disable-model-invocation` 过滤、系统提示策略、非法输入、跨源拒绝和缺少 `systemPrompt` 时的降级；
- 子代理数量上限的 frontmatter 解析与往返（默认 1、0 = 不设限、非法值拒绝）、角色识别（内存映射与重载后的人设正文回退）、超限拒绝且不触达宿主、0 不查询下级、无法识别角色或目录读不到时放行。

`tools/manifest-check.mjs` 检查包入口契约、缺少 `engines.dsh` 及未声明 DSH 运行时依赖版本，不检查 DSH 版本范围。可选的宿主清单检查使用 `node tools/host-compat-check.mjs <解包后的 app-boot 入口> <运行时 package.json>`，也可设置 `DSH_APP_BOOT` 与 `DSH_RUNTIME_MANIFEST`；未提供路径或宿主未导出评估器时会跳过，且不终止后续测试。此检查只验证宿主接受清单，不能证明运行时接口可用。

测试的 schema 替身只用于源码目录导入测试，不进入运行入口。真实依赖导入可运行 `node tools/installed-check.mjs <已安装的 lib/index.js 绝对路径>`。界面的真实渲染及点击效果需要在 DSH 设置页验收。

### 备注（Skill）

每个 Skill 可以有一条**你写的**备注，用来记「这东西是干什么的」。它保存在
`<skills-dir>/.dsh-team-manager/notes.json`，**不写进 `SKILL.md`**：改备注不会
碰到技能文件的一个字节，模型也读不到它。重建、重新导入、停用/启用技能都不会
冲掉备注；删除技能时备注一并清理。上限 160 字，存成一行。

界面上它是卡片里的可编辑字段：点击不进入编辑器，失焦即保存，`Enter` 保存，`Esc` 撤销。

### 界面源码结构

`lib/client.js` 是 Web 壳实际加载的唯一客户端文件，但它由源码生成，不要手改：

| 文件 | 作用 |
| --- | --- |
| `lib/ui.css` | 唯一的设计系统：`--tm-*` 别名、版式与组件样式 |
| `lib/skill/client.js` | Skill 页面 |
| `lib/subagent/client.js` | Subagent 页面 |
| `lib/tail.js` | 外壳：模块开关、标签栏、注册与样式安装 |
| `lib/client.js` | 生成产物（`tools/assemble-client.mjs` 拼装） |

改完源码后运行 `node tools/assemble-client.mjs`；`npm test` 会执行 `assemble-check`（产物是否与源码一致）与 `design-system-check`（渲染用到的 `tm_*` 类是否都有规则、样式表里是否有未使用的规则或未配平的注释、颜色是否只取自 `--tm-*` 别名或壳发布的主题 token）。

**改配色前必读**：宿主的主题变量（`--dsw-alias-*`）定义在 `body` 上，不是 `:root`。自定义属性只向下继承，所以本插件的 `--tm-*` 别名层必须声明在 `body` 上；声明在 `:root` 会让每条 `var()` 变成空值，并连带丢掉整条 `border`/`background`/`color` 声明——现象是「文字还在、界面没了」。同时每个 `var(--dsw-…)` 都带字面量兜底。这两条由 `design-system-check` 双向守门（改坏会失败），`tools/shell-tokens.css` 是从已安装 app.asar 里原样提取的宿主主题表，供测试对照。

## License

MIT。整合自工作区的 SkillManager 与 SubagentManager。
