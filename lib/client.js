/** TeamManeger: one settings section, two retained-state tabs. */
window.__ModuleLoader__.load({
 id: 'dsh-team-manager',
 factory: (require) => {
 const React = require('react')
 const { createElement: h, useState } = React
 const skill = ((require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h, useState, useEffect, useMemo, useCallback, useRef } = React
    // `react-dom` 是 DSH shell 的平台种子词。设置面板是有
    // backdrop-filter/transform 祖先的玻璃表面，普通 `position: fixed`
    // 子元素会相对那个祖先定位，所以模态框通过 portal 挂到 document.body。
    let createPortal = null
    try {
      const reactDom = require('react-dom')
      if (typeof reactDom?.createPortal === 'function') createPortal = reactDom.createPortal
    } catch { createPortal = null }
    function toplevel(element) {
      if (createPortal !== null && typeof document !== 'undefined' && document.body !== null && document.body !== undefined) {
        return createPortal(element, document.body)
      }
      return element
    }

    const PLUGIN_NAME = 'dsh-team-manager-skill'
    const NS = 'settings.dsh-team-manager.skill'
    const API = '/dsh-team-manager/api/skill'

    const inject = ['slots', 'locale']

    // ── copy ────────────────────────────────────────────────────────────────
    const DICT = {
      zh: {
        nav: 'Skill 管理',
        title: '本机 Skill 管理',
        subtitle: '每个 Skill 是一个目录：~/.dsh/skills/<名称>/SKILL.md（frontmatter 写名称与描述，正文是技能指令；目录里还可以放参考文件）。启用后，会话中的模型可按名称加载并遵循它。',
        dir: '技能目录',
        add: '新建 Skill',
        importButton: '导入…',
        refresh: '刷新',
        loading: '正在加载…',
        loadFailed: '无法连接插件后端',
        retry: '重试',
        empty: '还没有任何 Skill，点击「新建 Skill」或「导入」开始。',
        search: '搜索名称 / 描述…',
        broken: '解析失败的技能',
        brokenHint: '这些目录存在但 SKILL.md 无法解析，已排除；修复或删除后自动恢复。',
        delete: '删除',
        deleteConfirm: '删除 Skill「{name}」？',
        deleteBody: '将删除整个目录 {path}（含 SKILL.md 与所有参考文件）。此操作不可撤销。',
        deleteOk: '已删除',
        cancel: '取消',
        save: '保存',
        saving: '保存中…',
        saved: '已保存「{name}」',
        saveFailed: '保存失败',
        back: '返回列表',
        f_name: '名称（kebab-case）',
        f_nameHint: '小写字母 / 数字 / - _ . / 中文；这是目录名，也是会话中技能的路由名。',
        f_nameTaken: '名称 {name} 已存在（换一个，或编辑现有的）',
        f_nameInvalid: '名称不合法：不能为空、不能包含空格、/ 或 \\、不能以 . 开头',
        f_description: '描述（何时使用此技能）',
        f_descriptionHint: '写清楚「什么时候该用这个技能」；这是模型路由技能的依据。',
        f_body: '技能正文（Markdown 指令）',
        f_bodyHint: '正文是加载技能时模型读到的全部指令：职责、步骤、原则、边界。可引用同目录下的参考文件。',
        meta_enabled: '已启用',
        meta_disabled: '已停用',
        meta_files: '{n} 个文件',
        meta_bodySize: '{kb} KB',
        newTitle: '新建 Skill',
        editTitle: '编辑 {name}',
        usageHintTitle: '在会话中怎么用',
        usageHint: '对模型说「用 <名称> 技能做 …」，或在提示里 @技能名。模型会加载 SKILL.md 正文并遵循其中的指令。开启「自动调用」后，任务与描述匹配时会自动加载，无需点名。',
        fetchFailed: '请求失败（HTTP {status}）',
        enable: '启用',
        disable: '停用',
        enabledToggled: '已{action}「{name}」',
        auto: '自动调用',
        autoTitle: '开启后：任务内容与该技能的描述匹配时，模型会自动加载并遵循它，无需你点名。关闭时保持默认行为（由模型自行判断，或由你明确点名）。',
        autoUnavailable: '技能已停用；重新启用后自动调用才会生效。',
        autoModelDisabled: '该技能声明了 disable-model-invocation，只能由你手动调用，不能自动调用。',
        hostCatalogTitle: '宿主当前识别的技能目录',
        hostCatalogHint: '这是宿主 skills 服务此刻实际看到的清单（含内置/项目/其他来源）。新写的技能可能要等下一次会话开始才会进入这里。',
        catalogSource: '来源',
        import: {
          title: '导入新 Skill',
          hint: '从本地文件导入：浏览允许的目录，选择 .md 文件（作为新技能的正文）或 .zip 压缩包（自动解压其中的 SKILL.md）。也可以直接把内容粘贴到「新建」表单里。',
          pickRootHint: '点击「浏览」用系统窗口选择任意文件夹；或输入路径后按回车。允许的范围：工作区、DSH 主目录。',
          path: '目录路径',
          go: '浏览',
          files: '可导入的文件',
          dirs: '子目录',
          up: '上一级',
          emptyDir: '这个目录下没有可导入的 .md / .zip 文件。',
          intoEditor: '填入编辑器',
          single: '直接导入',
          close: '关闭',
          back: '返回',
          pickRoot: '选择目录',
          previewTitle: '预览',
          bodyPreview: '正文预览（前 {n} 字符）：',
          hadFrontmatter: '该文件已带 frontmatter，将按其 name/description 导入。',
          noFrontmatter: '该文件没有 frontmatter：名称取自文件名，描述从内容推断；导入后可在编辑器里调整。',
          zipHint: 'ZIP 压缩包：提交后自动解压，扫描其中所有 SKILL.md（支持一层子目录，子目录名即技能名）。',
          status: {
            imported: '已导入',
            skipped: '跳过（同名已存在）',
            failed: '失败',
          },
          done: '导入完成：成功 {ok}，跳过 {skipped}，失败 {failed}',
          failed: '导入失败',
        },
      },
      en: {
        nav: 'Skill Manager',
        title: 'Local Skill Manager',
        subtitle: 'Each skill is a directory: ~/.dsh/skills/<name>/SKILL.md (frontmatter carries name and description, the body is the instruction; auxiliary files may live beside it). Once enabled, sessions can load and follow it by name.',
        dir: 'Skills directory',
        add: 'New Skill',
        importButton: 'Import…',
        refresh: 'Refresh',
        loading: 'Loading…',
        loadFailed: 'Cannot reach the plugin backend',
        retry: 'Retry',
        empty: 'No skills yet — click "New Skill" or "Import" to start.',
        search: 'Search name / description…',
        broken: 'Unparsable skills',
        brokenHint: 'These directories exist but their SKILL.md failed to parse and are excluded; fix or delete them.',
        delete: 'Delete',
        deleteConfirm: 'Delete skill "{name}"?',
        deleteBody: 'Removes the whole directory {path} (SKILL.md plus all auxiliary files). This cannot be undone.',
        deleteOk: 'Deleted',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved "{name}"',
        saveFailed: 'Save failed',
        back: 'Back to list',
        f_name: 'Name (kebab-case)',
        f_nameHint: 'lowercase letters / digits / - _ . / CJK; this is the directory name and the routing name.',
        f_nameTaken: 'Name {name} already exists (pick another or edit the existing one)',
        f_nameInvalid: 'Invalid name: required, no spaces, `/` or `\\`, must not start with `.`',
        f_description: 'Description (when to use this skill)',
        f_descriptionHint: 'State clearly WHEN this skill applies; the model routes skills by this.',
        f_body: 'Skill body (markdown instructions)',
        f_bodyHint: 'The body is everything the model reads when the skill loads: duties, steps, principles, boundaries. It may reference files in the same directory.',
        meta_enabled: 'enabled',
        meta_disabled: 'disabled',
        meta_files: '{n} files',
        meta_bodySize: '{kb} KB',
        newTitle: 'New Skill',
        editTitle: 'Edit {name}',
        usageHintTitle: 'How to use it in a session',
        usageHint: 'Tell the model "use the <name> skill to …". It loads the SKILL.md body and follows it. With Auto-invoke on, it loads the skill by itself whenever the task matches the description.',
        fetchFailed: 'Request failed (HTTP {status})',
        enable: 'Enable',
        disable: 'Disable',
        enabledToggled: '{action}d "{name}"',
        auto: 'Auto-invoke',
        autoTitle: 'When on, the model loads and follows this skill automatically whenever the task matches its description — no need to name it. When off, the default behavior stays (the model decides, or you name it).',
        autoUnavailable: 'This skill is disabled; auto-invoke takes effect after you re-enable it.',
        autoModelDisabled: 'This skill declares disable-model-invocation, so only you can invoke it; auto-invoke is unavailable.',
        hostCatalogTitle: 'Host catalog right now',
        hostCatalogHint: 'What the host skills service currently sees (built-in/project/other sources included). A freshly written skill may only appear here after the next session starts.',
        catalogSource: 'source',
        import: {
          title: 'Import a new Skill',
          hint: 'Import from local files: browse allowed directories, pick a .md file (becomes the new skill body) or a .zip archive (SKILL.md files inside are extracted automatically). You can also paste content into the "New Skill" form.',
          pickRootHint: 'Click Browse to choose any folder with the system picker; or type a path and press Enter. Allowed: workspaces and the DSH home.',
          path: 'Directory path',
          go: 'Browse',
          files: 'Importable files',
          dirs: 'Subdirectories',
          up: 'Up one level',
          emptyDir: 'No importable .md / .zip files in this directory.',
          intoEditor: 'Fill into editor',
          single: 'Import directly',
          close: 'Close',
          back: 'Back',
          pickRoot: 'Choose a directory',
          previewTitle: 'Preview',
          bodyPreview: 'Body preview (first {n} characters):',
          hadFrontmatter: 'This file carries frontmatter; its name/description will be used.',
          noFrontmatter: 'No frontmatter: the name comes from the file name and the description is inferred; adjust in the editor after importing.',
          zipHint: 'ZIP archive: after you commit, it is extracted and every SKILL.md inside is imported (one level of subdirectories supported; the subdirectory name becomes the skill name).',
          status: {
            imported: 'imported',
            skipped: 'skipped (name exists)',
            failed: 'failed',
          },
          done: 'Import done: {ok} imported, {skipped} skipped, {failed} failed',
          failed: 'Import failed',
        },
      },
    }

    // ── styles (theme variables only) ───────────────────────────────────────
    const CSS = `
.skm_root { color: var(--dsw-alias-label-primary, #1d2939); font-size: 14px; }
.skm_head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.skm_title { font-size: 18px; font-weight: 600; }
.skm_sub { color: var(--dsw-alias-label-secondary, #475467); font-size: 13px; margin: 4px 0 10px; line-height: 1.55; }
.skm_dir { font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); font-size: 12px; color: var(--dsw-alias-label-secondary, #667085); background: var(--dsw-alias-bg-layer-1, #f2f4f7); padding: 2px 8px; border-radius: 6px; }
.skm_bar { display: flex; gap: 8px; align-items: center; margin: 10px 0; flex-wrap: wrap; }
.skm_input, .km_select, .skm_textarea {
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #1d2939);
  border: 1px solid var(--dsw-alias-border-l1, #d0d5dd);
  border-radius: 8px; padding: 7px 10px; font-size: 13px; font-family: inherit;
}
.skm_input:focus, .skm_textarea:focus { outline: 2px solid var(--dsw-alias-brand-primary, #84adff); }
.skm_search { flex: 1 1 220px; min-width: 180px; }
.skm_button {
  border: 1px solid var(--dsw-alias-border-l1, #d0d5dd); background: var(--dsw-alias-bg-layer-1, #f2f4f7);
  color: var(--dsw-alias-label-primary, #1d2939); border-radius: 8px; padding: 7px 14px; font-size: 13px; cursor: pointer;
}
.skm_button:hover { filter: brightness(0.97); }
.skm_button:disabled { opacity: 0.55; cursor: default; }
.skm_button_primary { background: var(--dsw-alias-brand-primary, #4f8cff); color: #fff; border-color: transparent; }
.skm_button_danger { background: transparent; color: var(--dsw-alias-state-error-primary, #d92d20); border-color: var(--dsw-alias-state-error-primary, #fda29b); }
.skm_list { display: flex; flex-direction: column; gap: 8px; }
.skm_card {
  border: 1px solid var(--dsw-alias-border-l1, #e4e7ec); border-radius: 10px; padding: 10px 14px;
  background: var(--dsw-alias-bg-layer-1, #fff); display: flex; gap: 12px; align-items: flex-start;
}
.skm_card_main { flex: 1 1 auto; min-width: 0; cursor: pointer; }
.skm_card_main:hover { color: var(--dsw-alias-brand-primary, #4f8cff); }
.skm_card_name { font-weight: 600; font-size: 14px; font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); }
.skm_card_desc { color: var(--dsw-alias-label-secondary, #475467); font-size: 12.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.skm_tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; align-items: center; }
.skm_tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--dsw-alias-bg-layer-1, #f2f4f7); color: var(--dsw-alias-label-secondary, #475467); }
.skm_tag_ok { background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #12b76a) 16%, transparent); color: var(--dsw-alias-state-success-primary, #12b76a); }
.skm_tag_off { background: color-mix(in srgb, var(--dsw-alias-state-idle-primary, #667085) 16%, transparent); color: var(--dsw-alias-state-idle-primary, #667085); }
.skm_broken { margin-top: 14px; }
.skm_broken_row { font-size: 12px; color: var(--dsw-alias-state-error-primary, #d92d20); font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); margin-top: 4px; }
.skm_callout { border: 1px solid var(--dsw-alias-state-warn-primary, #fedf89); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #fffaeb) 40%, transparent); color: var(--dsw-alias-label-primary, #93600a); border-radius: 10px; padding: 10px 14px; margin: 10px 0; }
.skm_callout_error { border-color: var(--dsw-alias-state-error-primary, #fda29b); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #fef3f2) 30%, transparent); color: var(--dsw-alias-state-error-primary, #d92d20); }
.skm_form { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
.skm_field { display: flex; flex-direction: column; gap: 4px; }
.skm_field label { font-weight: 600; font-size: 13px; }
.skm_hint { color: var(--dsw-alias-label-secondary, #667085); font-size: 12px; line-height: 1.5; }
.skm_error { color: var(--dsw-alias-state-error-primary, #d92d20); font-size: 12px; }
.skm_textarea { min-height: 300px; resize: vertical; font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); font-size: 12.5px; line-height: 1.6; white-space: pre; }
.skm_switch { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.skm_switch input { width: 16px; height: 16px; accent-color: var(--dsw-alias-brand-primary, #4f8cff); }
.skm_auto { display: flex; align-items: center; gap: 6px; align-self: center; white-space: nowrap; cursor: pointer; user-select: none; font-size: 12px; color: var(--dsw-alias-label-secondary, #475467); }
.skm_auto input { width: 15px; height: 15px; accent-color: var(--dsw-alias-brand-primary, #4f8cff); }
.skm_auto input:disabled { cursor: default; opacity: .45; }
.skm_auto_off { opacity: .55; }
.skm_actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap; }
.skm_saved { color: var(--dsw-alias-state-success-primary, #12b76a); font-size: 12.5px; }
.skm_modal {
  position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-overlay-scrim, #101828) 55%, transparent);
}
.skm_dialog {
  width: min(440px, calc(100vw - 48px)); padding: 20px 24px; border-radius: 12px;
  background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #101828);
  box-shadow: 0 12px 32px rgba(16,24,40,.24); font-size: 14px;
}
.skm_dialog h3 { margin: 0 0 8px; font-size: 16px; }
.skm_dialog p { margin: 0 0 18px; color: var(--dsw-alias-label-secondary, #475467); font-size: 13px; line-height: 1.55; word-break: break-all; }
.skm_modal_actions { display: flex; justify-content: flex-end; gap: 8px; align-items: center; }
.skm_dialog_wide { width: min(640px, calc(100vw - 48px)); max-height: 82vh; overflow: auto; }
.skm_tag_link { cursor: pointer; border: 1px solid var(--dsw-alias-border-l1, #d0d5dd); background: var(--dsw-alias-bg-layer-1, #fff); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.skm_tag_link:hover { border-color: var(--dsw-alias-brand-primary, #84adff); color: var(--dsw-alias-brand-primary, #4f8cff); }
.skm_files { max-height: 240px; overflow: auto; border: 1px solid var(--dsw-alias-border-l1, #e4e7ec); border-radius: 8px; padding: 6px 8px; }
.skm_file_row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.skm_file_name { flex: 1 1 auto; text-align: left; background: none; border: none; color: var(--dsw-alias-label-primary, #1d2939); font-size: 13px; cursor: pointer; font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.skm_file_name:hover { color: var(--dsw-alias-brand-primary, #4f8cff); }
.skm_preview { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1, #f2f4f7); }
.skm_result_row { padding: 2px 0; }
.skm_preview_grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 8px 0; }
.skm_body_pre {
  margin: 4px 0 0; padding: 10px 12px; border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #f2f4f7); color: var(--dsw-alias-label-primary, #1d2939);
  font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; max-height: 340px; overflow: auto;
}
.skm_catalog { margin-top: 20px; }
.skm_catalog_row { display: flex; gap: 10px; padding: 3px 0; font-size: 12.5px; align-items: baseline; }
.skm_catalog_name { font-family: var(--dsw-alias-font-mono, ui-monospace, monospace); min-width: 140px; }
.skm_catalog_src { font-size: 11px; padding: 0 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-1, #f2f4f7); color: var(--dsw-alias-label-secondary, #475467); white-space: nowrap; }
.skm_catalog_desc { color: var(--dsw-alias-label-secondary, #475467); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
@media (max-width: 720px) { .skm_preview_grid { grid-template-columns: 1fr; } }
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

    // ── form helpers ────────────────────────────────────────────────────────
    const BLANK = { name: '', description: '', body: '' }

    const NAME_RE = /^[a-z0-9_\-\u4e00-\u9fff\u3400-\u4dbf][a-z0-9_\-.\u4e00-\u9fff\u3400-\u4dbf]*$/i
    function nameError(name) {
      const n = (name ?? '').trim()
      if (n === '' || n === '.' || n === '..' || n.length > 128 || /\s/.test(n) || n.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(n)) return 'invalid'
      return NAME_RE.test(n) ? '' : 'invalid'
    }

    // ── small components ────────────────────────────────────────────────────
    function Tag(props) {
      return h('span', { className: `skm_tag${props.kind ? ` skm_tag_${props.kind}` : ''}` }, props.children)
    }

    function Field(props) {
      return h('div', { className: 'skm_field' },
        props.label === undefined ? null : h('label', null, props.label),
        props.children,
        props.hint === undefined || props.hint === '' ? null : h('div', { className: 'skm_hint' }, props.hint),
        props.error === undefined || props.error === '' ? null : h('div', { className: 'skm_error' }, props.error))
    }

    function ConfirmDialog(props) {
      const { t, title, body, confirmLabel, onConfirm, onCancel, busy } = props
      return toplevel(h('div', {
        className: 'skm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onCancel() },
      },
        h('div', { className: 'skm_dialog', role: 'alertdialog', 'aria-modal': 'true' },
          h('h3', null, title),
          h('p', null, body),
          h('div', { className: 'skm_modal_actions' },
            h('button', { type: 'button', className: 'skm_button', onClick: onCancel, disabled: busy }, t('cancel')),
            h('button', { type: 'button', className: 'skm_button skm_button_danger', onClick: onConfirm, disabled: busy }, busy ? '…' : confirmLabel)))))
    }

    // ── editor ──────────────────────────────────────────────────────────────
    function Editor(props) {
      const { t, skills, isNew, initial, dir, onSaved, onBack } = props
      const [form, setForm] = useState(initial)
      const [busy, setBusy] = useState(false)
      const [saveError, setSaveError] = useState('')
      const [savedAt, setSavedAt] = useState(0)
      // 第一次保存成功后，新技能变成已有技能：记下名字用于重名校验。
      const [savedName, setSavedName] = useState(isNew ? '' : (initial.name ?? ''))
      const existingNames = useMemo(() => new Set((skills ?? []).map((s) => s.name)), [skills])

      const set = (key) => (v) => { setSavedAt(0); setForm((f) => ({ ...f, [key]: v })) }
      const nameErr = nameError(form.name)
      const taken = form.name.trim() !== '' && form.name.trim() !== savedName && existingNames.has(form.name.trim())
      const canSave = form.name.trim() !== '' && nameErr === '' && !taken && form.description.trim() !== '' && !busy

      const save = async () => {
        if (!canSave) return
        setBusy(true)
        setSaveError('')
        try {
          await apiPost('/skills/save', {
            id: isNew ? undefined : form.id,
            name: form.name.trim(),
            description: form.description.trim(),
            body: form.body,
            extraFrontmatter: form.extraFrontmatter,
          })
          setSavedName(form.name.trim())
          setSavedAt(Date.now())
          onSaved(form.name.trim())
        } catch (error) {
          setSaveError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }

      const title = savedName === '' ? t('newTitle') : t('editTitle', { name: savedName })
      return h('div', null,
        h('div', { className: 'skm_head' },
          h('button', { type: 'button', className: 'skm_button', onClick: onBack }, `← ${t('back')}`),
          h('span', { className: 'skm_title' }, title),
          savedAt > 0 && !busy ? h('span', { className: 'skm_saved' }, t('saved', { name: savedName })) : null),
        h('div', { className: 'skm_form' },
          h(Field, {
            label: t('f_name'),
            hint: t('f_nameHint'),
            error: nameErr !== '' ? t('f_nameInvalid') : taken ? t('f_nameTaken', { name: form.name.trim() }) : '',
          },
            h('input', { className: 'skm_input', value: form.name, disabled: !isNew, spellCheck: false, onChange: (e) => set('name')(e.target.value) })),
          h(Field, { label: t('f_description'), hint: t('f_descriptionHint') },
            h('textarea', {
              className: 'skm_textarea', style: { minHeight: 64, whiteSpace: 'pre-wrap' },
              value: form.description, spellCheck: false, onChange: (e) => set('description')(e.target.value),
            })),
          h(Field, { label: t('f_body'), hint: t('f_bodyHint') },
            h('textarea', { className: 'skm_textarea', value: form.body, spellCheck: false, onChange: (e) => set('body')(e.target.value) })),
          saveError !== '' ? h('div', { className: 'skm_callout skm_callout_error' }, `${t('saveFailed')}: ${saveError}`) : null,
          h('div', { className: 'skm_actions' },
            h('button', { type: 'button', className: 'skm_button skm_button_primary', disabled: !canSave, onClick: save }, busy ? t('saving') : t('save')),
            h('button', { type: 'button', className: 'skm_button', disabled: busy, onClick: onBack }, t('cancel')))))
    }

    // ── import panel ────────────────────────────────────────────────────────
    // 一步对话框：选目录（系统窗口或手输路径）→ 浏览 → 预览 → 导入。
    const IMPORT_PREVIEW_CHARS = 4000

    function ImportDialog(props) {
      const { t, onClose, onImported, onIntoEditor } = props
      const [step, setStep] = useState('roots') // 'roots' | 'browse' | 'preview'
      const [pathInput, setPathInput] = useState('')
      const [browse, setBrowse] = useState(undefined)
      const [browseError, setBrowseError] = useState('')
      const [busy, setBusy] = useState(false)
      const [preview, setPreview] = useState(undefined) // candidate
      const [previewError, setPreviewError] = useState('')
      const [results, setResults] = useState(undefined) // commit report rows

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
          setPreviewError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }

      const doCommit = async (path, extra) => {
        setBusy(true)
        setResults(undefined)
        try {
          const payload = await apiPost('/import/commit', { path, ...(extra ?? {}) })
          setResults(payload.results ?? [])
          setPreview(undefined)
          setStep('browse')
          onImported()
        } catch (error) {
          setPreviewError(String(error?.message ?? error))
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

      const pathBar = (backTo) => h('div', { className: 'skm_bar', style: { margin: '0 0 8px' } },
        backTo === undefined ? null : h('button', { type: 'button', className: 'skm_button', disabled: busy, onClick: backTo }, `← ${t('import.back')}`),
        h('input', {
          className: 'skm_input skm_search', placeholder: t('import.path'),
          value: pathInput, onChange: (e) => setPathInput(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter' && pathInput.trim() !== '') go(pathInput.trim()) },
        }),
        h('button', { type: 'button', className: 'skm_button', disabled: busy, onClick: pickDirectory }, t('import.go')))

      const rootsPage = h('div', null,
        h('p', { className: 'skm_hint', style: { marginBottom: 8 } }, t('import.pickRootHint')),
        browseError !== '' ? h('div', { className: 'skm_callout skm_callout_error' }, browseError) : null,
        pathBar(undefined))

      const browsePage = h('div', null,
        pathBar(() => { setStep('roots'); setBrowse(undefined); setResults(undefined) }),
        browse?.parent != null ? h('div', { style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'skm_button', disabled: busy, onClick: () => go(browse.parent) }, `↑ ${t('import.up')}`)) : null,
        h('div', { className: 'skm_dir', style: { display: 'inline-block', marginBottom: 8, wordBreak: 'break-all' } }, browse?.dir ?? ''),
        browseError !== '' ? h('div', { className: 'skm_callout skm_callout_error' }, browseError) : null,
        results !== undefined ? h('div', { className: 'skm_callout' },
          h('b', null, t('import.done', {
            ok: counts.imported ?? 0, skipped: counts.skipped ?? 0, failed: counts.failed ?? 0,
          })),
          results.map((row, i) => h('div', { key: i, className: 'skm_hint skm_result_row' },
            `${row.name ?? row.path}: ${t(`import.status.${row.status}`)}${row.error ? ` — ${row.error}` : ''}`))) : null,
        browse?.dirs?.length > 0 ? h('div', { className: 'skm_tags', style: { marginBottom: 8 } },
          h('span', { className: 'skm_tag' }, `${t('import.dirs')}:`),
          browse.dirs.map((sub) => h('button', {
            key: sub, type: 'button', className: 'skm_tag skm_tag_link', onClick: () => go(sub), title: sub,
          }, sub.split(/[\\/]/).pop()))) : null,
        (browse?.files?.length ?? 0) === 0 ? h('div', { className: 'skm_sub' }, t('import.emptyDir')) : h('div', { className: 'skm_list skm_files' },
          browse.files.map((file) => h('div', { key: file.path, className: 'skm_file_row' },
            h('button', {
              type: 'button', className: 'skm_file_name', title: file.path, disabled: busy,
              onClick: () => doPreview(file.path),
            }, `${file.kind === 'zip' ? 'ZIP' : 'MD'}  ${file.name}`),
            h('span', { className: 'skm_hint' }, `${Math.max(1, Math.round(file.bytes / 1024))} KB`)))),
        previewError !== '' ? h('div', { className: 'skm_callout skm_callout_error' }, `${t('import.failed')}: ${previewError}`) : null)

      const previewPage = preview === undefined ? null : h('div', null,
        h('div', { className: 'skm_head', style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'skm_button', disabled: busy, onClick: () => { setPreview(undefined); setStep('browse') } }, `← ${t('import.back')}`),
          h('span', { className: 'skm_title' }, preview.source.split(/[\\/]/).pop())),
        preview.kind === 'zip'
          ? h('div', null,
              h('div', { className: 'skm_hint' }, t('import.zipHint')),
              h('div', { className: 'skm_modal_actions', style: { marginTop: 12 } },
                h('button', { type: 'button', className: 'skm_button skm_button_primary', disabled: busy, onClick: () => doCommit(preview.source) }, busy ? '…' : t('import.single'))))
          : h('div', null,
              h('div', { className: 'skm_preview_grid' },
                h('div', null, h('span', { className: 'skm_hint' }, t('f_name')), h('div', { className: 'skm_card_name' }, preview.name ?? '—')),
                h('div', null, h('span', { className: 'skm_hint' }, t('f_description')), h('div', null, preview.description ?? '—'))),
              h('div', { className: 'skm_hint', style: { marginTop: 6 } },
                preview.hasFrontmatter ? t('import.hadFrontmatter') : t('import.noFrontmatter')),
              preview.warning ? h('div', { className: 'skm_callout skm_callout_error' }, preview.warning) : null,
              h('div', { className: 'skm_hint', style: { marginTop: 8 } }, t('import.bodyPreview', { n: IMPORT_PREVIEW_CHARS })),
              h('pre', { className: 'skm_body_pre' }, (preview.body ?? '').slice(0, IMPORT_PREVIEW_CHARS)),
              h('div', { className: 'skm_modal_actions', style: { marginTop: 12 } },
                h('button', { type: 'button', className: 'skm_button', disabled: busy, onClick: () => doCommit(preview.source) }, t('import.single')),
                h('button', { type: 'button', className: 'skm_button skm_button_primary', disabled: busy, onClick: () => onIntoEditor(preview) }, t('import.intoEditor')))))

      return toplevel(h('div', {
        className: 'skm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onClose() },
      },
        h('div', { className: 'skm_dialog skm_dialog_wide', role: 'dialog', 'aria-modal': 'true' },
          h('h3', null, step === 'preview' ? t('import.previewTitle') : step === 'browse' ? t('import.title') : t('import.pickRoot')),
          h('p', { className: 'skm_hint' }, t('import.hint')),
          step === 'roots' ? rootsPage : null,
          step === 'browse' ? browsePage : null,
          step === 'preview' ? previewPage : null,
          step === 'preview' ? null : h('div', { className: 'skm_modal_actions', style: { marginTop: 10 } },
            h('button', { type: 'button', className: 'skm_button', onClick: onClose, disabled: busy }, t('import.close'))))))
    }

    // ── list page ───────────────────────────────────────────────────────────
    function SkillCard(props) {
      const { t, skill, onEdit, onDelete, onToggle, onAuto } = props
      const autoDisabled = !skill.enabled || skill.modelInvocable === false
      const autoTitle = !skill.enabled
        ? t('autoUnavailable')
        : skill.modelInvocable === false ? t('autoModelDisabled') : t('autoTitle')
      return h('div', { className: 'skm_card' },
        h('label', { className: 'skm_switch', title: skill.enabled ? t('disable') : t('enable') },
          h('input', {
            type: 'checkbox', checked: skill.enabled,
            onChange: () => onToggle(skill),
          })),
        h('div', { className: 'skm_card_main', onClick: () => onEdit(skill) },
          h('div', { className: 'skm_card_name' }, skill.name),
          skill.description ? h('div', { className: 'skm_card_desc' }, skill.description) : null,
          h('div', { className: 'skm_tags' },
            h(Tag, { kind: skill.enabled ? 'ok' : 'off' }, skill.enabled ? t('meta_enabled') : t('meta_disabled')),
            skill.auto === true ? h(Tag, { kind: skill.enabled ? 'ok' : 'off' }, t('auto')) : null,
            skill.files !== undefined && skill.files.length > 0 ? h(Tag, null, t('meta_files', { n: skill.files.length })) : null,
            skill.bodyBytes !== undefined ? h(Tag, null, t('meta_bodySize', { kb: Math.max(1, Math.round(skill.bodyBytes / 1024)) })) : null)),
        h('label', {
          className: `skm_auto${autoDisabled ? ' skm_auto_off' : ''}`,
          title: autoTitle,
          onClick: (e) => e.stopPropagation(),
        },
          h('input', {
            type: 'checkbox', checked: skill.auto === true, disabled: autoDisabled,
            onChange: () => onAuto(skill),
          }),
          h('span', null, t('auto'))),
        h('button', {
          type: 'button',
          className: 'skm_button skm_button_danger',
          onClick: (e) => { e.stopPropagation(); onDelete(skill) },
        }, t('delete')))
    }

    function CatalogSection(props) {
      const { t } = props
      const catalog = useAsync(() => apiGet('/catalog'), [])
      const rows = catalog.data?.catalog ?? []
      return h('div', { className: 'skm_catalog' },
        h('div', { className: 'skm_head' },
          h('span', { className: 'skm_title', style: { fontSize: 15 } }, t('hostCatalogTitle')),
          h('button', { type: 'button', className: 'skm_button', onClick: catalog.reload }, t('refresh'))),
        h('div', { className: 'skm_hint', style: { margin: '4px 0 8px' } }, t('hostCatalogHint')),
        rows.length === 0 ? h('div', { className: 'skm_hint' }, '—') : rows.map((row) =>
          h('div', { key: `${row.provider}/${row.name}`, className: 'skm_catalog_row' },
            h('span', { className: 'skm_catalog_name' }, row.name),
            row.source ? h('span', { className: 'skm_catalog_src' }, row.source) : null,
            row.description ? h('span', { className: 'skm_catalog_desc', title: row.description }, row.description) : null)))
    }

    function SettingsPage(props) {
      const t = useCallback((key, values) => {
        const table = DICT[localeTag()] ?? DICT.en
        const template = key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), table)
          ?? key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), DICT.en)
          ?? key
        return String(template).replace(/\{(\w+)\}/g, (m, k) => (values && Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : m))
      }, [props.locale])
      const list = useAsync(() => apiGet('/skills'), [])
      const [editing, setEditing] = useState(undefined) // undefined | {isNew, form}
      const [importing, setImporting] = useState(false)
      const [pendingDelete, setPendingDelete] = useState(undefined)
      const [deleteBusy, setDeleteBusy] = useState(false)
      const [toggleError, setToggleError] = useState('')
      const [query, setQuery] = useState('')

      const skills = list.data?.skills ?? []
      const broken = list.data?.broken ?? []
      const dir = list.data?.dir ?? '~/.dsh/skills'

      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (q === '') return skills
        return skills.filter((s) => `${s.name} ${s.description ?? ''}`.toLowerCase().includes(q))
      }, [skills, query])

      const openNew = () => setEditing({ isNew: true, form: { ...BLANK } })
      const openFromCandidate = (candidate) => {
        setImporting(false)
        setEditing({
          isNew: true,
          form: {
            name: candidate.name ?? '',
            description: candidate.description ?? '',
            body: candidate.body ?? '',
            extraFrontmatter: candidate.extraFrontmatter ?? '',
          },
        })
      }
      const openEdit = async (skill) => {
        try {
          const payload = await apiGet(`/skills/get?name=${encodeURIComponent(skill.id || skill.name)}`)
          setEditing({
            isNew: false,
            form: {
              id: payload.skill.id,
              name: payload.skill.name,
              description: payload.skill.description,
              body: payload.skill.body ?? '',
              extraFrontmatter: payload.skill.extraFrontmatter ?? '',
            },
          })
        } catch (error) {
          setToggleError(String(error?.message ?? error))
          list.reload()
        }
      }
      const doDelete = async () => {
        if (pendingDelete === undefined) return
        setDeleteBusy(true)
        try {
          await apiPost('/skills/delete', { name: pendingDelete.id || pendingDelete.name })
          setPendingDelete(undefined)
          list.reload()
        } catch (error) {
          setPendingDelete({ ...pendingDelete, error: String(error?.message ?? error) })
        } finally {
          setDeleteBusy(false)
        }
      }
      const doToggle = async (skill) => {
        setToggleError('')
        try {
          await apiPost('/skills/enable', { name: skill.id || skill.name, enabled: !skill.enabled })
          list.reload()
        } catch (error) {
          setToggleError(String(error?.message ?? error))
        }
      }
      const doAuto = async (skill) => {
        setToggleError('')
        try {
          await apiPost('/skills/auto', { name: skill.id || skill.name, auto: skill.auto !== true })
          list.reload()
        } catch (error) {
          setToggleError(String(error?.message ?? error))
        }
      }

      if (editing !== undefined) {
        return h('div', { className: 'skm_root', 'data-plugin': PLUGIN_NAME },
          h(Editor, {
            t, skills, isNew: editing.isNew, initial: editing.form, dir,
            onBack: () => setEditing(undefined),
            onSaved: () => { setEditing(undefined); list.reload() },
          }))
      }

      return h('div', { className: 'skm_root', 'data-plugin': PLUGIN_NAME },
        h('div', { className: 'skm_head' },
          h('span', { className: 'skm_title' }, t('title')),
          h('span', { className: 'skm_dir' }, dir)),
        h('div', { className: 'skm_sub' }, t('subtitle')),
        h('div', { className: 'skm_bar' },
          h('button', { type: 'button', className: 'skm_button skm_button_primary', onClick: openNew }, `＋ ${t('add')}`),
          h('button', { type: 'button', className: 'skm_button', onClick: () => setImporting(true) }, `⇤ ${t('importButton')}`),
          h('input', { className: 'skm_input skm_search', placeholder: t('search'), value: query, onChange: (e) => setQuery(e.target.value) }),
          h('button', { type: 'button', className: 'skm_button', onClick: () => list.reload() }, t('refresh'))),
        toggleError !== '' ? h('div', { className: 'skm_callout skm_callout_error' }, toggleError) : null,
        list.status === 'loading' && list.data === undefined ? h('div', { className: 'skm_sub' }, t('loading')) : null,
        list.status === 'error' ? h('div', { className: 'skm_callout skm_callout_error' },
          h('b', null, t('loadFailed')), h('div', null, list.error),
          h('div', { style: { marginTop: 8 } }, h('button', { type: 'button', className: 'skm_button', onClick: list.reload }, t('retry')))) : null,
        list.data !== undefined && skills.length === 0 ? h('div', { className: 'skm_sub' }, t('empty')) : null,
        list.data !== undefined && skills.length > 0 && filtered.length === 0 ? h('div', { className: 'skm_sub' }, '—') : null,
        h('div', { className: 'skm_list' }, filtered.map((skill) => h(SkillCard, {
          key: skill.name, t, skill, onEdit: openEdit, onDelete: (s) => setPendingDelete(s), onToggle: doToggle, onAuto: doAuto,
        }))),
        broken.length > 0 ? h('div', { className: 'skm_broken' },
          h('div', { className: 'skm_callout skm_callout_error' },
            h('b', null, t('broken')), h('div', null, t('brokenHint')),
            broken.map((b) => h('div', { key: b.path, className: 'skm_broken_row' }, `${b.path}: ${b.error}`)))) : null,
        h('div', { className: 'skm_callout' },
          h('b', null, t('usageHintTitle')), h('div', null, t('usageHint'))),
        h(CatalogSection, { t }),
        pendingDelete !== undefined ? h(ConfirmDialog, {
          t,
          title: t('deleteConfirm', { name: pendingDelete.name }),
          body: pendingDelete.error !== undefined ? String(pendingDelete.error) : t('deleteBody', { path: `${dir}/${pendingDelete.name}` }),
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
    // 只注册自己的文案与样式，避免把 Skill 单独拆成第二个设置入口。
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: flatten(DICT.zh), en: flatten(DICT.en) }), `${PLUGIN_NAME}: dictionaries`)
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', PLUGIN_NAME)
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, `${PLUGIN_NAME}: styles`)
    }

    /** Flatten nested dict to dotted keys for locale.register. */
    function flatten(obj, prefix = '') {
      const out = {}
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix === '' ? key : `${prefix}.${key}`
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) Object.assign(out, flatten(value, path))
        else out[path] = value
      }
      return out
    }

    exports.Page = SettingsPage
    exports.apply = apply
    exports.inject = inject
    exports.name = 'skill-manager'
    // Headless self-check seams.
    exports.__test__ = { DICT, validateForm: nameError, flatten }
    return module.exports
  })(require)
const subagent = ((require) => {
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
        f_maxChildren: '子代理数量上限',
        f_maxChildrenHint: '开启派生后生效：该 Subagent 运行期间最多能直接开几个子代理，0 = 不设限。只统计直接下级，多个子代理各算各的。',
        f_maxChildrenPlaceholder: '默认 1',
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
        meta_childrenNone: '不限下级',
        meta_children: '限 {n} 个下级',
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
        f_maxChildren: 'Subagent limit',
        f_maxChildrenHint: 'Applies once spawning is on: how many direct subagents this one may have running at the same time. 0 = unlimited. Each subagent keeps its own count.',
        f_maxChildrenPlaceholder: 'default 1',
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
        meta_childrenNone: 'unlimited children',
        meta_children: 'max {n} children',
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
      deep: true, maxChildren: '1', background: false, maxRounds: '', body: '',
    }

    function agentToForm(meta, body) {
      return {
        name: meta.name ?? '',
        displayName: meta.displayName ?? '',
        description: meta.description ?? '',
        model: meta.model ?? '',
        thinking: meta.thinking ?? '',
        deep: (meta.deep ?? 1) > 0,
        maxChildren: String(meta.maxChildren ?? 1),
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
        maxChildren: form.maxChildren.trim() === '' ? 1 : Number(form.maxChildren.trim()),
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
            form.deep
              ? h(Field, { label: t('f_maxChildren'), hint: t('f_maxChildrenHint') },
                h('input', { className: 'sm_input', inputMode: 'numeric', placeholder: t('f_maxChildrenPlaceholder'), value: form.maxChildren, onChange: (e) => set('maxChildren')(e.target.value.replace(/[^\d]/g, '')) }))
              : null,
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
          h('div', null, h('span', { className: 'sm_hint' }, t('meta_deep')), h('div', null, String(preview.meta?.deep ?? 1))),
          h('div', null, h('span', { className: 'sm_hint' }, t('f_maxChildren')), h('div', null, (preview.meta?.maxChildren ?? 1) === 0 ? t('meta_childrenNone') : t('meta_children', { n: preview.meta?.maxChildren ?? 1 })))),
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
      if ((agent.deep ?? 1) > 0) {
        const cap = agent.maxChildren ?? 1
        tags.push(h(Tag, { key: 'mc' }, cap === 0 ? t('meta_childrenNone') : t('meta_children', { n: cap })))
      }
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
  })(require)
 const reportConflict = () => {
   fetch('/dsh-team-manager/api/modules/compatibility-failure', { method: 'POST', headers: { accept: 'application/json' } })
     .catch(error => console.warn('TeamManeger compatibility report failed', error))
 }
 class CompatibilityBoundary extends React.Component {
   constructor(props) { super(props); this.state = { failed: false } }
   static getDerivedStateFromError() { return { failed: true } }
   componentDidCatch(error) { console.warn('TeamManeger component conflict', error); reportConflict() }
   render() { return this.state.failed ? h('p', { role: 'alert' }, 'TeamManeger 已因页面冲突停止，详情见 DSH 日志。') : this.props.children }
 }
 function TeamPage({ locale }) {
   const [tab, setTab] = useState('skill')
   const [modules, setModules] = useState(null)
   const [busy, setBusy] = useState(false)
   const [error, setError] = useState('')
   const english = locale?.getLocale?.().active === 'en'
   const text = (zh, en) => english ? en : zh
   const request = async (method, body, signal) => {
     const response = await fetch('/dsh-team-manager/api/modules', { method, signal, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
     const raw = await response.text()
     let value
     try { value = raw.trim() ? JSON.parse(raw) : null } catch { throw new Error('TeamManeger 接口返回了非 JSON 内容（HTTP ' + response.status + '）') }
     if (!response.ok || !value) {
       let diagnosis
       try { diagnosis = await fetch('/dsh-team-manager/api/status').then(r => r.json()) } catch {}
       throw new Error(diagnosis?.reason ? 'TeamManeger 已停止：' + diagnosis.reason : value?.error || ('TeamManeger 后端接口不可用（HTTP ' + response.status + '），插件可能已停用。'))
     }
     return { skill: value.skill === true, subagent: value.subagent === true }
   }
   React.useEffect(() => {
     const controller = new AbortController()
     request('GET', undefined, controller.signal).then(setModules).catch(e => { if (!controller.signal.aborted) setError(e.message) })
     return () => controller.abort()
   }, [])
   const toggle = async (id, enabled) => {
     if (busy || !modules) return
     setBusy(true); setError('')
     try { setModules(await request('POST', { ...modules, [id]: enabled })) }
     catch (e) { setError(e.message) }
     finally { setBusy(false) }
   }
   const tabs = ['skill', 'subagent']
   const buttonStyle = active => ({ padding: '9px 22px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l1)', background: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)', color: active ? '#fff' : 'var(--dsw-alias-label-primary)' })
   return h('div', { className: 'dsh-team-manager', 'aria-busy': busy },
     h('h2', { style: { margin: '0 0 8px' } }, 'TeamManeger'),
     h('p', { style: { color: 'var(--dsw-alias-label-secondary)' } }, text('独立管理 Skill 与 Subagent。关闭模块不删除数据；关闭 Skill 管理不会停用已有技能。', 'Manage Skill and Subagent independently. Disabling a module preserves its files. Disabling Skill management does not disable existing skills.')),
     h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 18, margin: '18px 0' } }, tabs.map(id => h('label', { key: id, style: { display: 'flex', alignItems: 'center', gap: 7 } },
       h('input', { type: 'checkbox', role: 'switch', 'aria-label': id === 'skill' ? 'Skill' : 'Subagent', checked: modules?.[id] === true, disabled: busy || !modules, onChange: e => toggle(id, e.target.checked) }),
       text('启用 ', 'Enable ') + (id === 'skill' ? 'Skill' : 'Subagent')))),
     error ? h('div', { role: 'alert', style: { marginBottom: 12, color: 'var(--dsw-alias-text-error, #d14343)' } }, error, !modules ? h('button', { type: 'button', onClick: () => { setError(''); request('GET').then(setModules).catch(e => setError(e.message)) } }, text('重试', 'Retry')) : null) : null,
     !modules && !error ? h('p', { role: 'status' }, text('正在读取模块配置…', 'Loading module configuration…')) : null,
     busy ? h('p', { role: 'status' }, text('正在保存并应用配置…', 'Saving and applying configuration…')) : null,
     h('div', { role: 'tablist', 'aria-label': 'TeamManeger', style: { display: 'flex', gap: 8, marginBottom: 18 } }, tabs.map((id, index) => h('button', {
       key: id, id: 'team-tab-' + id, role: 'tab', type: 'button', 'aria-selected': tab === id, 'aria-controls': 'team-panel-' + id, tabIndex: tab === id ? 0 : -1,
       onClick: () => setTab(id), onKeyDown: e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[1] : tabs[1-index]; setTab(next); document.getElementById('team-tab-' + next)?.focus() } }, style: buttonStyle(tab === id)
     }, id === 'skill' ? 'Skill' : 'Subagent'))),
     tabs.map(id => h('div', { key: id, role: 'tabpanel', id: 'team-panel-' + id, 'aria-labelledby': 'team-tab-' + id, hidden: tab !== id },
       modules?.[id] ? h(id === 'skill' ? skill.Page : subagent.Page, { locale }) : modules ? h('p', null, text('此模块已关闭，可通过上方开关重新启用。', 'This module is disabled. Enable it using the switch above.')) : null)))
 }
 return { name: 'dsh-team-manager', inject: ['slots', 'locale'], apply(ctx) {
   try {
     if (typeof skill.Page !== 'function' || typeof subagent.Page !== 'function' || typeof ctx.slots?.inject !== 'function' || typeof ctx.slots?.register !== 'function') throw new Error('Incompatible TeamManeger client interfaces')
     skill.apply(ctx)
     subagent.apply(ctx)
     ctx.slots.inject('settings.section', () => {
       try { return ctx.slots.register({ name: 'settings.section', id: 'dsh-team-manager', order: 36, label: 'TeamManeger' }, props => h(CompatibilityBoundary, null, h(TeamPage, { ...props, locale: ctx.locale }))) }
       catch (error) { reportConflict(); throw error }
     })
   } catch (error) { reportConflict(); throw error }
 }, __test__: { TeamPage, skill, subagent } }
 }
})
