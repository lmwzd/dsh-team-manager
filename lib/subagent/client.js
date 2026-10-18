/**
 * Client half of dsh-team-manager-subagent — a hand-written ModuleLoader bundle
 * (the shape the DSH web shell loads; no build step, only `react` from the
 * shell's module table).
 *
 * Contributes one thing: a `settings.section` page ("Subagent 管理") where
 * the user can add / edit / delete custom subagents. Each subagent is one
 * `<agents-dir>/<name>.md` file on the host; this page reads and writes it
 * through the plugin's own `/dsh-team-manager/api/subagent/*` routes (same-origin,
 * served by the host process that also owns the files — the same transport
 * pattern dsh-our-free-model uses).
 *
 * The editor form maps 1:1 onto the frontmatter keys the dispatch tool reads:
 *   name / display_name / description / model / thinking / deep / background
 *   / maxRounds + the persona body (设定说明书).
 * The model picker lists the live provider catalog from `/models` and also
 * accepts a hand-typed `provider/model` route; picking one writes both.
 *
 * All colours come from the shell's theme variables so the page survives a
 * light/dark switch.
 */
window.__ModuleLoader__.load({
  id: 'dsh-team-manager-subagent',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h, Fragment, useState, useEffect, useMemo, useCallback, useRef } = React
    // `react-dom` is a platform seed word of the DSH shell (its boot graph maps
    // react, react-dom and their runtimes). Modals are portalled to
    // `document.body` when it is offered: the settings panel is a glass surface
    // whose backdrop-filter/transform ancestors make a plain `position: fixed`
    // child behave relative to THAT ancestor (scrollable, clipped) instead of
    // the viewport. Resolved defensively so an older shell — or the headless
    // self-check, where `document` is undefined — simply renders in place.
    let createPortal = null
    try {
      const reactDom = require('react-dom')
      if (typeof reactDom?.createPortal === 'function') createPortal = reactDom.createPortal
    } catch { createPortal = null }
    /** Render one element through the portal when the shell offers one. */
    function toplevel(element) {
      if (createPortal !== null && typeof document !== 'undefined' && document.body !== null && document.body !== undefined) {
        return createPortal(element, document.body)
      }
      return element
    }

    const PLUGIN_NAME = 'dsh-team-manager-subagent'
    const NS = 'settings.dsh-team-manager.subagent'
    const API = '/dsh-team-manager/api/subagent'
    // The union the host half accepts; the editor narrows this to whatever the
    // selected model actually declares once a route is chosen.
    const THINKING_LEVELS = ['off', 'light', 'low', 'medium', 'balanced', 'high', 'deep', 'max']

    const inject = ['slots', 'locale']

    // ── copy ────────────────────────────────────────────────────────────────
    const DICT = {
      zh: {
        nav: 'Subagent 管理',
        title: '自定义 Subagent',
        subtitle: '每个 Subagent 是一份 <名称>.md：frontmatter 定义身份与模型，正文是它的设定说明书（system prompt）。保存后，会话中可直接用名字给它派发任务（run_subagent 工具）。',
        dir: '文件目录',
        add: '新建 Subagent',
        refresh: '刷新',
        loading: '正在加载…',
        loadFailed: '无法连接插件后端',
        retry: '重试',
        empty: '还没有定义任何 Subagent，点击「新建 Subagent」开始。',
        search: '搜索名称 / 描述…',
        broken: '解析失败的文件',
        brokenHint: '这些文件存在但无法解析，已从调度名单中排除；修复或删除后自动恢复。',
        delete: '删除',
        deleteConfirm: '删除 Subagent「{name}」？',
        deleteBody: '将删除 {path}。正在运行的子会话不受影响，但之后无法再按名字调用它。',
        deleteOk: '已删除',
        cancel: '取消',
        save: '保存',
        saving: '保存中…',
        saved: '已保存 {name}',
        saveFailed: '保存失败',
        back: '返回列表',
        f_name: '名称（调用名）',
        f_nameHint: '字母 / 数字 / - _ . / 中文；这是文件名，也是会话中赋予任务时用的名字。',
        f_nameTaken: '名称 {name} 已存在（换一个或先编辑现有的）',
        f_nameInvalid: '名称不合法：不能为空、不能包含 / 或 \\、不能以 . 开头',
        f_displayName: '显示名（可选）',
        f_displayNameHint: '列表与运行标签里显示的友好名字，如「牛马狗」。',
        f_description: '描述',
        f_descriptionHint: '一句话说明它是干什么的；会进入工具的子代理名单，模型据此挑选。',
        f_model: '模型',
        f_modelHint: 'provider/model 路由。从目录选择，或直接输入自定义路由；留空则跟随默认模型。',
        f_modelDefault: '（跟随默认模型）',
        f_modelCustom: '自定义路由…',
        f_modelCustomPlaceholder: 'provider/model，例如 volc-ark-plan/deepseek-v4-flash',
        f_thinking: '思考强度',
        f_thinkingDefault: '（默认）',
        f_deep: '可再派生子代理',
        f_deepHint: '关闭 = 叶子代理：自己干活但不再开子会话（生成子代理的工具会被移除）。',
        f_background: '默认后台运行',
        f_backgroundHint: '开启后按名字调用时立即返回子会话 id，可稍后追问；关闭则原地等待结果。',
        f_maxRounds: '轮次上限（可选）',
        f_maxRoundsPlaceholder: '留空 = 使用全局上限',
        f_body: '设定说明书（system prompt）',
        f_bodyHint: '正文整体作为该 Subagent 的人设/系统提示；子代理不共享当前对话，写清楚职责、原则与边界。',
        meta_model: '模型',
        meta_thinking: '思考',
        meta_default: '默认',
        meta_background: '后台',
        meta_leaf: '叶子',
        meta_deep: '可派生 {n} 层',
        meta_rounds: '{n} 轮',
        meta_bodySize: '{kb} KB',
        newTitle: '新建 Subagent',
        editTitle: '编辑 {name}',
        dispatchHintTitle: '在工作区会话中怎么用',
        dispatchHint: '启用后直接对主会话说：「用 <名称> 帮我做 …」。模型会调用 run_subagent 工具，按名字把任务交给这个 Subagent。',
        fetchFailed: '请求失败（HTTP {status}）',
        // ── import ──────────────────────────────────────────────────────────
        'import.button': '导入已有设定…',
        'import.title': '导入设定说明书',
        'import.hint': '读取你已写好的 .md / .txt 设定（可浏览目录、预览、单个导入或批量导入），填入新建表单后保存；已存在的同名 Subagent 不会被覆盖。点击「浏览」可用系统窗口选择任意文件夹。',
        'import.pickRootHint': '点击「浏览」打开系统目录选择窗口，由你自己选路径；选定后显示设定文件。取消选择会保留当前列表。也可以手动输入路径后按回车。',
        'import.path': '目录路径',
        'import.go': '浏览',
        'import.files': '可导入的文件',
        'import.dirs': '子目录',
        'import.up': '上一级',
        'import.emptyDir': '这个目录下没有 .md / .txt 文件。',
        'import.select': '选择要批量导入的文件',
        'import.preview': '预览 / 导入',
        'import.selected': '已选 {n} 个',
        'import.batch': '批量导入所选',
        'import.intoEditor': '填入编辑器',
        'import.batchDone': '导入完成：成功 {ok}，跳过 {skipped}，失败 {failed}',
        'import.status.imported': '已导入',
        'import.status.skipped': '跳过（同名已存在）',
        'import.status.failed': '失败',
        'import.status.rejected': '拒绝（越界路径）',
        'import.failed': '导入失败',
        'import.previewMeta': '名称 {name} · 显示名 {displayName} · 描述 {description}',
        'import.close': '关闭',
        'import.back': '返回',
        'import.pickRoot': '选择目录',
        'import.previewTitle': '预览',
        'import.bodyPreview': '正文预览（前 {n} 字符）：',
        'import.hadFrontmatter': '该文件已带 frontmatter，按 Subagent 格式导入。',
        'import.single': '直接导入此文件',
      },
      en: {

        nav: 'Subagent Manager',
        title: 'Custom Subagents',
        subtitle: 'Each subagent is one <name>.md file: frontmatter defines identity and model, the body is its persona (system prompt). After saving, workspace sessions can dispatch it by name (run_subagent tool).',
        dir: 'Files directory',
        add: 'New Subagent',
        refresh: 'Refresh',
        loading: 'Loading…',
        loadFailed: 'Cannot reach the plugin backend',
        retry: 'Retry',
        empty: 'No subagents yet — click "New Subagent" to start.',
        search: 'Search name / description…',
        broken: 'Unparsable files',
        brokenHint: 'These files exist but failed to parse and are excluded from the roster; fix or delete them.',
        delete: 'Delete',
        deleteConfirm: 'Delete subagent "{name}"?',
        deleteBody: 'Removes {path}. Running child sessions are unaffected, but it can no longer be dispatched by name.',
        deleteOk: 'Deleted',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved {name}',
        saveFailed: 'Save failed',
        back: 'Back to list',
        f_name: 'Name (dispatch key)',
        f_nameHint: 'letters / digits / - _ . / CJK; this is the file name and the name used to dispatch it.',
        f_nameTaken: 'Name {name} already exists (pick another or edit the existing one)',
        f_nameInvalid: 'Invalid name: required, no `/` or `\\`, must not start with `.`',
        f_displayName: 'Display name (optional)',
        f_displayNameHint: 'Friendly label shown in lists and run labels.',
        f_description: 'Description',
        f_descriptionHint: 'One line on what it does; it feeds the tool roster the model reads to pick an agent.',
        f_model: 'Model',
        f_modelHint: 'provider/model route. Pick from the live catalog or type a custom route; empty follows the default model.',
        f_modelDefault: '(follow default model)',
        f_modelCustom: 'Custom route…',
        f_modelCustomPlaceholder: 'provider/model, e.g. volc-ark-plan/deepseek-v4-flash',
        f_thinking: 'Thinking',
        f_thinkingDefault: '(default)',
        f_deep: 'May spawn sub-subagents',
        f_deepHint: 'Off = leaf agent: it works itself but cannot start children (spawn tools are removed from it).',
        f_background: 'Background by default',
        f_backgroundHint: 'When on, dispatch returns a child-session id immediately and can be followed up later.',
        f_maxRounds: 'Round cap (optional)',
        f_maxRoundsPlaceholder: 'empty = global cap',
        f_body: 'Persona / system prompt',
        f_bodyHint: 'The body is the agent\'s system prompt; the subagent does not share this conversation — state duties, principles, boundaries.',
        meta_model: 'model',
        meta_thinking: 'thinking',
        meta_default: 'default',
        meta_background: 'bg',
        meta_leaf: 'leaf',
        meta_deep: 'depth {n}',
        meta_rounds: '{n} rounds',
        meta_bodySize: '{kb} KB',
        newTitle: 'New Subagent',
        editTitle: 'Edit {name}',
        dispatchHintTitle: 'How to use it in a session',
        dispatchHint: 'Tell the main session: "use <name> to …". The model calls run_subagent and hands the task to this subagent by name.',
        fetchFailed: 'Request failed (HTTP {status})',
        // ── import ──────────────────────────────────────────────────────────
        'import.button': 'Import existing specs…',
        'import.title': 'Import persona specs',
        'import.hint': 'Read .md / .txt specs you already wrote (browse a directory, preview, import one by one or in batch); batch import writes files directly and never overwrites an existing subagent of the same name. Click Browse to choose any folder with the system picker.',
        'import.pickRootHint': 'Click Browse to open the system folder picker and choose the folder yourself; the specs it contains are then listed. Cancelling keeps the current list. You can also type a path and press Enter.',
        'import.path': 'Directory path',
        'import.go': 'Browse',
        'import.files': 'Importable files',
        'import.dirs': 'Subdirectories',
        'import.up': 'Up one level',
        'import.emptyDir': 'No .md / .txt files in this directory.',
        'import.select': 'Select files for batch import',
        'import.preview': 'Preview / import',
        'import.selected': '{n} selected',
        'import.batch': 'Batch import selected',
        'import.intoEditor': 'Fill into editor',
        'import.batchDone': 'Import done: {ok} imported, {skipped} skipped, {failed} failed',
        'import.status.imported': 'imported',
        'import.status.skipped': 'skipped (name exists)',
        'import.status.failed': 'failed',
        'import.status.rejected': 'rejected (outside allowed roots)',
        'import.failed': 'Import failed',
        'import.previewMeta': 'name {name} · display {displayName} · description {description}',
        'import.close': 'Close',
        'import.back': 'Back',
        'import.pickRoot': 'Choose a directory',
        'import.previewTitle': 'Preview',
        'import.bodyPreview': 'Body preview (first {n} characters):',
        'import.hadFrontmatter': 'This file already carries frontmatter and imports as a Subagent.',
        'import.single': 'Import this file',
      },
    }

    // ── styles (theme variables only) ───────────────────────────────────────
    const CSS = `
.sm_root { color: var(--dsw-alias-text-primary, #1d2939); font-size: 14px; }
.sm_head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.sm_title { font-size: 18px; font-weight: 600; }
.sm_sub { color: var(--dsw-alias-text-secondary, #475467); font-size: 13px; margin: 4px 0 10px; line-height: 1.55; }
.sm_dir { font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); font-size: 12px; color: var(--dsw-alias-text-tertiary, #667085); background: var(--dsw-alias-bg-elevated, #f2f4f7); padding: 2px 8px; border-radius: 6px; }
.sm_bar { display: flex; gap: 8px; align-items: center; margin: 10px 0; flex-wrap: wrap; }
.sm_input, .sm_select, .sm_textarea {
  background: var(--dsw-alias-bg-elevated, #fff);
  color: var(--dsw-alias-text-primary, #1d2939);
  border: 1px solid var(--dsw-alias-border-primary, #d0d5dd);
  border-radius: 8px; padding: 7px 10px; font-size: 13px; font-family: inherit;
}
.sm_input:focus, .sm_select:focus, .sm_textarea:focus { outline: 2px solid var(--dsw-alias-border-focus, #84adff); }
.sm_search { flex: 1 1 220px; min-width: 180px; }
.sm_button {
  border: 1px solid var(--dsw-alias-border-primary, #d0d5dd); background: var(--dsw-alias-interactive-bg-subtle, #f2f4f7);
  color: var(--dsw-alias-text-primary, #1d2939); border-radius: 8px; padding: 7px 14px; font-size: 13px; cursor: pointer;
}
.sm_button:hover { filter: brightness(0.97); }
.sm_button:disabled { opacity: 0.55; cursor: default; }
.sm_button_primary { background: var(--dsw-alias-interactive-bg-primary, #4f8cff); color: #fff; border-color: transparent; }
.sm_button_danger { background: transparent; color: var(--dsw-alias-text-danger, #d92d20); border-color: var(--dsw-alias-border-danger, #fda29b); }
.sm_list { display: flex; flex-direction: column; gap: 8px; }
.sm_card {
  border: 1px solid var(--dsw-alias-border-primary, #e4e7ec); border-radius: 10px; padding: 10px 14px;
  background: var(--dsw-alias-bg-elevated, #fff); cursor: pointer; display: flex; gap: 12px; align-items: flex-start;
}
.sm_card:hover { border-color: var(--dsw-alias-border-focus, #84adff); }
.sm_card_main { flex: 1 1 auto; min-width: 0; }
.sm_card_name { font-weight: 600; font-size: 14px; }
.sm_card_display { color: var(--dsw-alias-text-secondary, #475467); font-weight: 400; margin-left: 6px; }
.sm_card_desc { color: var(--dsw-alias-text-secondary, #475467); font-size: 12.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sm_tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.sm_tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--dsw-alias-interactive-bg-subtle, #f2f4f7); color: var(--dsw-alias-text-secondary, #475467); }
.sm_tag_model { background: color-mix(in srgb, var(--dsw-alias-interactive-bg-primary, #4f8cff) 14%, transparent); color: var(--dsw-alias-interactive-bg-primary, #4f8cff); }
.sm_tag_warn { background: color-mix(in srgb, #f79009 20%, transparent); color: #b54708; }
.sm_broken { margin-top: 14px; }
.sm_broken_row { font-size: 12px; color: var(--dsw-alias-text-danger, #d92d20); font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); margin-top: 4px; }
.sm_callout { border: 1px solid var(--dsw-alias-border-warning, #fedf89); background: var(--dsw-alias-bg-warning, #fffaeb); color: var(--dsw-alias-text-primary, #93600a); border-radius: 10px; padding: 10px 14px; margin: 10px 0; }
.sm_callout_error { border-color: var(--dsw-alias-border-danger, #fda29b); background: var(--dsw-alias-bg-danger, #fef3f2); color: var(--dsw-alias-text-danger, #d92d20); }
.sm_form { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
.sm_field { display: flex; flex-direction: column; gap: 4px; }
.sm_field label { font-weight: 600; font-size: 13px; }
.sm_hint { color: var(--dsw-alias-text-tertiary, #667085); font-size: 12px; line-height: 1.5; }
.sm_error { color: var(--dsw-alias-text-danger, #d92d20); font-size: 12px; }
.sm_row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sm_row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.sm_textarea { min-height: 300px; resize: vertical; font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); font-size: 12.5px; line-height: 1.6; white-space: pre; }
.sm_switch { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.sm_switch input { width: 16px; height: 16px; accent-color: var(--dsw-alias-interactive-bg-primary, #4f8cff); }
.sm_actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.sm_saved { color: #12b76a; font-size: 12.5px; }
.sm_modal {
  position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-overlay-scrim, #101828) 55%, transparent);
}
.sm_dialog {
  width: min(440px, calc(100vw - 48px)); padding: 20px 24px; border-radius: 12px;
  background: var(--dsw-alias-bg-elevated, #fff); color: var(--dsw-alias-text-primary, #101828);
  box-shadow: 0 12px 32px rgba(16,24,40,.24); font-size: 14px;
}
.sm_dialog h3 { margin: 0 0 8px; font-size: 16px; }
.sm_dialog p { margin: 0 0 18px; color: var(--dsw-alias-text-secondary, #475467); font-size: 13px; line-height: 1.55; word-break: break-all; }
.sm_modal_actions { display: flex; justify-content: flex-end; gap: 8px; align-items: center; }
.sm_dialog_wide { width: min(640px, calc(100vw - 48px)); max-height: 82vh; overflow: auto; }
.sm_tag_link { cursor: pointer; border: 1px solid var(--dsw-alias-border-primary, #d0d5dd); background: var(--dsw-alias-bg-elevated, #fff); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sm_tag_link:hover { border-color: var(--dsw-alias-border-focus, #84adff); color: var(--dsw-alias-interactive-bg-primary, #4f8cff); }
.sm_files { max-height: 240px; overflow: auto; border: 1px solid var(--dsw-alias-border-primary, #e4e7ec); border-radius: 8px; padding: 6px 8px; }
.sm_file_row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.sm_file_name { flex: 1 1 auto; text-align: left; background: none; border: none; color: var(--dsw-alias-text-primary, #1d2939); font-size: 13px; cursor: pointer; font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.sm_file_name:hover { color: var(--dsw-alias-interactive-bg-primary, #4f8cff); }
.sm_preview { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-interactive-bg-subtle, #f2f4f7); }
.sm_result_row { padding: 2px 0; }
.sm_preview_grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 8px 0; }
.sm_body_pre {
  margin: 4px 0 0; padding: 10px 12px; border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-subtle, #f2f4f7); color: var(--dsw-alias-text-primary, #1d2939);
  font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; max-height: 340px; overflow: auto;
}
@media (max-width: 720px) { .sm_row2, .sm_row3, .sm_preview_grid { grid-template-columns: 1fr; } }
`

    // ── tiny API helper ─────────────────────────────────────────────────────
    async function apiGet(path) {
      const response = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } })
      const payload = await response.json().catch(() => undefined)
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? `HTTP ${response.status}`)
      }
      return payload
    }
    async function apiPost(path, body) {
      const response = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const payload = await response.json().catch(() => undefined)
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? `HTTP ${response.status}`)
      }
      return payload
    }

    /** useAsync: fetch-on-deps with a manual reload. */
    function useAsync(fn, deps) {
      const [state, setState] = useState({ status: 'loading', data: undefined, error: '' })
      const [nonce, setNonce] = useState(0)
      useEffect(() => {
        let alive = true
        setState((s) => ({ status: 'loading', data: s.data, error: '' }))
        fn().then(
          (data) => { if (alive) setState({ status: 'ok', data, error: '' }) },
          (error) => { if (alive) setState({ status: 'error', data: undefined, error: String(error?.message ?? error) }) },
        )
        return () => { alive = false }
      }, [...deps, nonce])
      return { ...state, reload: () => setNonce((n) => n + 1) }
    }

    /** Active UI language: the shell mirrors it onto <html lang>. */
    function localeTag() {
      try {
        const value = document.documentElement.lang || 'en'
        return value.startsWith('zh') ? 'zh' : 'en'
      } catch { return 'en' }
    }

    // ── roster helpers ──────────────────────────────────────────────────────
    const BLANK = {
      name: '', displayName: '', description: '', model: '', thinking: '',
      deep: true, background: false, maxRounds: '', body: '',
    }

    function agentToForm(meta, body) {
      return {
        name: meta.name ?? '',
        displayName: meta.displayName ?? '',
        description: meta.description ?? '',
        model: meta.model ?? '',
        thinking: meta.thinking ?? '',
        deep: (meta.deep ?? 1) > 0,
        background: meta.background === true,
        maxRounds: meta.maxRounds !== undefined ? String(meta.maxRounds) : '',
        body: body ?? '',
      }
    }

    function formToPayload(form) {
      return {
        name: form.name.trim(),
        displayName: form.displayName.trim(),
        description: form.description.trim(),
        model: form.model.trim(),
        thinking: form.thinking || undefined,
        deep: form.deep ? 1 : 0,
        background: form.background,
        maxRounds: form.maxRounds.trim() === '' ? undefined : Number(form.maxRounds.trim()),
        body: form.body,
      }
    }

    const NAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fff\u3400-\u4dbf][A-Za-z0-9_\-.\u4e00-\u9fff\u3400-\u4dbf]*$/
    function nameError(name) {
      const n = (name ?? '').trim()
      if (n === '' || n === '.' || n === '..' || n.length > 128) return 'invalid'
      return NAME_RE.test(n) ? '' : 'invalid'
    }

    // ── small components ────────────────────────────────────────────────────
    function Tag(props) {
      return h('span', { className: `sm_tag${props.kind ? ` sm_tag_${props.kind}` : ''}` }, props.children)
    }

    function Field(props) {
      return h('div', { className: 'sm_field' },
        props.label === undefined ? null : h('label', null, props.label),
        props.children,
        props.hint === undefined || props.hint === '' ? null : h('div', { className: 'sm_hint' }, props.hint),
        props.error === undefined || props.error === '' ? null : h('div', { className: 'sm_error' }, props.error))
    }

    function SwitchField(props) {
      return h('label', { className: 'sm_field' },
        h('span', { className: 'sm_switch' },
          h('input', { type: 'checkbox', checked: props.checked, onChange: (e) => props.onChange(e.target.checked) }),
          h('span', null, props.label)),
        props.hint ? h('div', { className: 'sm_hint' }, props.hint) : null)
    }

    function ConfirmDialog(props) {
      const { t, title, body, confirmLabel, onConfirm, onCancel, busy } = props
      return toplevel(h('div', {
        className: 'sm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onCancel() },
      },
        h('div', { className: 'sm_dialog', role: 'alertdialog', 'aria-modal': 'true' },
          h('h3', null, title),
          h('p', null, body),
          h('div', { className: 'sm_modal_actions' },
            h('button', { type: 'button', className: 'sm_button', onClick: onCancel, disabled: busy }, t('cancel')),
            h('button', { type: 'button', className: 'sm_button sm_button_danger', onClick: onConfirm, disabled: busy }, busy ? '…' : confirmLabel)))))
    }

    // ── model picker ────────────────────────────────────────────────────────
    function ModelPicker(props) {
      const { t, providers, value, onChange, loading } = props
      const [customMode, setCustomMode] = useState(false)
      // A stored route that is not in the (possibly still loading) catalog
      // keeps showing verbatim — the picker must not silently drop it.
      const all = useMemo(() => {
        const options = []
        for (const group of providers ?? []) {
          for (const m of group.models ?? []) options.push({ route: `${group.provider}/${m.id}`, label: `${group.displayName ?? group.provider} · ${m.name ?? m.id}` })
        }
        return options
      }, [providers])
      const known = value === '' || all.some((o) => o.route === value)
      const selectValue = customMode ? '__custom__' : (known ? value : '__custom__')
      return h(Fragment, null,
        h('select', {
          className: 'sm_select',
          value: selectValue,
          onChange: (e) => {
            const v = e.target.value
            if (v === '__custom__') { setCustomMode(true); return }
            setCustomMode(false)
            onChange(v)
          },
        },
          h('option', { value: '' }, t('f_modelDefault')),
          all.length === 0 && !loading ? h('optgroup', { label: '(catalog empty)' }, h('option', { value: '__none____', disabled: true }, '—')) : null,
          providers.map((group) => h('optgroup', { key: group.provider, label: group.displayName ?? group.provider },
            (group.models ?? []).map((m) => h('option', { key: `${group.provider}/${m.id}`, value: `${group.provider}/${m.id}` }, m.name ?? m.id)))),
          h('option', { value: '__custom__' }, t('f_modelCustom'))),
        selectValue === '__custom__' ? h('input', {
          className: 'sm_input',
          style: { marginTop: 6, width: '100%', boxSizing: 'border-box' },
          placeholder: t('f_modelCustomPlaceholder'),
          value: value,
          onChange: (e) => onChange(e.target.value),
        }) : null)
    }

    // ── editor ──────────────────────────────────────────────────────────────
    function Editor(props) {
      const { t, agents, models, modelsLoading, isNew, initial, dir, onSaved, onBack } = props
      const [form, setForm] = useState(initial)
      const [busy, setBusy] = useState(false)
      const [saveError, setSaveError] = useState('')
      const [savedAt, setSavedAt] = useState(0)
      // After the first successful save a NEW agent becomes an existing one:
      // remember its name so taken-checks and the locked name field follow.
      const [savedName, setSavedName] = useState(isNew ? '' : (initial.name ?? ''))
      const existingNames = useMemo(() => new Set((agents ?? []).map((a) => a.name)), [agents])

      const set = (key) => (v) => { setSavedAt(0); setForm((f) => ({ ...f, [key]: v })) }
      const nameErr = nameError(form.name)
      const taken = form.name.trim() !== '' && form.name.trim() !== savedName && existingNames.has(form.name.trim())
      const canSave = form.name.trim() !== '' && nameErr === '' && !taken && !busy

      const save = async () => {
        if (!canSave) return
        setBusy(true)
        setSaveError('')
        try {
          await apiPost('/agents/save', formToPayload(form))
          setSavedName(form.name.trim())
          setSavedAt(Date.now())
          onSaved()
        } catch (error) {
          setSaveError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }

      const title = savedName === '' ? t('newTitle') : t('editTitle', { name: savedName })
      return h('div', null,
        h('div', { className: 'sm_head' },
          h('button', { type: 'button', className: 'sm_button', onClick: onBack }, `← ${t('back')}`),
          h('span', { className: 'sm_title' }, title),
          savedAt > 0 && !busy ? h('span', { className: 'sm_saved' }, t('saved', { name: savedName })) : null),
        h('div', { className: 'sm_callout' }, h('b', null, t('dispatchHintTitle')), h('div', null, t('dispatchHint'))),
        h('div', { className: 'sm_form' },
          h('div', { className: 'sm_row2' },
            h(Field, {
              label: t('f_name'),
              hint: t('f_nameHint'),
              error: nameErr !== '' ? t('f_nameInvalid') : taken ? t('f_nameTaken', { name: form.name.trim() }) : '',
            },
              h('input', { className: 'sm_input', value: form.name, disabled: !isNew, onChange: (e) => set('name')(e.target.value) })),
            h(Field, { label: t('f_displayName'), hint: t('f_displayNameHint') },
              h('input', { className: 'sm_input', value: form.displayName, onChange: (e) => set('displayName')(e.target.value) }))),
          h(Field, { label: t('f_description'), hint: t('f_descriptionHint') },
            h('input', { className: 'sm_input', value: form.description, onChange: (e) => set('description')(e.target.value) })),
          h('div', { className: 'sm_row2' },
            h(Field, { label: t('f_model'), hint: t('f_modelHint') },
              h(ModelPicker, { t, providers: models?.providers ?? [], value: form.model, onChange: set('model'), loading: modelsLoading })),
            h(Field, { label: t('f_thinking') },
              (() => {
                // Offer the levels the selected model declares; fall back to the
                // union the plugin accepts when no model route is chosen yet.
                const selected = (models?.providers ?? [])
                  .flatMap((group) => (group.models ?? []).map((m) => ({ route: `${group.provider}/${m.id}`, efforts: m.efforts })))
                  .find((entry) => entry.route === form.model)
                const levels = selected?.efforts?.length ? selected.efforts : THINKING_LEVELS
                const options = levels.includes(form.thinking) || form.thinking === '' ? levels : [...levels, form.thinking]
                return h('select', { className: 'sm_select', value: form.thinking, onChange: (e) => set('thinking')(e.target.value) },
                  h('option', { value: '' }, t('f_thinkingDefault')),
                  options.map((lvl) => h('option', { key: lvl, value: lvl }, lvl)))
              })())),
          h('div', { className: 'sm_row3' },
            h(SwitchField, { label: t('f_deep'), hint: t('f_deepHint'), checked: form.deep, onChange: set('deep') }),
            h(SwitchField, { label: t('f_background'), hint: t('f_backgroundHint'), checked: form.background, onChange: set('background') }),
            h(Field, { label: t('f_maxRounds') },
              h('input', { className: 'sm_input', inputMode: 'numeric', placeholder: t('f_maxRoundsPlaceholder'), value: form.maxRounds, onChange: (e) => set('maxRounds')(e.target.value.replace(/[^\d]/g, '')) }))),
          h(Field, { label: t('f_body'), hint: t('f_bodyHint') },
            h('textarea', { className: 'sm_textarea', value: form.body, spellCheck: false, onChange: (e) => set('body')(e.target.value) })),
          saveError !== '' ? h('div', { className: 'sm_callout sm_callout_error' }, `${t('saveFailed')}: ${saveError}`) : null,
          h('div', { className: 'sm_actions' },
            h('button', { type: 'button', className: 'sm_button sm_button_primary', disabled: !canSave, onClick: save }, busy ? t('saving') : t('save')),
            h('button', { type: 'button', className: 'sm_button', disabled: busy, onClick: onBack }, t('cancel')))))
    }

    // ── import panel ────────────────────────────────────────────────────────
    // Two steps in one dialog: pick a directory (the landing page offers the
    // host's OS chooser or a typed path — NOTHING is auto-browsed, no preset
    // list), then browse its files, and PREVIEW a file as a full page that
    // replaces the list. An inline preview strip under a scrolling file list
    // renders off-screen and is indistinguishable from a dead button; a step
    // switch cannot be missed.
    const IMPORT_PREVIEW_CHARS = 4000

    function ImportDialog(props) {
      const { t, onClose, onImported, onIntoEditor } = props
      const [step, setStep] = useState('roots') // 'roots' | 'browse' | 'preview'
      const [pathInput, setPathInput] = useState('')
      const [browse, setBrowse] = useState(undefined)
      const [browseError, setBrowseError] = useState('')
      const [busy, setBusy] = useState(false)
      const [selected, setSelected] = useState({}) // path -> true
      const [preview, setPreview] = useState(undefined) // candidate
      const [previewError, setPreviewError] = useState('')
      const [results, setResults] = useState(undefined) // batch report rows

      const go = useCallback(async (path) => {
        setBusy(true)
        setBrowseError('')
        setResults(undefined)
        setPreview(undefined)
        try {
          const payload = await apiGet(`/import/browse?path=${encodeURIComponent(path)}`)
          setBrowse(payload)
          setPathInput(payload.dir ?? '')
          setStep('browse')
        } catch (error) {
          setBrowseError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }, [])

      const pickDirectory = async () => {
        if (busy) return
        setBusy(true)
        setBrowseError('')
        try {
          const payload = await apiPost('/import/pick-directory')
          if (payload.path !== null && typeof payload.path === 'string') {
            setPathInput(payload.path)
            await go(payload.path)
          }
        } catch (error) {
          setBrowseError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }

      const toggle = (path) => setSelected((s) => {
        const next = { ...s }
        if (next[path]) delete next[path]
        else next[path] = true
        return next
      })
      const selectedPaths = Object.keys(selected)

      const doPreview = async (path) => {
        if (busy) return
        setBusy(true)
        setPreviewError('')
        try {
          const payload = await apiPost('/import/preview', { path })
          if (payload.candidate === undefined || payload.candidate === null) {
            throw new Error('server returned no candidate')
          }
          setPreview(payload.candidate)
          setStep('preview')
        } catch (error) {
          const message = String(error?.message ?? error)
          setPreviewError(message)
          try { console.error(`${PLUGIN_NAME}: preview failed for ${path}:`, message) } catch { /* console absent */ }
        } finally {
          setBusy(false)
        }
      }

      const runBatch = async (paths) => {
        setBusy(true)
        setResults(undefined)
        try {
          const payload = await apiPost('/import/batch', { paths })
          setResults(payload.results)
          setSelected({})
          setPreview(undefined)
          setStep('browse')
          onImported()
        } catch (error) {
          setBrowseError(String(error?.message ?? error))
          setPreview(undefined)
          setStep('browse')
        } finally {
          setBusy(false)
        }
      }

      const counts = results === undefined ? undefined : results.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1
        return acc
      }, {})

      const pathBar = (backTo) => h('div', { className: 'sm_bar', style: { margin: '0 0 8px' } },
        backTo === undefined ? null : h('button', { type: 'button', className: 'sm_button', disabled: busy, onClick: backTo }, `← ${t('import.back')}`),
        h('input', {
          className: 'sm_input sm_search', placeholder: t('import.path'),
          value: pathInput, onChange: (e) => setPathInput(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter' && pathInput.trim() !== '') go(pathInput.trim()) },
        }),
        h('button', { type: 'button', className: 'sm_button', disabled: busy, onClick: pickDirectory }, t('import.go')))

      // Landing page: the host's OS chooser plus a typed path. No preset
      // shortcut list — the user picks the directory themselves.
      const rootsPage = h('div', null,
        h('p', { className: 'sm_hint', style: { marginBottom: 8 } }, t('import.pickRootHint')),
        browseError !== '' ? h('div', { className: 'sm_callout sm_callout_error' }, browseError) : null,
        pathBar(undefined))

      const browsePage = h('div', null,
        pathBar(() => { setStep('roots'); setBrowse(undefined); setResults(undefined) }),
        browse?.parent != null ? h('div', { style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'sm_button', disabled: busy, onClick: () => go(browse.parent) }, `↑ ${t('import.up')}`)) : null,
        h('div', { className: 'sm_dir', style: { display: 'inline-block', marginBottom: 8, wordBreak: 'break-all' } }, browse?.dir ?? ''),
        browseError !== '' ? h('div', { className: 'sm_callout sm_callout_error' }, browseError) : null,
        results !== undefined ? h('div', { className: 'sm_callout' },
          h('b', null, t('import.batchDone', {
            ok: counts.imported ?? 0, skipped: counts.skipped ?? 0, failed: (counts.failed ?? 0) + (counts.rejected ?? 0),
          })),
          results.map((row) => h('div', { key: row.path, className: 'sm_hint sm_result_row' },
            `${row.path.split(/[\\/]/).pop()}: ${t(`import.status.${row.status}`)}${row.error ? ` — ${row.error}` : ''}`))) : null,
        browse?.dirs?.length > 0 ? h('div', { className: 'sm_tags', style: { marginBottom: 8 } },
          h('span', { className: 'sm_tag' }, `${t('import.dirs')}:`),
          browse.dirs.map((sub) => h('button', {
            key: sub, type: 'button', className: 'sm_tag sm_tag_link', onClick: () => go(sub), title: sub,
          }, sub.split(/[\\/]/).pop()))) : null,
        (browse?.files?.length ?? 0) === 0 ? h('div', { className: 'sm_sub' }, t('import.emptyDir')) : h('div', { className: 'sm_list sm_files' },
          h('div', { className: 'sm_hint' }, t('import.select')),
          browse.files.map((file) => h('div', { key: file.path, className: 'sm_file_row' },
            h('label', { className: 'sm_switch' },
              h('input', { type: 'checkbox', checked: selected[file.path] === true, onChange: () => toggle(file.path) })),
            h('button', {
              type: 'button', className: 'sm_file_name', title: `${file.path} — ${t('import.preview')}`,
              disabled: busy, onClick: () => doPreview(file.path),
            }, file.name),
            h('span', { className: 'sm_hint' }, `${Math.max(1, Math.round(file.bytes / 1024))} KB`)))),
        previewError !== '' ? h('div', { className: 'sm_callout sm_callout_error' }, `${t('import.failed')}: ${previewError}`) : null,
        h('div', { className: 'sm_modal_actions', style: { marginTop: 12 } },
          selectedPaths.length > 0 ? h('span', { className: 'sm_hint' }, t('import.selected', { n: selectedPaths.length })) : null,
          h('button', {
            type: 'button', className: 'sm_button sm_button_primary',
            disabled: busy || selectedPaths.length === 0, onClick: () => runBatch(selectedPaths),
          }, busy ? '…' : t('import.batch'))))

      const previewPage = preview === undefined ? null : h('div', null,
        h('div', { className: 'sm_head', style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'sm_button', disabled: busy, onClick: () => { setPreview(undefined); setStep('browse') } }, `← ${t('import.back')}`),
          h('span', { className: 'sm_title' }, preview.source.split(/[\\/]/).pop()),
          h('span', { className: 'sm_dir' }, preview.name)),
        h('div', { className: 'sm_preview_grid' },
          h('div', null, h('span', { className: 'sm_hint' }, t('f_displayName')), h('div', null, preview.meta?.displayName ?? '—')),
          h('div', null, h('span', { className: 'sm_hint' }, t('f_model')), h('div', null, preview.meta?.model ?? t('meta_default'))),
          h('div', null, h('span', { className: 'sm_hint' }, t('f_thinking')), h('div', null, preview.meta?.thinking ?? t('meta_default'))),
          h('div', null, h('span', { className: 'sm_hint' }, t('meta_deep')), h('div', null, String(preview.meta?.deep ?? 1)))),
        preview.meta?.description ? h('div', { style: { margin: '8px 0' } },
          h('span', { className: 'sm_hint' }, t('f_description')), h('div', null, preview.meta.description)) : null,
        preview.hasFrontmatter ? h('div', { className: 'sm_hint' }, t('import.hadFrontmatter')) : null,
        preview.warning ? h('div', { className: 'sm_callout sm_callout_error' }, preview.warning) : null,
        h('div', { className: 'sm_hint', style: { marginTop: 8 } }, t('import.bodyPreview', { n: IMPORT_PREVIEW_CHARS })),
        h('pre', { className: 'sm_body_pre' }, (preview.body ?? '').slice(0, IMPORT_PREVIEW_CHARS)),
        h('div', { className: 'sm_modal_actions', style: { marginTop: 12 } },
          h('button', { type: 'button', className: 'sm_button', disabled: busy, onClick: () => runBatch([preview.source]) }, t('import.single')),
          h('button', { type: 'button', className: 'sm_button sm_button_primary', disabled: busy, onClick: () => onIntoEditor(preview) }, t('import.intoEditor'))))

      return toplevel(h('div', {
        className: 'sm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onClose() },
      },
        h('div', { className: 'sm_dialog sm_dialog_wide', role: 'dialog', 'aria-modal': 'true' },
          h('h3', null, step === 'preview' ? t('import.previewTitle') : step === 'browse' ? t('import.title') : t('import.pickRoot')),
          step === 'roots' ? rootsPage : null,
          step === 'browse' ? browsePage : null,
          step === 'preview' ? previewPage : null,
          step === 'preview' ? null : h('div', { className: 'sm_modal_actions', style: { marginTop: 10 } },
            h('button', { type: 'button', className: 'sm_button', onClick: onClose, disabled: busy }, t('cancel'))))))
    }

    // ── list page ───────────────────────────────────────────────────────────
    function AgentCard(props) {
      const { t, agent, onEdit, onDelete } = props
      const tags = []
      tags.push(h(Tag, { key: 'm', kind: agent.model ? 'model' : undefined }, `${t('meta_model')}: ${agent.model || t('meta_default')}`))
      if (agent.thinking) tags.push(h(Tag, { key: 'th' }, `${t('meta_thinking')}: ${agent.thinking}`))
      tags.push(h(Tag, { key: 'd' }, (agent.deep ?? 1) === 0 ? t('meta_leaf') : t('meta_deep', { n: agent.deep ?? 1 })))
      if (agent.background === true) tags.push(h(Tag, { key: 'bg' }, t('meta_background')))
      if (agent.maxRounds !== undefined) tags.push(h(Tag, { key: 'r' }, t('meta_rounds', { n: agent.maxRounds })))
      if (agent.bodyBytes !== undefined) tags.push(h(Tag, { key: 'kb' }, t('meta_bodySize', { kb: Math.max(1, Math.round(agent.bodyBytes / 1024)) })))
      return h('div', { className: 'sm_card', onClick: () => onEdit(agent) },
        h('div', { className: 'sm_card_main' },
          h('div', { className: 'sm_card_name' }, agent.name,
            agent.displayName ? h('span', { className: 'sm_card_display' }, agent.displayName) : null),
          agent.description ? h('div', { className: 'sm_card_desc' }, agent.description) : null,
          h('div', { className: 'sm_tags' }, tags)),
        h('button', {
          type: 'button',
          className: 'sm_button sm_button_danger',
          onClick: (e) => { e.stopPropagation(); onDelete(agent) },
        }, t('delete')))
    }

    function SettingsPage(props) {
      const t = useCallback((key, values) => {
        const table = DICT[localeTag()] ?? DICT.en
        const template = table[key] ?? (DICT.en[key] ?? key)
        return String(template).replace(/\{(\w+)\}/g, (m, k) => (values && Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : m))
      }, [props.locale])
      // Re-render on language switch: locale changes also re-render the shell,
      // but pin the tag explicitly so a portal-less remount keeps the copy in
      // sync with the registry-issued dictionary.
      const list = useAsync(() => apiGet('/agents'), [])
      const models = useAsync(() => apiGet('/models'), [])
      const [editing, setEditing] = useState(undefined) // undefined | {isNew, form}
      const [importing, setImporting] = useState(false)
      const [pendingDelete, setPendingDelete] = useState(undefined)
      const [deleteBusy, setDeleteBusy] = useState(false)
      const [query, setQuery] = useState('')

      const agents = list.data?.agents ?? []
      const broken = list.data?.broken ?? []
      const dir = list.data?.dir ?? '~/.dsh/agents'

      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (q === '') return agents
        return agents.filter((a) => `${a.name} ${a.displayName ?? ''} ${a.description ?? ''}`.toLowerCase().includes(q))
      }, [agents, query])

      const openNew = () => setEditing({ isNew: true, form: { ...BLANK } })
      // Import "fill into editor": the draft lands in the blank form; the
      // user reviews it and presses Save. Same isNew flow, just pre-filled.
      const openFromCandidate = (candidate) => {
        setImporting(false)
        setEditing({
          isNew: true,
          form: agentToForm(
            { ...candidate.meta, name: candidate.name, deep: candidate.meta?.deep ?? 1 },
            candidate.body,
          ),
        })
      }
      const openEdit = async (agent) => {
        try {
          const payload = await apiGet(`/agents/get?name=${encodeURIComponent(agent.name)}`)
          setEditing({ isNew: false, form: agentToForm(payload.meta, payload.body) })
        } catch (error) {
          list.reload()
        }
      }
      const doDelete = async () => {
        if (pendingDelete === undefined) return
        setDeleteBusy(true)
        try {
          await apiPost('/agents/delete', { name: pendingDelete.name })
          setPendingDelete(undefined)
          list.reload()
        } catch (error) {
          setPendingDelete({ ...pendingDelete, error: String(error?.message ?? error) })
        } finally {
          setDeleteBusy(false)
        }
      }

      if (editing !== undefined) {
        return h('div', { className: 'sm_root', 'data-plugin': PLUGIN_NAME },
          h(Editor, {
            t, agents, models: models.data, modelsLoading: models.status === 'loading',
            isNew: editing.isNew, initial: editing.form, dir,
            onBack: () => setEditing(undefined),
            onSaved: () => { setEditing(undefined); list.reload() },
          }))
      }

      return h('div', { className: 'sm_root', 'data-plugin': PLUGIN_NAME },
        h('div', { className: 'sm_head' },
          h('span', { className: 'sm_title' }, t('title')),
          h('span', { className: 'sm_dir' }, dir)),
        h('div', { className: 'sm_sub' }, t('subtitle')),
        h('div', { className: 'sm_bar' },
          h('button', { type: 'button', className: 'sm_button sm_button_primary', onClick: openNew }, `＋ ${t('add')}`),
          h('button', { type: 'button', className: 'sm_button', onClick: () => setImporting(true) }, `⇤ ${t('import.button')}`),
          h('input', { className: 'sm_input sm_search', placeholder: t('search'), value: query, onChange: (e) => setQuery(e.target.value) }),
          h('button', { type: 'button', className: 'sm_button', onClick: () => { list.reload(); models.reload() } }, t('refresh'))),
        list.status === 'loading' && list.data === undefined ? h('div', { className: 'sm_sub' }, t('loading')) : null,
        list.status === 'error' ? h('div', { className: 'sm_callout sm_callout_error' },
          h('b', null, t('loadFailed')), h('div', null, list.error),
          h('div', { style: { marginTop: 8 } }, h('button', { type: 'button', className: 'sm_button', onClick: list.reload }, t('retry')))) : null,
        list.data !== undefined && filtered.length === 0 && agents.length === 0 ? h('div', { className: 'sm_sub' }, t('empty')) : null,
        list.data !== undefined && filtered.length === 0 && agents.length > 0 ? h('div', { className: 'sm_sub' }, '—') : null,
        h('div', { className: 'sm_list' }, filtered.map((agent) => h(AgentCard, {
          key: agent.name, t, agent, onEdit: openEdit, onDelete: (a) => setPendingDelete(a),
        }))),
        broken.length > 0 ? h('div', { className: 'sm_broken' },
          h('div', { className: 'sm_callout sm_callout_error' },
            h('b', null, t('broken')), h('div', null, t('brokenHint')),
            broken.map((b) => h('div', { key: b.path, className: 'sm_broken_row' }, `${b.path}: ${b.error}`)))) : null,
        pendingDelete !== undefined ? h(ConfirmDialog, {
          t,
          title: t('deleteConfirm', { name: pendingDelete.displayName ?? pendingDelete.name }),
          body: pendingDelete.error !== undefined ? String(pendingDelete.error) : t('deleteBody', { path: `${dir}/${pendingDelete.name}.md` }),
          confirmLabel: t('delete'),
          busy: deleteBusy,
          onConfirm: doDelete,
          onCancel: () => setPendingDelete(undefined),
        }) : null,
        importing ? h(ImportDialog, {
          t,
          onClose: () => setImporting(false),
          onImported: () => list.reload(),
          onIntoEditor: openFromCandidate,
        }) : null)
    }

    // ── registration ────────────────────────────────────────────────────────
    // TeamManeger 的统一设置页负责注册唯一的 settings.section；这个子模块
    // 只注册自己的文案与样式，避免把 Subagent 单独拆成第二个设置入口。
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }), `${PLUGIN_NAME}: dictionaries`)
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', PLUGIN_NAME)
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, `${PLUGIN_NAME}: styles`)
    }

    exports.Page = SettingsPage
    exports.apply = apply
    exports.inject = inject
    exports.name = 'subagent-manager'
    // Headless self-check seams.
    exports.__test__ = { DICT, validateForm: nameError, agentToForm, formToPayload }
    return module.exports
  },
})
