/**
 * Client half of dsh-team-manager-skill — a hand-written ModuleLoader bundle
 * (the shape the DSH web shell loads; no build step, only `react` from the
 * shell's module table).
 *
 * 贡献一个 `settings.section` 页面（"Skill 管理"），用户可以在里面：
 *   - 查看本机技能列表（~/.dsh/skills/<name>/SKILL.md），含启停状态
 *   - 新建 / 编辑 / 删除技能
 *   - 启用 / 停用技能（改 SKILL.md <-> SKILL.md.disabled 文件名）
 *   - 从本地 .md 文件导入（浏览 → 预览 → 填入编辑器 / 直接导入）
 *   - 从 .zip 压缩包导入（自动解压、扫描 SKILL.md）
 *
 * 所有读写走本插件自己的 /dsh-team-manager/api/skill/* 路由（同源，由持有文件
 * 的宿主进程服务）。
 *
 * 所有颜色都取自 shell 的主题变量，明暗切换自动跟随。
 */
window.__ModuleLoader__.load({
  id: 'dsh-team-manager-skill',
  factory: (require) => {
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
  },
})
