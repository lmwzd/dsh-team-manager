/** TeamManeger: one settings section, two retained-state tabs. */
window.__ModuleLoader__.load({
 id: 'dsh-team-manager',
 factory: (require) => {
 const React = require('react')
 const { createElement: h, useState } = React

 // Single stylesheet for both pages and the tab frame (lib/ui.css).
 const UI_CSS = `
/* ── TeamManeger design tokens ────────────────────────────────────────────
   Mapped onto the tokens the shell publishes (client inspect: Theme.listTokens),
   so every surface, line and ink sample follows the shell's light/dark switch.

   Declared on BODY, not :root. The shell defines every --dsw-alias-* token on
   the body element (its generated theme sheet is literally
   body{--dsw-alias-label-primary:...}
   plus a body[data-ds-dark-theme]{...}
   override), and custom properties only inherit downwards. An alias declared on
   :root would sit ABOVE the element that defines what it references, resolve to
   the empty value, and take its whole declaration down with it - which presents
   as an unstyled page: no borders, no surfaces, text only. Keep these on body.

   Every reference also carries a literal fallback. The shell's own sheet is not
   guaranteed to be present (a headless harness, a theme that renames a token, a
   first paint before the theme sheet lands); without a fallback a single missing
   variable silently drops border, background and color declarations instead of
   rendering something legible.

   Names are --tm-* so nothing here can collide with the shell's own map.
   Two values are deliberately literal rather than tokenised: the modal scrim
   and the dialog shadow. Both must stay dark in BOTH themes - a scrim derived
   from label-primary would turn pale in dark mode and stop separating the
   dialog from the page. */
body {
  --tm-ink: var(--dsw-alias-label-primary, #101828);
  --tm-ink-2: var(--dsw-alias-label-secondary, #475467);
  --tm-ink-3: color-mix(in srgb, var(--dsw-alias-label-secondary, #475467) 74%, transparent);
  --tm-line: var(--dsw-alias-border-l1, #e4e7ec);
  --tm-line-2: var(--dsw-alias-border-l2, #d0d5dd);
  --tm-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --tm-surface-2: var(--dsw-alias-bg-layer-2, #f9fafb);
  --tm-overlay: var(--dsw-alias-bg-overlay, #ffffff);
  --tm-accent: var(--dsw-alias-brand-primary, #4f8cff);
  --tm-live: var(--dsw-alias-state-success-primary, #12b76a);
  --tm-idle: var(--dsw-alias-state-idle-primary, #98a2b3);
  --tm-warn: var(--dsw-alias-state-warn-primary, #f79009);
  --tm-danger: var(--dsw-alias-state-error-primary, #d92d20);
  --tm-danger-bg: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d92d20) 12%, transparent);
  --tm-warn-bg: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f79009) 18%, transparent);
  --tm-accent-bg: color-mix(in srgb, var(--dsw-alias-brand-primary, #4f8cff) 14%, transparent);
  --tm-scrim: color-mix(in srgb, #101828 55%, transparent);
  --tm-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --tm-radius: 12px;
  --tm-radius-sm: 8px;
}
/* ── page frame ────────────────────────────────────────────────────────── */
.tm_root { color: var(--tm-ink); font-size: 14px; line-height: 1.55; }
.tm_head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.tm_title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.tm_path {
  font-family: var(--tm-mono); font-size: 11.5px; color: var(--tm-ink-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
.tm_preview_value { font-family: var(--tm-mono); font-size: 13px; color: var(--tm-ink); }
.tm_count {
  font-family: var(--tm-mono); font-size: 11.5px; color: var(--tm-ink-3);
  padding: 1px 7px; border-radius: 999px; border: 1px solid var(--tm-line);
}
.tm_empty {
  border: 1px dashed var(--tm-line-2); border-radius: var(--tm-radius);
  padding: 34px 20px; text-align: center; color: var(--tm-ink-2); font-size: 13px;
}
.tm_empty b { display: block; font-weight: 600; color: var(--tm-ink); }
.tm_bar { display: flex; gap: 8px; align-items: center; margin: 0 0 14px; flex-wrap: wrap; }
.tm_group_label { font-size: 12px; font-weight: 600; color: var(--tm-ink-2); }
.tm_section { margin-top: 22px; }
.tm_section_head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
/* ── controls ──────────────────────────────────────────────────────────── */
.tm_input {
  background: var(--tm-surface); color: var(--tm-ink);
  border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm);
  padding: 7px 10px; font-size: 13px; font-family: inherit;
}
.tm_input::placeholder { color: var(--tm-ink-3); }
select.tm_input { padding-right: 6px; cursor: pointer; }
.tm_input:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 1px; border-color: transparent; }
.tm_search { flex: 1 1 220px; min-width: 170px; }
.tm_btn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--tm-line); background: var(--tm-surface);
  color: var(--tm-ink); border-radius: var(--tm-radius-sm);
  padding: 7px 13px; font-size: 13px; font-family: inherit; cursor: pointer;
  white-space: nowrap;
}
.tm_btn:hover { background: var(--tm-surface-2); }
.tm_btn:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 1px; }
.tm_btn:disabled { opacity: 0.5; cursor: default; }
.tm_btn_primary { background: var(--tm-accent); border-color: transparent; color: #fff; font-weight: 500; }
.tm_btn_primary:hover { background: var(--tm-accent); filter: brightness(1.06); }
.tm_btn_quiet { border-color: transparent; background: transparent; color: var(--tm-ink-2); padding: 7px 9px; }
.tm_btn_quiet:hover { background: var(--tm-surface-2); color: var(--tm-ink); }
.tm_btn_danger { border-color: transparent; background: transparent; color: var(--tm-danger); }
.tm_btn_danger:hover { background: var(--tm-danger-bg); }
.tm_switch { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; user-select: none; font-size: 12.5px; font-weight: 400; color: var(--tm-ink-2); }
.tm_switch input { width: 15px; height: 15px; margin: 0; accent-color: var(--tm-accent); cursor: pointer; }
.tm_switch input:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
.tm_switch input:disabled { cursor: default; }
.tm_switch_off { opacity: 0.5; }
/* ── card grid ────────────────────────────────────────────────────────────
   Two-up cards with their own border and radius, matching the shell's own
   settings cards. Each card IS the edit affordance: the whole surface is
   clickable (the title row carries the button semantics), and the only control
   that does not open the editor is the note field, which is a text input and
   therefore swallows its own clicks.

   Hierarchy inside a card, top to bottom: what it is (title), when you would
   reach for it (your note), and what the machinery calls it (the monospace
   key). That order is the reverse of the old rack, which led with the id. */
.tm_grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: 12px; align-items: start;
}
.tm_card {
  position: relative; min-width: 0;
  border: 1px solid var(--tm-line); border-radius: var(--tm-radius);
  background: var(--tm-surface); padding: 13px 14px 12px;
  display: flex; flex-direction: column; gap: 7px;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.tm_card:hover { border-color: var(--tm-line-2); background: var(--tm-surface-2); }
.tm_card:focus-within { border-color: var(--tm-line-2); }
.tm_card_off { background: var(--tm-surface-2); }
.tm_card_off .tm_card_title { color: var(--tm-ink-2); }
/* A full-card click target behind the content, so clicking anywhere (except the
   note) opens the editor while the DOM keeps one real focusable button. */
.tm_card_title_button {
  position: absolute; inset: 0; width: 100%; height: 100%;
  border: 0; background: transparent; padding: 0; margin: 0;
  cursor: pointer; border-radius: inherit; z-index: 0;
}
.tm_card_title_button:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 1px; }
/* Display-only content must not block the edit button underneath it: this
   includes the footer's gaps and spacer. Restore hit testing only on actual
   controls, including disabled buttons so they never fall through to editing. */
.tm_card > :where(:not(.tm_card_title_button)) { position: relative; z-index: 1; pointer-events: none; }
.tm_card :is(button, textarea, input, select, a, label) { pointer-events: auto; }
.tm_card_title {
  display: flex; align-items: center; gap: 8px; min-width: 0;
  font-size: 13.5px; font-weight: 600; color: var(--tm-ink); line-height: 1.35;
}
.tm_card_title_text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The note is the one interactive field on the card, and it is yours: it lives
   in the plugin's sidecar file, never in SKILL.md. It looks like body text until
   hovered, and takes clicks for itself so editing it does not open the editor. */
.tm_card_note {
  width: 100%; box-sizing: border-box; resize: none; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis;
  border: 1px solid transparent; border-radius: var(--tm-radius-sm);
  background: transparent; color: var(--tm-ink-2);
  font-family: inherit; font-size: 12px; line-height: 1.5;
  padding: 3px 6px; margin: -3px -6px;
  min-height: 1.5em; cursor: text;
}
.tm_card_note::placeholder { color: var(--tm-ink-3); opacity: 0.9; }
.tm_card_note:hover { border-color: var(--tm-line); }
.tm_card_note:focus {
  outline: none; border-color: var(--tm-accent); background: var(--tm-surface-2);
  color: var(--tm-ink); cursor: text;
}
.tm_card_note_saving { border-color: var(--tm-accent); }
.tm_card_meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tm_card_spacer { flex: 1 1 auto; }
.tm_card_foot {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 2px; padding-top: 9px; border-top: 1px solid var(--tm-line);
}
/* State toggles read as buttons, not checkboxes: green when the thing is on,
   red when it is off, so a card's state is legible at a glance from across the
   grid. aria-pressed carries the same state to assistive tech. */
.tm_toggle {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid transparent; border-radius: 6px;
  padding: 3px 9px; font-size: 11.5px; font-family: inherit; font-weight: 500;
  line-height: 1.5; cursor: pointer; white-space: nowrap;
}
.tm_toggle::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; opacity: 0.85; flex: none;
}
.tm_on { background: color-mix(in srgb, var(--tm-live) 14%, transparent); color: var(--tm-live); border-color: color-mix(in srgb, var(--tm-live) 34%, transparent); }
.tm_on:hover { background: color-mix(in srgb, var(--tm-live) 22%, transparent); }
/* Off is neutral, not alarming: a disabled skill is a normal state, and a card
   with two red pills reads as broken. Red is reserved for destructive action. */
.tm_off { background: var(--tm-surface-2); color: var(--tm-ink-2); border-color: var(--tm-line-2); }
.tm_off:hover { background: var(--tm-surface); border-color: var(--tm-ink-3); color: var(--tm-ink); }
.tm_toggle:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
.tm_toggle_disabled { opacity: 0.45; cursor: default; }
.tm_toggle_disabled:hover { background: var(--tm-surface-2); color: var(--tm-ink-2); border-color: var(--tm-line-2); }
/* Delete sits at the bottom-right, as a button you have to aim at. */
.tm_card_del {
  flex: none; border: 1px solid var(--tm-line); border-radius: 6px;
  background: transparent; color: var(--tm-ink-2);
  padding: 3px 10px; font-size: 11.5px; font-family: inherit; line-height: 1.5;
  cursor: pointer; white-space: nowrap;
}
.tm_card_del:hover { color: var(--tm-danger); border-color: color-mix(in srgb, var(--tm-danger) 40%, transparent); background: var(--tm-danger-bg); }
.tm_card_del:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
.tm_card_alias { font-size: 11.5px; color: var(--tm-ink-3); margin-top: -3px; }
.tm_card_facts { display: flex; gap: 9px; flex-wrap: wrap; font-size: 10.5px; color: var(--tm-ink-3); }
/* Disclosure: reference material stays available, out of the way. */
.tm_fold { margin-top: 16px; }
.tm_fold > summary {
  cursor: pointer; font-size: 11.5px; color: var(--tm-ink-3); list-style: none;
  padding: 4px 0; display: inline-flex; align-items: center; gap: 6px;
}
.tm_fold > summary::-webkit-details-marker { display: none; }
.tm_fold > summary::before { content: "▸"; font-size: 10px; transition: transform 120ms ease; }
.tm_fold[open] > summary::before { transform: rotate(90deg); }
.tm_fold > summary:hover { color: var(--tm-ink); }
.tm_fold > summary:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; border-radius: 3px; }
.tm_note {
  border: 1px solid var(--tm-line); border-left: 3px solid var(--tm-accent);
  border-radius: var(--tm-radius-sm); padding: 10px 13px; margin: 14px 0;
  color: var(--tm-ink-2); font-size: 12.5px; background: var(--tm-surface);
}
.tm_note b { display: block; color: var(--tm-ink); font-weight: 600; margin-bottom: 2px; }
.tm_note_error { border-left-color: var(--tm-danger); background: var(--tm-danger-bg); }
.tm_note_error b { color: var(--tm-danger); }
/* ── forms ─────────────────────────────────────────────────────────────── */
.tm_form { display: flex; flex-direction: column; gap: 15px; margin-top: 14px; max-width: 76ch; }
.tm_field { display: flex; flex-direction: column; gap: 5px; }
.tm_field > label,
.tm_field > .tm_switch { font-size: 12.5px; font-weight: 600; color: var(--tm-ink); }
.tm_field > .tm_hint { font-weight: 400; }
.tm_hint { color: var(--tm-ink-3); font-size: 11.5px; line-height: 1.5; }
.tm_error { color: var(--tm-danger); font-size: 11.5px; }
.tm_row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.tm_row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
.tm_textarea {
  background: var(--tm-surface); color: var(--tm-ink);
  border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm);
  padding: 9px 11px; font-size: 12.5px; line-height: 1.6;
  font-family: var(--tm-mono); resize: vertical; min-height: 300px; white-space: pre;
}
.tm_textarea:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 1px; border-color: transparent; }
.tm_actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.tm_saved { color: var(--tm-live); font-size: 12px; }
/* ── dialogs (portalled to body; tokens are on :root for this reason) ──── */
.tm_modal {
  position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: var(--tm-scrim); color: var(--tm-ink); font-size: 14px;
}
.tm_dialog {
  width: min(460px, 100%); max-height: 82vh; overflow: auto;
  padding: 22px 24px; border-radius: var(--tm-radius);
  background: var(--tm-overlay); color: var(--tm-ink);
  box-shadow: 0 18px 48px rgba(16, 24, 40, 0.28);
}
.tm_dialog_wide { width: min(680px, 100%); }
.tm_dialog h3 { margin: 0 0 6px; font-size: 15.5px; font-weight: 600; }
/* An unclassed paragraph is dialog body copy; an element with a class
   (the import hint) keeps its own styling. */
.tm_dialog > p:not([class]) { margin: 0 0 6px; color: var(--tm-ink-2); font-size: 12.5px; line-height: 1.55; }
.tm_dialog_actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
/* ── import browser ────────────────────────────────────────────────────── */
.tm_files {
  max-height: 260px; overflow: auto; margin-top: 6px;
  border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm);
  padding: 8px 10px; background: var(--tm-surface-2);
}
.tm_file_row { display: flex; align-items: center; gap: 9px; padding: 4px 0; }
.tm_file_row + .tm_file_row { border-top: 1px solid var(--tm-line); }
.tm_file_name {
  flex: 1 1 auto; min-width: 0; text-align: left; padding: 2px 0;
  background: none; border: 0; cursor: pointer; font-family: var(--tm-mono);
  font-size: 12.5px; color: var(--tm-ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm_file_name:hover { color: var(--tm-accent); }
.tm_file_name:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; border-radius: 4px; }
.tm_preview_grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin: 10px 0; }
.tm_result_row { padding: 2px 0; }
.tm_body_pre {
  margin: 5px 0 0; padding: 10px 12px; border-radius: var(--tm-radius-sm);
  background: var(--tm-surface-2); color: var(--tm-ink);
  font-family: var(--tm-mono); font-size: 11.5px; line-height: 1.55;
  white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto;
}
.tm_chip_link {
  cursor: pointer; max-width: 280px; font-family: var(--tm-mono);
  background: var(--tm-surface); border: 1px solid var(--tm-line); color: var(--tm-ink-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm_chip_link:hover { border-color: var(--tm-accent); color: var(--tm-accent); }
.tm_chip_row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
/* ── host catalog (§ "what the host sees") ─────────────────────────────── */
.tm_catalog_row { display: flex; align-items: baseline; gap: 10px; padding: 3px 0; font-size: 12px; }
.tm_catalog_row + .tm_catalog_row { border-top: 1px solid var(--tm-line); }
.tm_catalog_name { font-family: var(--tm-mono); min-width: 150px; color: var(--tm-ink); }
.tm_catalog_desc { flex: 1 1 auto; min-width: 0; color: var(--tm-ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* ── one-off chips used by both pages ──────────────────────────────────── */
.tm_chip {
  font-size: 11px; padding: 1px 7px; border-radius: 999px;
  border: 1px solid var(--tm-line); background: var(--tm-surface-2); color: var(--tm-ink-2);
  white-space: nowrap;
}
.tm_chip_accent { border-color: transparent; background: var(--tm-accent-bg); color: var(--tm-accent); }
.tm_broken { margin-top: 18px; }
.tm_broken_row { font-family: var(--tm-mono); font-size: 11.5px; color: var(--tm-danger); padding: 2px 0; }
/* ── shell: tabs and module switches ──────────────────────────────────── */
.tm_shell { color: var(--tm-ink); font-size: 14px; }
.tm_shell_title { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.015em; }
.tm_shell_sub { color: var(--tm-ink-2); font-size: 12.5px; margin: 5px 0 0; max-width: 76ch; }
.tm_modules { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin: 12px 0 0; }
.tm_tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--tm-line); margin: 16px 0 18px; }
.tm_tab {
  border: 0; background: transparent; font-family: inherit; font-size: 13.5px;
  color: var(--tm-ink-2); padding: 8px 12px 9px; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  display: inline-flex; align-items: baseline; gap: 7px;
}
.tm_tab:hover { color: var(--tm-ink); }
.tm_tab:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: -2px; border-radius: 4px 4px 0 0; }
.tm_tab[aria-selected="true"] { color: var(--tm-ink); font-weight: 600; border-bottom-color: var(--tm-accent); }
.tm_tab:disabled { color: var(--tm-idle); cursor: default; }
.tm_offline {
  border: 1px solid var(--tm-line); border-left: 3px solid var(--tm-warn);
  background: var(--tm-warn-bg); border-radius: var(--tm-radius-sm);
  color: var(--tm-ink-2); font-size: 12.5px; padding: 12px 14px; margin: 4px 0; max-width: 76ch;
}
`

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
        dir: '技能目录',
        count: '{n} 个',
        add: '新建 Skill',
        importButton: '导入…',
        refresh: '刷新',
        loading: '正在加载…',
        loadFailed: '无法连接插件后端',
        retry: '重试',
        empty: '还没有 Skill',
        search: '搜索名称 / 备注…',
        noMatch: '没有名称或备注匹配的技能。',
        leadHint: '{title}：{hint}',
        notePlaceholder: '加一句备注…',
        noteLabel: '{name} 的备注',
        noteHint: '备注只存在本机，不会写进 SKILL.md。',
        stateOn: '已启用',
        stateOff: '已关闭',
        autoOn: '自动调用',
        autoOff: '自动关',
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
        dir: 'Skills directory',
        count: '{n}',
        add: 'New Skill',
        importButton: 'Import…',
        refresh: 'Refresh',
        loading: 'Loading…',
        loadFailed: 'Cannot reach the plugin backend',
        retry: 'Retry',
        empty: 'No skills yet',
        search: 'Search name / note…',
        noMatch: 'No skill matches that search.',
        leadHint: '{title}: {hint}',
        notePlaceholder: 'Add a note…',
        noteLabel: 'Note for {name}',
        noteHint: 'Notes are local; SKILL.md is never modified.',
        stateOn: 'Enabled',
        stateOff: 'Disabled',
        autoOn: 'Auto-invoke',
        autoOff: 'Auto off',
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
    function Field(props) {
      return h('div', { className: 'tm_field' },
        props.label === undefined ? null : h('label', null, props.label),
        props.children,
        props.hint === undefined || props.hint === '' ? null : h('div', { className: 'tm_hint' }, props.hint),
        props.error === undefined || props.error === '' ? null : h('div', { className: 'tm_error' }, props.error))
    }

    function ConfirmDialog(props) {
      const { t, title, body, confirmLabel, onConfirm, onCancel, busy } = props
      return toplevel(h('div', {
        className: 'tm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onCancel() },
      },
        h('div', { className: 'tm_dialog', role: 'alertdialog', 'aria-modal': 'true' },
          h('h3', null, title),
          h('p', null, body),
          h('div', { className: 'tm_dialog_actions' },
            h('button', { type: 'button', className: 'tm_btn', onClick: onCancel, disabled: busy }, t('cancel')),
            h('button', { type: 'button', className: 'tm_btn tm_btn_danger', onClick: onConfirm, disabled: busy }, busy ? '…' : confirmLabel)))))
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
        h('div', { className: 'tm_head' },
          h('button', { type: 'button', className: 'tm_btn', onClick: onBack }, `← ${t('back')}`),
          h('span', { className: 'tm_title' }, title),
          savedAt > 0 && !busy ? h('span', { className: 'tm_saved' }, t('saved', { name: savedName })) : null),
        h('div', { className: 'tm_form' },
          h(Field, {
            label: t('f_name'),
            hint: t('f_nameHint'),
            error: nameErr !== '' ? t('f_nameInvalid') : taken ? t('f_nameTaken', { name: form.name.trim() }) : '',
          },
            h('input', { className: 'tm_input', value: form.name, disabled: !isNew, spellCheck: false, onChange: (e) => set('name')(e.target.value) })),
          h(Field, { label: t('f_description'), hint: t('f_descriptionHint') },
            h('textarea', {
              className: 'tm_textarea', style: { minHeight: 64, whiteSpace: 'pre-wrap' },
              value: form.description, spellCheck: false, onChange: (e) => set('description')(e.target.value),
            })),
          h(Field, { label: t('f_body'), hint: t('f_bodyHint') },
            h('textarea', { className: 'tm_textarea', value: form.body, spellCheck: false, onChange: (e) => set('body')(e.target.value) })),
          saveError !== '' ? h('div', { className: 'tm_note tm_note_error' }, `${t('saveFailed')}: ${saveError}`) : null,
          h('div', { className: 'tm_actions' },
            h('button', { type: 'button', className: 'tm_btn tm_btn_primary', disabled: !canSave, onClick: save }, busy ? t('saving') : t('save')),
            h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: onBack }, t('cancel')))))
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

      const pathBar = (backTo) => h('div', { className: 'tm_bar', style: { margin: '0 0 8px' } },
        backTo === undefined ? null : h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: backTo }, `← ${t('import.back')}`),
        h('input', {
          className: 'tm_input tm_search', placeholder: t('import.path'),
          value: pathInput, onChange: (e) => setPathInput(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter' && pathInput.trim() !== '') go(pathInput.trim()) },
        }),
        h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: pickDirectory }, t('import.go')))

      const rootsPage = h('div', null,
        h('p', { className: 'tm_hint', style: { marginBottom: 8 } }, t('import.pickRootHint')),
        browseError !== '' ? h('div', { className: 'tm_note tm_note_error' }, browseError) : null,
        pathBar(undefined))

      const browsePage = h('div', null,
        pathBar(() => { setStep('roots'); setBrowse(undefined); setResults(undefined) }),
        browse?.parent != null ? h('div', { style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: () => go(browse.parent) }, `↑ ${t('import.up')}`)) : null,
        h('div', { className: 'tm_path', style: { display: 'inline-block', marginBottom: 8, wordBreak: 'break-all' } }, browse?.dir ?? ''),
        browseError !== '' ? h('div', { className: 'tm_note tm_note_error' }, browseError) : null,
        results !== undefined ? h('div', { className: 'tm_note' },
          h('b', null, t('import.done', {
            ok: counts.imported ?? 0, skipped: counts.skipped ?? 0, failed: counts.failed ?? 0,
          })),
          results.map((row, i) => h('div', { key: i, className: 'tm_hint tm_result_row' },
            `${row.name ?? row.path}: ${t(`import.status.${row.status}`)}${row.error ? ` — ${row.error}` : ''}`))) : null,
        browse?.dirs?.length > 0 ? h('div', { className: 'tm_chip_row' },
          h('span', { className: 'tm_chip' }, `${t('import.dirs')}:`),
          browse.dirs.map((sub) => h('button', {
            key: sub, type: 'button', className: 'tm_chip tm_chip_link', onClick: () => go(sub), title: sub,
          }, sub.split(/[\\/]/).pop()))) : null,
        (browse?.files?.length ?? 0) === 0 ? h('div', { className: 'tm_hint' }, t('import.emptyDir')) : h('div', { className: 'tm_files' },
          browse.files.map((file) => h('div', { key: file.path, className: 'tm_file_row' },
            h('button', {
              type: 'button', className: 'tm_file_name', title: file.path, disabled: busy,
              onClick: () => doPreview(file.path),
            }, `${file.kind === 'zip' ? 'ZIP' : 'MD'}  ${file.name}`),
            h('span', { className: 'tm_hint' }, `${Math.max(1, Math.round(file.bytes / 1024))} KB`)))),
        previewError !== '' ? h('div', { className: 'tm_note tm_note_error' }, `${t('import.failed')}: ${previewError}`) : null)

      const previewPage = preview === undefined ? null : h('div', null,
        h('div', { className: 'tm_head', style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: () => { setPreview(undefined); setStep('browse') } }, `← ${t('import.back')}`),
          h('span', { className: 'tm_title' }, preview.source.split(/[\\/]/).pop())),
        preview.kind === 'zip'
          ? h('div', null,
              h('div', { className: 'tm_hint' }, t('import.zipHint')),
              h('div', { className: 'tm_dialog_actions', style: { marginTop: 12 } },
                h('button', { type: 'button', className: 'tm_btn tm_btn_primary', disabled: busy, onClick: () => doCommit(preview.source) }, busy ? '…' : t('import.single'))))
          : h('div', null,
              h('div', { className: 'tm_preview_grid' },
                h('div', null, h('span', { className: 'tm_hint' }, t('f_name')), h('div', { className: 'tm_preview_value' }, preview.name ?? '—')),
                h('div', null, h('span', { className: 'tm_hint' }, t('f_description')), h('div', null, preview.description ?? '—'))),
              h('div', { className: 'tm_hint', style: { marginTop: 6 } },
                preview.hasFrontmatter ? t('import.hadFrontmatter') : t('import.noFrontmatter')),
              preview.warning ? h('div', { className: 'tm_note tm_note_error' }, preview.warning) : null,
              h('div', { className: 'tm_hint', style: { marginTop: 8 } }, t('import.bodyPreview', { n: IMPORT_PREVIEW_CHARS })),
              h('pre', { className: 'tm_body_pre' }, (preview.body ?? '').slice(0, IMPORT_PREVIEW_CHARS)),
              h('div', { className: 'tm_dialog_actions', style: { marginTop: 12 } },
                h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: () => doCommit(preview.source) }, t('import.single')),
                h('button', { type: 'button', className: 'tm_btn tm_btn_primary', disabled: busy, onClick: () => onIntoEditor(preview) }, t('import.intoEditor')))))

      return toplevel(h('div', {
        className: 'tm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onClose() },
      },
        h('div', { className: 'tm_dialog tm_dialog_wide', role: 'dialog', 'aria-modal': 'true' },
          h('h3', null, step === 'preview' ? t('import.previewTitle') : step === 'browse' ? t('import.title') : t('import.pickRoot')),
          h('p', { className: 'tm_hint' }, t('import.hint')),
          step === 'roots' ? rootsPage : null,
          step === 'browse' ? browsePage : null,
          step === 'preview' ? previewPage : null,
          step === 'preview' ? null : h('div', { className: 'tm_dialog_actions', style: { marginTop: 10 } },
            h('button', { type: 'button', className: 'tm_btn', onClick: onClose, disabled: busy }, t('import.close'))))))
    }

    // ── skill card ──────────────────────────────────────────────────────────
    /** One card: the skill's name, your note about it, and its two state buttons.
     *
     *  Clicking anywhere on the card opens the editor — except the note field,
     *  which is a text input and keeps its own clicks. That is why the card's
     *  click target is a separate absolutely-positioned button behind the
     *  content: one real focusable control for the keyboard, no nested
     *  interactive elements for the note to fight with.
     *
     *  The note is yours, not the skill's — it lives in
     *  `.dsh-team-manager/notes.json` and never touches SKILL.md.
     */
    function SkillCard(props) {
      const { t, skill, onEdit, onDelete, onToggle, onAuto, onNote } = props
      const autoDisabled = !skill.enabled || skill.modelInvocable === false
      const autoTitle = !skill.enabled
        ? t('autoUnavailable')
        : skill.modelInvocable === false ? t('autoModelDisabled') : t('autoTitle')
      const [note, setNote] = useState(skill.note ?? '')
      const [saving, setSaving] = useState(false)
      const [noteError, setNoteError] = useState('')
      const committed = useRef(skill.note ?? '')
      useEffect(() => {
        const incoming = skill.note ?? ''
        if (incoming !== committed.current) {
          committed.current = incoming
          setNote(incoming)
        }
      }, [skill.note])

      const commit = async () => {
        const value = note.trim()
        if (value === committed.current) return
        setSaving(true)
        setNoteError('')
        try {
          await onNote(skill, value)
          committed.current = value
        } catch (error) {
          setNoteError(String(error?.message ?? error))
          setNote(committed.current)
        } finally {
          setSaving(false)
        }
      }

      return h('div', { className: `tm_card${skill.enabled ? '' : ' tm_card_off'}` },
        h('button', {
          type: 'button', className: 'tm_card_title_button',
          'aria-label': t('editTitle', { name: skill.name }),
          title: t('editTitle', { name: skill.name }),
          onClick: () => onEdit(skill),
        }),
        h('div', { className: 'tm_card_title' },
          h('span', { className: 'tm_card_title_text' }, skill.name)),
        h('textarea', {
          className: `tm_card_note${saving ? ' tm_card_note_saving' : ''}`,
          rows: 1, value: note, spellCheck: false,
          placeholder: t('notePlaceholder'),
          'aria-label': t('noteLabel', { name: skill.name }),
          onChange: (e) => setNote(e.target.value),
          onBlur: commit,
          onKeyDown: (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() }
            if (e.key === 'Escape') { setNote(committed.current); e.target.blur() }
          },
        }),
        noteError !== '' ? h('div', { className: 'tm_error' }, noteError) : null,
        // The bottom row is the card's only chrome: two state toggles as buttons,
        // and delete pushed to the far right where it cannot be hit by accident.
        h('div', { className: 'tm_card_foot' },
          h('button', {
            type: 'button',
            className: `tm_toggle ${skill.enabled ? 'tm_on' : 'tm_off'}`,
            'aria-pressed': skill.enabled,
            title: skill.enabled ? t('disable') : t('enable'),
            onClick: () => onToggle(skill),
          }, skill.enabled ? t('stateOn') : t('stateOff')),
          h('button', {
            type: 'button',
            className: `tm_toggle ${skill.auto === true ? 'tm_on' : 'tm_off'}${autoDisabled ? ' tm_toggle_disabled' : ''}`,
            'aria-pressed': skill.auto === true,
            disabled: autoDisabled,
            title: autoTitle,
            onClick: () => onAuto(skill),
          }, skill.auto === true ? t('autoOn') : t('autoOff')),
          h('span', { className: 'tm_card_spacer' }),
          h('button', {
            type: 'button', className: 'tm_card_del',
            title: t('delete'), 'aria-label': `${t('delete')} ${skill.name}`,
            onClick: () => onDelete(skill),
          }, t('delete'))))
    }

    function CatalogSection(props) {
      const { t } = props
      const catalog = useAsync(() => apiGet('/catalog'), [])
      const rows = catalog.data?.catalog ?? []
      return h('div', { className: 'tm_section' },
        h('div', { className: 'tm_section_head' },
          h('span', { className: 'tm_group_label' }, t('hostCatalogTitle')),
          h('button', { type: 'button', className: 'tm_btn tm_btn_quiet', onClick: catalog.reload }, t('refresh'))),
        h('div', { className: 'tm_hint', style: { marginBottom: 8 } }, t('hostCatalogHint')),
        rows.length === 0 ? h('div', { className: 'tm_hint' }, '—') : rows.map((row) =>
          h('div', { key: `${row.provider}/${row.name}`, className: 'tm_catalog_row' },
            h('span', { className: 'tm_catalog_name' }, row.name),
            row.source ? h('span', { className: 'tm_chip' }, row.source) : null,
            row.description ? h('span', { className: 'tm_catalog_desc', title: row.description }, row.description) : null)))
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
      // name -> note, layered over the fetched rows (see doNote).
      const [noteOverlay, setNoteOverlay] = useState({})

      const skills = list.data?.skills ?? []
      const broken = list.data?.broken ?? []
      const dir = list.data?.dir ?? '~/.dsh/skills'

      // Rows carry the fetched note unless this session already saved a newer one.
      const shown = useMemo(
        () => skills.map((skill) => ({ ...skill, note: noteOverlay[skill.id || skill.name] ?? skill.note ?? '' })),
        [skills, noteOverlay],
      )
      const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (q === '') return shown
        return shown.filter((s) => `${s.name} ${s.note ?? ''}`.toLowerCase().includes(q))
      }, [shown, query])

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
      // The note lives in the plugin's own sidecar file, not in SKILL.md, so a
      // save here never touches the skill's bytes. Notes are held in an overlay
      // as well, so editing one repaints that card without reloading the roster
      // (a reload would discard whatever the user was typing in another card).
      const doNote = async (skill, note) => {
        const name = skill.id || skill.name
        const saved = await apiPost('/skills/note', { name, note })
        setNoteOverlay((current) => ({ ...current, [name]: saved.note ?? note }))
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
        return h('div', { className: 'tm_root', 'data-plugin': PLUGIN_NAME },
          h(Editor, {
            t, skills, isNew: editing.isNew, initial: editing.form, dir,
            onBack: () => setEditing(undefined),
            onSaved: () => { setEditing(undefined); list.reload() },
          }))
      }

      return h('div', { className: 'tm_root', 'data-plugin': PLUGIN_NAME },
        // A title, a count, and the controls. No paragraph explaining what a
        // skill is: anyone who opened this page already knows.
        h('div', { className: 'tm_head' },
          h('span', { className: 'tm_title' }, t('title')),
          list.data === undefined ? null : h('span', { className: 'tm_count' }, t('count', { n: skills.length }))),
        h('div', { className: 'tm_bar' },
          h('button', { type: 'button', className: 'tm_btn tm_btn_primary', onClick: openNew }, `＋ ${t('add')}`),
          h('button', { type: 'button', className: 'tm_btn', onClick: () => setImporting(true) }, t('importButton')),
          h('input', {
            className: 'tm_input tm_search', type: 'search', placeholder: t('search'),
            'aria-label': t('search'), value: query, onChange: (e) => setQuery(e.target.value),
          }),
          h('button', { type: 'button', className: 'tm_btn tm_btn_quiet', title: t('refresh'), 'aria-label': t('refresh'), onClick: () => list.reload() }, '⟳')),
        toggleError !== '' ? h('div', { className: 'tm_note tm_note_error' }, h('b', null, t('saveFailed')), toggleError) : null,
        list.status === 'loading' && list.data === undefined ? h('div', { className: 'tm_hint' }, t('loading')) : null,
        list.status === 'error' ? h('div', { className: 'tm_note tm_note_error' },
          h('b', null, t('loadFailed')), h('div', null, list.error),
          h('div', { style: { marginTop: 8 } }, h('button', { type: 'button', className: 'tm_btn', onClick: list.reload }, t('retry')))) : null,
        // Empty is an invitation, not an essay.
        list.data !== undefined && skills.length === 0
          ? h('div', { className: 'tm_empty' },
              h('b', null, t('empty')),
              h('div', { style: { marginTop: 10 } },
                h('button', { type: 'button', className: 'tm_btn tm_btn_primary', onClick: openNew }, `＋ ${t('add')}`)))
          : null,
        list.data !== undefined && skills.length > 0 && filtered.length === 0
          ? h('div', { className: 'tm_hint' }, t('noMatch')) : null,
        filtered.length > 0 ? h('div', { className: 'tm_grid' }, filtered.map((skill) => h(SkillCard, {
          key: skill.name, t, skill, onEdit: openEdit, onDelete: (s) => setPendingDelete(s),
          onToggle: doToggle, onAuto: doAuto, onNote: doNote,
        }))) : null,
        broken.length > 0 ? h('div', { className: 'tm_broken' },
          h('div', { className: 'tm_note tm_note_error' },
            h('b', null, t('broken')), h('div', null, t('brokenHint')),
            broken.map((b) => h('div', { key: b.path, className: 'tm_broken_row' }, `${b.path}: ${b.error}`)))) : null,
        // Reference material, folded away: it does not compete with the grid.
        h('details', { className: 'tm_fold' },
          h('summary', null, `${t('hostCatalogTitle')} · ${dir}`),
          h(CatalogSection, { t })),
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
    exports.__test__ = { DICT, validateForm: nameError, flatten, SkillRow: SkillCard }
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
        dir: '文件目录',
        count: '{n} 个',
        add: '新建 Subagent',
        refresh: '刷新',
        loading: '正在加载…',
        loadFailed: '无法连接插件后端',
        retry: '重试',
        empty: '还没有 Subagent',
        search: '搜索名称 / 显示名…',
        noMatch: '没有名称或显示名匹配的 Subagent。',
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
        dir: 'Files directory',
        count: '{n}',
        add: 'New Subagent',
        refresh: 'Refresh',
        loading: 'Loading…',
        loadFailed: 'Cannot reach the plugin backend',
        retry: 'Retry',
        empty: 'No subagents yet',
        search: 'Search name / display name…',
        noMatch: 'No subagent matches that search.',
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
    function Field(props) {
      return h('div', { className: 'tm_field' },
        props.label === undefined ? null : h('label', null, props.label),
        props.children,
        props.hint === undefined || props.hint === '' ? null : h('div', { className: 'tm_hint' }, props.hint),
        props.error === undefined || props.error === '' ? null : h('div', { className: 'tm_error' }, props.error))
    }

    function SwitchField(props) {
      return h('label', { className: 'tm_field' },
        h('span', { className: 'tm_switch' },
          h('input', { type: 'checkbox', checked: props.checked, onChange: (e) => props.onChange(e.target.checked) }),
          h('span', null, props.label)),
        props.hint ? h('div', { className: 'tm_hint' }, props.hint) : null)
    }

    function ConfirmDialog(props) {
      const { t, title, body, confirmLabel, onConfirm, onCancel, busy } = props
      return toplevel(h('div', {
        className: 'tm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onCancel() },
      },
        h('div', { className: 'tm_dialog', role: 'alertdialog', 'aria-modal': 'true' },
          h('h3', null, title),
          h('p', null, body),
          h('div', { className: 'tm_dialog_actions' },
            h('button', { type: 'button', className: 'tm_btn', onClick: onCancel, disabled: busy }, t('cancel')),
            h('button', { type: 'button', className: 'tm_btn tm_btn_danger', onClick: onConfirm, disabled: busy }, busy ? '…' : confirmLabel)))))
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
          className: 'tm_input',
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
          className: 'tm_input',
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
        h('div', { className: 'tm_head' },
          h('button', { type: 'button', className: 'tm_btn', onClick: onBack }, `← ${t('back')}`),
          h('span', { className: 'tm_title' }, title),
          savedAt > 0 && !busy ? h('span', { className: 'tm_saved' }, t('saved', { name: savedName })) : null),
        h('div', { className: 'tm_note' }, h('b', null, t('dispatchHintTitle')), h('div', null, t('dispatchHint'))),
        h('div', { className: 'tm_form' },
          h('div', { className: 'tm_row2' },
            h(Field, {
              label: t('f_name'),
              hint: t('f_nameHint'),
              error: nameErr !== '' ? t('f_nameInvalid') : taken ? t('f_nameTaken', { name: form.name.trim() }) : '',
            },
              h('input', { className: 'tm_input', value: form.name, disabled: !isNew, onChange: (e) => set('name')(e.target.value) })),
            h(Field, { label: t('f_displayName'), hint: t('f_displayNameHint') },
              h('input', { className: 'tm_input', value: form.displayName, onChange: (e) => set('displayName')(e.target.value) }))),
          h(Field, { label: t('f_description'), hint: t('f_descriptionHint') },
            h('input', { className: 'tm_input', value: form.description, onChange: (e) => set('description')(e.target.value) })),
          h('div', { className: 'tm_row2' },
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
                return h('select', { className: 'tm_input', value: form.thinking, onChange: (e) => set('thinking')(e.target.value) },
                  h('option', { value: '' }, t('f_thinkingDefault')),
                  options.map((lvl) => h('option', { key: lvl, value: lvl }, lvl)))
              })())),
          h('div', { className: 'tm_row3' },
            h(SwitchField, { label: t('f_deep'), hint: t('f_deepHint'), checked: form.deep, onChange: set('deep') }),
            form.deep
              ? h(Field, { label: t('f_maxChildren'), hint: t('f_maxChildrenHint') },
                h('input', { className: 'tm_input', inputMode: 'numeric', placeholder: t('f_maxChildrenPlaceholder'), value: form.maxChildren, onChange: (e) => set('maxChildren')(e.target.value.replace(/[^\d]/g, '')) }))
              : null,
            h(SwitchField, { label: t('f_background'), hint: t('f_backgroundHint'), checked: form.background, onChange: set('background') }),
            h(Field, { label: t('f_maxRounds') },
              h('input', { className: 'tm_input', inputMode: 'numeric', placeholder: t('f_maxRoundsPlaceholder'), value: form.maxRounds, onChange: (e) => set('maxRounds')(e.target.value.replace(/[^\d]/g, '')) }))),
          h(Field, { label: t('f_body'), hint: t('f_bodyHint') },
            h('textarea', { className: 'tm_textarea', value: form.body, spellCheck: false, onChange: (e) => set('body')(e.target.value) })),
          saveError !== '' ? h('div', { className: 'tm_note tm_note_error' }, `${t('saveFailed')}: ${saveError}`) : null,
          h('div', { className: 'tm_actions' },
            h('button', { type: 'button', className: 'tm_btn tm_btn_primary', disabled: !canSave, onClick: save }, busy ? t('saving') : t('save')),
            h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: onBack }, t('cancel')))))
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

      const pathBar = (backTo) => h('div', { className: 'tm_bar', style: { margin: '0 0 8px' } },
        backTo === undefined ? null : h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: backTo }, `← ${t('import.back')}`),
        h('input', {
          className: 'tm_input tm_search', placeholder: t('import.path'),
          value: pathInput, onChange: (e) => setPathInput(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter' && pathInput.trim() !== '') go(pathInput.trim()) },
        }),
        h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: pickDirectory }, t('import.go')))

      // Landing page: the host's OS chooser plus a typed path. No preset
      // shortcut list — the user picks the directory themselves.
      const rootsPage = h('div', null,
        h('p', { className: 'tm_hint', style: { marginBottom: 8 } }, t('import.pickRootHint')),
        browseError !== '' ? h('div', { className: 'tm_note tm_note_error' }, browseError) : null,
        pathBar(undefined))

      const browsePage = h('div', null,
        pathBar(() => { setStep('roots'); setBrowse(undefined); setResults(undefined) }),
        browse?.parent != null ? h('div', { style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: () => go(browse.parent) }, `↑ ${t('import.up')}`)) : null,
        h('div', { className: 'tm_path', style: { display: 'inline-block', marginBottom: 8, wordBreak: 'break-all' } }, browse?.dir ?? ''),
        browseError !== '' ? h('div', { className: 'tm_note tm_note_error' }, browseError) : null,
        results !== undefined ? h('div', { className: 'tm_note' },
          h('b', null, t('import.batchDone', {
            ok: counts.imported ?? 0, skipped: counts.skipped ?? 0, failed: (counts.failed ?? 0) + (counts.rejected ?? 0),
          })),
          results.map((row) => h('div', { key: row.path, className: 'tm_hint tm_result_row' },
            `${row.path.split(/[\\/]/).pop()}: ${t(`import.status.${row.status}`)}${row.error ? ` — ${row.error}` : ''}`))) : null,
        browse?.dirs?.length > 0 ? h('div', { className: 'tm_chip_row' },
          h('span', { className: 'tm_chip' }, `${t('import.dirs')}:`),
          browse.dirs.map((sub) => h('button', {
            key: sub, type: 'button', className: 'tm_chip tm_chip_link', onClick: () => go(sub), title: sub,
          }, sub.split(/[\\/]/).pop()))) : null,
        (browse?.files?.length ?? 0) === 0 ? h('div', { className: 'tm_hint' }, t('import.emptyDir')) : h('div', { className: 'tm_files' },
          h('div', { className: 'tm_hint' }, t('import.select')),
          browse.files.map((file) => h('div', { key: file.path, className: 'tm_file_row' },
            h('label', { className: 'tm_switch' },
              h('input', { type: 'checkbox', checked: selected[file.path] === true, onChange: () => toggle(file.path) })),
            h('button', {
              type: 'button', className: 'tm_file_name', title: `${file.path} — ${t('import.preview')}`,
              disabled: busy, onClick: () => doPreview(file.path),
            }, file.name),
            h('span', { className: 'tm_hint' }, `${Math.max(1, Math.round(file.bytes / 1024))} KB`)))),
        previewError !== '' ? h('div', { className: 'tm_note tm_note_error' }, `${t('import.failed')}: ${previewError}`) : null,
        h('div', { className: 'tm_dialog_actions', style: { marginTop: 12 } },
          selectedPaths.length > 0 ? h('span', { className: 'tm_hint' }, t('import.selected', { n: selectedPaths.length })) : null,
          h('button', {
            type: 'button', className: 'tm_btn tm_btn_primary',
            disabled: busy || selectedPaths.length === 0, onClick: () => runBatch(selectedPaths),
          }, busy ? '…' : t('import.batch'))))

      const previewPage = preview === undefined ? null : h('div', null,
        h('div', { className: 'tm_head', style: { marginBottom: 8 } },
          h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: () => { setPreview(undefined); setStep('browse') } }, `← ${t('import.back')}`),
          h('span', { className: 'tm_title' }, preview.source.split(/[\\/]/).pop()),
          h('span', { className: 'tm_path' }, preview.name)),
        h('div', { className: 'tm_preview_grid' },
          h('div', null, h('span', { className: 'tm_hint' }, t('f_displayName')), h('div', null, preview.meta?.displayName ?? '—')),
          h('div', null, h('span', { className: 'tm_hint' }, t('f_model')), h('div', null, preview.meta?.model ?? t('meta_default'))),
          h('div', null, h('span', { className: 'tm_hint' }, t('f_thinking')), h('div', null, preview.meta?.thinking ?? t('meta_default'))),
          h('div', null, h('span', { className: 'tm_hint' }, t('meta_deep')), h('div', null, String(preview.meta?.deep ?? 1))),
          h('div', null, h('span', { className: 'tm_hint' }, t('f_maxChildren')), h('div', null, (preview.meta?.maxChildren ?? 1) === 0 ? t('meta_childrenNone') : t('meta_children', { n: preview.meta?.maxChildren ?? 1 })))),
        preview.meta?.description ? h('div', { style: { margin: '8px 0' } },
          h('span', { className: 'tm_hint' }, t('f_description')), h('div', null, preview.meta.description)) : null,
        preview.hasFrontmatter ? h('div', { className: 'tm_hint' }, t('import.hadFrontmatter')) : null,
        preview.warning ? h('div', { className: 'tm_note tm_note_error' }, preview.warning) : null,
        h('div', { className: 'tm_hint', style: { marginTop: 8 } }, t('import.bodyPreview', { n: IMPORT_PREVIEW_CHARS })),
        h('pre', { className: 'tm_body_pre' }, (preview.body ?? '').slice(0, IMPORT_PREVIEW_CHARS)),
        h('div', { className: 'tm_dialog_actions', style: { marginTop: 12 } },
          h('button', { type: 'button', className: 'tm_btn', disabled: busy, onClick: () => runBatch([preview.source]) }, t('import.single')),
          h('button', { type: 'button', className: 'tm_btn tm_btn_primary', disabled: busy, onClick: () => onIntoEditor(preview) }, t('import.intoEditor'))))

      return toplevel(h('div', {
        className: 'tm_modal',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onClose() },
      },
        h('div', { className: 'tm_dialog tm_dialog_wide', role: 'dialog', 'aria-modal': 'true' },
          h('h3', null, step === 'preview' ? t('import.previewTitle') : step === 'browse' ? t('import.title') : t('import.pickRoot')),
          step === 'roots' ? rootsPage : null,
          step === 'browse' ? browsePage : null,
          step === 'preview' ? previewPage : null,
          step === 'preview' ? null : h('div', { className: 'tm_dialog_actions', style: { marginTop: 10 } },
            h('button', { type: 'button', className: 'tm_btn', onClick: onClose, disabled: busy }, t('cancel'))))))
    }

    // ── agent card ──────────────────────────────────────────────────────────
    /** One card per subagent. Unlike a skill there is no enable switch — it is
     *  defined or it is not — so the card carries the display name, the model
     *  route (the one accent), and the capability facts. Clicking anywhere opens
     *  the editor; the delete button keeps its own click. */
    function AgentCard(props) {
      const { t, agent, onEdit, onDelete } = props
      const route = agent.model || t('meta_default')
      const capability = (agent.deep ?? 1) === 0
        ? t('meta_leaf')
        : `${t('meta_deep', { n: agent.deep ?? 1 })} · ${(agent.maxChildren ?? 1) === 0
          ? t('meta_childrenNone')
          : t('meta_children', { n: agent.maxChildren ?? 1 })}`
      const facts = [capability]
      if (agent.thinking) facts.push(agent.thinking)
      if (agent.background === true) facts.push(t('meta_background'))
      if (agent.maxRounds !== undefined) facts.push(t('meta_rounds', { n: agent.maxRounds }))
      return h('div', { className: 'tm_card' },
        h('button', {
          type: 'button', className: 'tm_card_title_button',
          'aria-label': t('editTitle', { name: agent.name }),
          title: t('editTitle', { name: agent.name }),
          onClick: () => onEdit(agent),
        }),
        h('div', { className: 'tm_card_title' },
          h('span', { className: 'tm_card_title_text' }, agent.name)),
        agent.displayName ? h('div', { className: 'tm_card_alias' }, agent.displayName) : null,
        h('div', { className: 'tm_card_meta' },
          h('span', { className: 'tm_chip tm_chip_accent', title: t('meta_model') }, route)),
        h('div', { className: 'tm_card_facts' }, facts.map((fact, i) => h('span', { key: i }, fact))),
        // Same foot as a skill card, minus the state toggles a subagent has none of.
        h('div', { className: 'tm_card_foot' },
          h('span', { className: 'tm_card_spacer' }),
          h('button', {
            type: 'button', className: 'tm_card_del',
            title: t('delete'), 'aria-label': `${t('delete')} ${agent.name}`,
            onClick: () => onDelete(agent),
          }, t('delete'))))
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
        return h('div', { className: 'tm_root', 'data-plugin': PLUGIN_NAME },
          h(Editor, {
            t, agents, models: models.data, modelsLoading: models.status === 'loading',
            isNew: editing.isNew, initial: editing.form, dir,
            onBack: () => setEditing(undefined),
            onSaved: () => { setEditing(undefined); list.reload() },
          }))
      }

      return h('div', { className: 'tm_root', 'data-plugin': PLUGIN_NAME },
        h('div', { className: 'tm_head' },
          h('span', { className: 'tm_title' }, t('title')),
          list.data === undefined ? null : h('span', { className: 'tm_count' }, t('count', { n: agents.length }))),
        h('div', { className: 'tm_bar' },
          h('button', { type: 'button', className: 'tm_btn tm_btn_primary', onClick: openNew }, `＋ ${t('add')}`),
          h('button', { type: 'button', className: 'tm_btn', onClick: () => setImporting(true) }, t('import.button')),
          h('input', {
            className: 'tm_input tm_search', type: 'search', placeholder: t('search'),
            'aria-label': t('search'), value: query, onChange: (e) => setQuery(e.target.value),
          }),
          h('button', {
            type: 'button', className: 'tm_btn tm_btn_quiet', title: t('refresh'), 'aria-label': t('refresh'),
            onClick: () => { list.reload(); models.reload() },
          }, '⟳')),
        list.status === 'loading' && list.data === undefined ? h('div', { className: 'tm_hint' }, t('loading')) : null,
        list.status === 'error' ? h('div', { className: 'tm_note tm_note_error' },
          h('b', null, t('loadFailed')), h('div', null, list.error),
          h('div', { style: { marginTop: 8 } }, h('button', { type: 'button', className: 'tm_btn', onClick: list.reload }, t('retry')))) : null,
        list.data !== undefined && agents.length === 0
          ? h('div', { className: 'tm_empty' },
              h('b', null, t('empty')),
              h('div', { style: { marginTop: 10 } },
                h('button', { type: 'button', className: 'tm_btn tm_btn_primary', onClick: openNew }, `＋ ${t('add')}`)))
          : null,
        list.data !== undefined && agents.length > 0 && filtered.length === 0
          ? h('div', { className: 'tm_hint' }, t('noMatch')) : null,
        filtered.length > 0 ? h('div', { className: 'tm_grid' }, filtered.map((agent) => h(AgentCard, {
          key: agent.name, t, agent, onEdit: openEdit, onDelete: (a) => setPendingDelete(a),
        }))) : null,
        broken.length > 0 ? h('div', { className: 'tm_broken' },
          h('div', { className: 'tm_note tm_note_error' },
            h('b', null, t('broken')), h('div', null, t('brokenHint')),
            broken.map((b) => h('div', { key: b.path, className: 'tm_broken_row' }, `${b.path}: ${b.error}`)))) : null,
        // How to call one, folded away.
        h('details', { className: 'tm_fold' },
          h('summary', null, `${t('dispatchHintTitle')} · ${dir}`),
          h('div', { className: 'tm_hint', style: { padding: '6px 0 0' } }, t('dispatchHint'))),
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
    }

    exports.Page = SettingsPage
    exports.apply = apply
    exports.inject = inject
    exports.name = 'subagent-manager'
    // Headless self-check seams.
    exports.__test__ = { DICT, validateForm: nameError, agentToForm, formToPayload, AgentRow: AgentCard }
    return module.exports
  })(require)
const recycle = ((require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    // Embedded copy uses the existing fallback rendering without an external
    // Harness primitives module.
    const primitives = null
    const MenuItemButton = primitives?.MenuItemButton
    const IconTrash = primitives?.IconTrashOutlineRegular
    const Tooltip = primitives?.Tooltip

    const PLUGIN_NAME = 'dsh_session_recyclebin'
    const LOCALE_NS = `${PLUGIN_NAME}/session-row`
    const TRASH_NS = `${PLUGIN_NAME}/trash`

    /** HTTP route of the host half's delete method. */
    const DELETE_PATH = '/session-delete/api/delete'

    /** HTTP route prefix of the trash host half (present only while enabled). */
    const TRASH_API = '/session-delete/api/trash'

    /** Slot this plugin contributes a menu row to. */
    const MENU_SLOT = 'sidebar.workspaces.session.menu.item'

    /** Slot the confirmation dialog and the trash panel are registered into. */
    const OVERLAY_SLOT = 'shell.overlay'

    /** Seat of the sidebar-foot trash button. */
    const FOOTER_SLOT = 'sidebar.footer.action'

    /** Order of the menu row: after the shipped Archive (400). */
    const MENU_ORDER = 500

    /** Order of the confirmation overlay. */
    const OVERLAY_ORDER = 100

    /** Order of the trash panel overlay. */
    const PANEL_ORDER = 110

    /**
     * Order of the trash destructive-step confirmation: above the panel it
     * confirms for, so the step under review is dimmed behind it.
     */
    const CONFIRM_OVERLAY_ORDER = 120

    /** Order inside the sidebar foot: after the shipped settings trigger. */
    const FOOTER_ORDER = 100

    /** Same bounds the host clamps to; the input mirrors them. */
    const RETENTION_MIN = 3
    const RETENTION_MAX = 30

    const en = {
      menu: 'Delete Session',
      menuWithTitle: 'Delete Session "{title}"',
      confirmTitle: 'Delete this session?',
      confirmBody: 'The conversation log, its projection cache, and every attachment it owns are removed permanently. This cannot be undone.',
      confirmTitleTrash: 'Move this session to the trash?',
      confirmBodyTrash: 'The session leaves the sidebar right away and waits in the Session Trash for {days} days, where you can restore it — or delete it forever.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      working: 'Deleting…',
      failed: 'Delete failed: {message}',
      deleted: 'Session deleted'
    }

    const zh = {
      menu: '删除会话',
      menuWithTitle: '删除会话「{title}」',
      confirmTitle: '删除此会话？',
      confirmBody: '将永久删除该会话的对话记录、投影缓存及其拥有的全部附件，且无法恢复。',
      confirmTitleTrash: '将会话移入回收站？',
      confirmBodyTrash: '会话会立即从侧栏消失，并在回收站中保留 {days} 天，期间可随时恢复，也可彻底删除。',
      confirmLabel: '删除',
      cancelLabel: '取消',
      working: '正在删除…',
      failed: '删除失败：{message}',
      deleted: '会话已删除'
    }

    const trashEn = {
      button: 'Session Trash',
      badgeOne: '{count} session in the trash',
      badgeMany: '{count} sessions in the trash',
      title: 'Session Trash',
      empty: 'The trash is empty.',
      purgeAll: 'Empty Trash',
      purgeAllTitle: 'Empty the trash?',
      purgeAllConfirm: 'Permanently delete all {count} trashed sessions? This cannot be undone.',
      purgeTitle: 'Delete forever?',
      retainedFor: 'Keep sessions for',
      retentionHint: '3–30 days.',
      save: 'Save',
      saved: 'Saved',
      remaining: '{days} days left',
      remainingToday: 'expires today',
      restore: 'Restore',
      purge: 'Delete forever',
      purgeConfirm: 'Permanently delete "{title}"? This cannot be undone.',
      loading: 'Loading…',
      failed: 'Trash request failed: {message}',
      refresh: 'Refresh',
      daysUnit: 'days'
    }

    const trashZh = {
      button: '会话回收站',
      badgeOne: '回收站内有 {count} 个会话',
      badgeMany: '回收站内有 {count} 个会话',
      title: '会话回收站',
      empty: '回收站是空的。',
      purgeAll: '清空回收站',
      purgeAllTitle: '清空回收站？',
      purgeAllConfirm: '将 {count} 个回收站会话永久删除？此操作无法恢复。',
      purgeTitle: '彻底删除？',
      retainedFor: '会话保留',
      retentionHint: '可设置 3–30 天。',
      save: '保存',
      saved: '已保存',
      remaining: '剩余 {days} 天',
      remainingToday: '今天到期',
      restore: '恢复',
      purge: '彻底删除',
      purgeConfirm: '永久删除「{title}」？此操作无法恢复。',
      loading: '加载中…',
      failed: '回收站请求失败：{message}',
      refresh: '刷新',
      daysUnit: '天'
    }

    /**
     * Install every dictionary (main + trash) into the locale registry.
     *
     * @param {object} ctx - the client context.
     * @returns {() => void} a disposer unregistering all four dictionaries.
     */
    function attachLocale(ctx) {
      return ctx.effect(() => {
        const offEn = ctx.locale.register(LOCALE_NS, 'en', en)
        const offZh = ctx.locale.register(LOCALE_NS, 'zh', zh)
        const offTrashEn = ctx.locale.register(TRASH_NS, 'en', trashEn)
        const offTrashZh = ctx.locale.register(TRASH_NS, 'zh', trashZh)
        return () => {
          offEn()
          offZh()
          offTrashEn()
          offTrashZh()
        }
      }, `${PLUGIN_NAME}: dictionaries`)
    }

    /** Styles the host primitives do not cover. */
    const CSS = `
[data-${PLUGIN_NAME}-overlay] {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-overlay-scrim, #101828) 55%, transparent);
}

[data-${PLUGIN_NAME}-dialog] {
  width: min(420px, calc(100vw - 48px));
  padding: 20px 24px 16px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay, #ffffff);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--dsw-alias-overlay-scrim, #101828) 24%, transparent);
  color: var(--dsw-alias-label-primary, #101828);
  font-size: 14px;
  line-height: 1.5;
}

[data-${PLUGIN_NAME}-dialog] h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

[data-${PLUGIN_NAME}-dialog] p {
  margin: 0 0 20px;
  color: var(--dsw-alias-label-secondary, #475467);
}

[data-${PLUGIN_NAME}-actions] {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

[data-${PLUGIN_NAME}-button] {
  min-width: 72px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

[data-${PLUGIN_NAME}-button='cancel'] {
  background: var(--dsw-alias-bg-layer-2, #f2f4f7);
  color: var(--dsw-alias-label-primary, #101828);
}

[data-${PLUGIN_NAME}-button='confirm'] {
  background: var(--dsw-alias-state-error-primary, #d92d20);
  color: #ffffff;
}

[data-${PLUGIN_NAME}-button]:disabled {
  cursor: default;
  opacity: 0.6;
}

[data-${PLUGIN_NAME}-notice] {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--dsw-alias-state-error-primary, #d92d20);
}

[data-${PLUGIN_NAME}-menu-fallback] {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-state-error-primary, #d92d20);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

[data-${PLUGIN_NAME}-menu-fallback]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(16, 24, 40, 0.05));
}

[data-${PLUGIN_NAME}-separator] {
  height: 1px;
  margin: 4px 0;
  background: var(--dsw-alias-border-l1, rgba(16, 24, 40, 0.1));
}

[data-${PLUGIN_NAME}-trash-button] {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
}

[data-${PLUGIN_NAME}-trash-button]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(16, 24, 40, 0.06));
  color: var(--dsw-alias-label-primary, inherit);
}

[data-${PLUGIN_NAME}-trash-badge] {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--dsw-alias-state-error-primary, #d92d20);
  color: #ffffff;
  font-size: 10px;
  line-height: 15px;
  text-align: center;
}

[data-${PLUGIN_NAME}-trash-panel] {
  width: min(560px, calc(100vw - 48px));
  max-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 18px 20px 14px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay, #ffffff);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--dsw-alias-overlay-scrim, #101828) 24%, transparent);
  color: var(--dsw-alias-label-primary, #101828);
  font-size: 14px;
}

[data-${PLUGIN_NAME}-trash-panel] h2 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

[data-${PLUGIN_NAME}-trash-retention] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary, inherit);
}

[data-${PLUGIN_NAME}-trash-retention] input {
  width: 56px;
  padding: 4px 6px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d5dd);
  border-radius: 6px;
  font: inherit;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: inherit;
}

[data-${PLUGIN_NAME}-trash-list] {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

[data-${PLUGIN_NAME}-trash-row] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(16, 24, 40, 0.03));
}

[data-${PLUGIN_NAME}-trash-row-main] {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

[data-${PLUGIN_NAME}-trash-row-title] {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

[data-${PLUGIN_NAME}-trash-row-meta] {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, inherit);
}

[data-${PLUGIN_NAME}-trash-act] {
  border: 1px solid var(--dsw-alias-border-l2, #d0d5dd);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, inherit);
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

[data-${PLUGIN_NAME}-trash-act]:hover {
  border-color: var(--dsw-alias-label-secondary, inherit);
}

[data-${PLUGIN_NAME}-trash-act='purge'] {
  color: var(--dsw-alias-state-error-primary, #d92d20);
}

[data-${PLUGIN_NAME}-trash-act]:disabled {
  opacity: 0.55;
  cursor: default;
}

[data-${PLUGIN_NAME}-trash-foot] {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

[data-${PLUGIN_NAME}-trash-empty] {
  color: var(--dsw-alias-label-secondary, inherit);
  text-align: center;
  padding: 24px 0;
}

[data-${PLUGIN_NAME}-trash-error] {
  color: var(--dsw-alias-state-error-primary, #d92d20);
  font-size: 13px;
  margin: 0 0 10px;
}
`

    /**
     * Insert the plugin's stylesheet, once per page.
     *
     * @returns {() => void} a disposer removing the style element.
     */
    function attachStyles() {
      if (typeof document === 'undefined') return () => {}
      const tagId = `${PLUGIN_NAME}/session-row.css`
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(tagId)}]`) !== null) {
        return () => {}
      }
      const tag = document.createElement('style')
      tag.dataset.plugin = PLUGIN_NAME
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    // -------------------------------------------------------------------------
    // Confirmation store (menu row → dialog). Deliberately outside React: the
    // row that opens the dialog lives in a different slot occurrence from the
    // dialog, so the two cannot share a useState owner; the explicit
    // subscription is what re-renders the dialog when the row fires.
    // -------------------------------------------------------------------------

    /**
     * @typedef {object} PendingDelete
     * @property {string} sessionId - the session to delete.
     * @property {string} title - the row's display title, for the dialog.
     */

    /** Live confirmation request, or `null` when the dialog is closed. */
    let pending = null

    /** Subscribers notified when {@link pending} changes. */
    const listeners = new Set()

    /**
     * @param {() => void} listener - called on every change.
     * @returns {() => void} an unsubscribe function.
     */
    function subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    /** Notify every subscriber that the confirmation state changed. */
    function emit() {
      for (const listener of listeners) listener()
    }

    /** @returns {PendingDelete | null} the live request. */
    function current() {
      return pending
    }

    /**
     * Open the confirmation dialog for one session.
     *
     * @param {PendingDelete} request - the session awaiting confirmation.
     * @returns {void}
     */
    let isEnabled = () => true

    function requestDelete(request) {
      if (!isEnabled()) return
      pending = request
      emit()
    }

    /** Close the confirmation dialog. */
    function closeDialog() {
      pending = null
      emit()
    }

    // -------------------------------------------------------------------------
    // Trash store: the probe verdict, the parked list, panel visibility. One
    // module-level store every trash surface subscribes to.
    // -------------------------------------------------------------------------

    /**
     * @typedef {object} TrashState
     * @property {boolean | null} enabled - null until the first probe settles.
     * @property {boolean} open - whether the panel is showing.
     * @property {boolean} loading
     * @property {string | null} error
     * @property {Array<object>} entries - the host's list payload.
     * @property {number} retentionDays
     */

    /** @type {TrashState} */
    let trashState = {
      enabled: null,
      open: false,
      loading: false,
      error: null,
      entries: [],
      retentionDays: RETENTION_MIN + 4
    }

    const trashListeners = new Set()

    /**
     * Patch the trash state and notify subscribers.
     *
     * @param {Partial<TrashState>} patch
     * @returns {void}
     */
    function setTrash(patch) {
      trashState = { ...trashState, ...patch }
      for (const listener of trashListeners) listener()
    }

    /**
     * @param {() => void} listener
     * @returns {() => void} an unsubscribe function.
     */
    function subscribeTrash(listener) {
      trashListeners.add(listener)
      return () => {
        trashListeners.delete(listener)
      }
    }

    /** @returns {TrashState} the live snapshot. */
    function trashSnapshot() {
      return trashState
    }

    // -------------------------------------------------------------------------
    // Destructive-confirmation store: the trash panel's purge / empty steps.
    //
    // Deliberately NOT `window.confirm`: that call is synchronous and modal, so
    // it blocks the renderer's event loop for its whole lifetime and leaves the
    // page unable to take pointer input afterwards — the exact "can't click
    // anything any more" failure. A plugin-owned dialog is asynchronous, themed
    // by the same stylesheet as the rest of these surfaces, and dismissible.
    // -------------------------------------------------------------------------

    /**
     * @typedef {object} TrashConfirm
     * @property {'purge' | 'empty'} kind - which destructive step is awaiting.
     * @property {string | undefined} sessionId - the target of a purge.
     * @property {string | undefined} title - its display title, for the copy.
     * @property {number} count - the number of entries an empty would remove.
     * @property {(confirmed: boolean) => void} resolve - settles the request.
     */

    /** Live destructive-confirmation request, or `null` when none is open. */
    let trashConfirm = null

    /** Subscribers notified when {@link trashConfirm} changes. */
    const trashConfirmListeners = new Set()

    /**
     * @param {() => void} listener
     * @returns {() => void} an unsubscribe function.
     */
    function subscribeTrashConfirm(listener) {
      trashConfirmListeners.add(listener)
      return () => {
        trashConfirmListeners.delete(listener)
      }
    }

    /** @returns {TrashConfirm | null} the live request. */
    function trashConfirmSnapshot() {
      return trashConfirm
    }

    /**
     * Ask the user to confirm one destructive trash step.
     *
     * @param {Omit<TrashConfirm, 'resolve'>} request - the step to confirm.
     * @returns {Promise<boolean>} true when the user confirmed.
     */
    function askTrashConfirm(request) {
      return new Promise((resolve) => {
        trashConfirm = { ...request, resolve }
        for (const listener of trashConfirmListeners) listener()
      })
    }

    /**
     * Settle the open request and close the dialog.
     *
     * @param {boolean} confirmed - the user's answer.
     * @returns {void}
     */
    function settleTrashConfirm(confirmed) {
      const request = trashConfirm
      trashConfirm = null
      for (const listener of trashConfirmListeners) listener()
      request?.resolve(confirmed)
    }

    /**
     * POST one JSON body to a trash route.
     *
     * @param {string} method - list / restore / purge / empty / settings.
     * @param {Record<string, unknown>} [body]
     * @returns {Promise<any>} the payload on 2xx + ok.
     * @throws {Error} the host's message (with `code`) on any failure.
     */
    async function callTrash(method, body) {
      const response = await fetch(`${TRASH_API}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {})
      })
      const payload = await response.json().catch(() => undefined)
      if (!response.ok || payload?.ok !== true) {
        const error = new Error(payload?.error?.message ?? `HTTP ${response.status}`)
        Object.defineProperty(error, 'code', { value: payload?.error?.code })
        Object.defineProperty(error, 'status', { value: response.status })
        throw error
      }
      return payload
    }

    /**
     * Probe the trash through the shared list route.
     *
     * An `ok` list means the trash host routes are live (the sub-plugin is
     * enabled); a 404 means its row is absent from the composition (disabled).
     * Any other failure leaves the previous verdict alone — a carrier fault is
     * not evidence the user turned the feature off, and the dialog keeps its
     * last wording rather than flicker.
     */
    async function probeTrash() {
      try {
        const payload = await callTrash('list')
        acceptTrashList(payload)
        setTrash({
          enabled: true,
          entries: Array.isArray(payload.entries) ? payload.entries : [],
          retentionDays: typeof payload.retentionDays === 'number'
            ? payload.retentionDays
            : trashState.retentionDays
        })
      } catch (error) {
        const missing = error?.status === 404 || /HTTP 404/.test(String(error?.message ?? ''))
        if (missing) setTrash({ enabled: false })
      }
    }

    /**
     * Toggle the trash panel's open state.
     *
     * @param {boolean} open - the new panel visibility.
     * @returns {void}
     */
    function setPanelOpen(open) {
      setTrash({ open })
    }

    /**
     * Re-fetch the trash list and refresh the badge, panel rows, and retention
     * copy after any mutation (move / restore / purge / empty / settings).
     *
     * @returns {Promise<void>}
     */
    async function refreshTrashList() {
      setTrash({ loading: true, error: null })
      try {
        const payload = await callTrash('list')
        acceptTrashList(payload)
        setTrash({
          enabled: true,
          loading: false,
          entries: Array.isArray(payload.entries) ? payload.entries : [],
          retentionDays: typeof payload.retentionDays === 'number'
            ? payload.retentionDays
            : trashState.retentionDays
        })
      } catch (error) {
        setTrash({ loading: false, error: error instanceof Error ? error.message : String(error) })
      }
    }

    // -------------------------------------------------------------------------
    // The delete request.
    // -------------------------------------------------------------------------

    /**
     * POST one session to the host half's delete route.
     *
     * @param {string} sessionId - the session to delete.
     * @returns {Promise<{ ok: boolean, message?: string, trashed?: boolean }>} the host's report.
     */
    async function callDelete(sessionId) {
      try {
        const response = await fetch(DELETE_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId })
        })
        const payload = await response.json().catch(() => undefined)
        if (!response.ok || payload?.ok !== true) {
          const message = payload?.error?.message ?? `HTTP ${response.status}`
          return { ok: false, message }
        }
        return { ok: true, trashed: payload.trashed === true }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }

    // -------------------------------------------------------------------------
    // Keeping the sidebar in step with the host.
    // -------------------------------------------------------------------------

    /**
     * The client context, captured when the bundle applies.
     *
     * The delete confirmation dialog lives in a different slot occurrence from
     * `apply`, so it cannot close over the context; the module-level handle is
     * what lets a completed delete reach the workspace service.
     *
     * @type {object | null}
     */
    let clientCtx = null

    // Verified against the shipped Session Controller: list is a writable
    // SnapshotStore { ids, byId, phase, projectionsBySession }. refresh() merges
    // old rows into the new baseline; deletion needs a separate presentation
    // filter, independent of the user's archivedFilter.
    // Preserve browser state across the package rename.
    const TOMBSTONES_KEY = 'dsh-session-delete/hidden-session-ids'
    let hiddenSessionIds = new Set()
    let permanentSessionIds = new Set()
    let filteringList = false

    function filterDeletedSessions() {
      let list
      try { list = clientCtx?.get('sessions')?.list } catch { return }
      if (filteringList || typeof list?.set !== 'function') return
      const snapshot = list.getSnapshot()
      if (!Array.isArray(snapshot.ids) || !snapshot.byId) return
      const ids = snapshot.ids.filter((id) => !hiddenSessionIds.has(id))
      const removed = Object.keys(snapshot.byId).filter((id) => hiddenSessionIds.has(id))
      if (ids.length === snapshot.ids.length && removed.length === 0) return
      const byId = { ...snapshot.byId }
      for (const id of removed) delete byId[id]
      filteringList = true
      try { list.set({ ...snapshot, ids, byId }) } finally { filteringList = false }
    }

    function hideSessions(ids) {
      for (const id of ids) if (typeof id === 'string' && id !== '') hiddenSessionIds.add(id)
      try { localStorage.setItem(TOMBSTONES_KEY, JSON.stringify({ hidden: [...hiddenSessionIds], permanent: [...permanentSessionIds] })) } catch {}
      filterDeletedSessions()
    }

    function acceptTrashList(payload) {
      // Host authority includes purged ids and removes restored ids.
      if (Array.isArray(payload.hiddenSessionIds)) {
        hiddenSessionIds = new Set([...payload.hiddenSessionIds.filter((id) => typeof id === 'string' && id !== ''), ...permanentSessionIds])
      }
      hideSessions((Array.isArray(payload.entries) ? payload.entries : []).map((entry) => entry.sessionId))
    }

    function attachSessionFilter(sessions) {
      try {
        const saved = JSON.parse(localStorage.getItem(TOMBSTONES_KEY) ?? '[]')
        if (Array.isArray(saved)) hiddenSessionIds = new Set(saved.filter((id) => typeof id === 'string'))
        else if (saved && Array.isArray(saved.hidden)) {
          permanentSessionIds = new Set((Array.isArray(saved.permanent) ? saved.permanent : []).filter((id) => typeof id === 'string'))
          hiddenSessionIds = new Set([...saved.hidden.filter((id) => typeof id === 'string'), ...permanentSessionIds])
        }
      } catch {}
      const list = sessions?.list
      if (typeof list?.subscribe !== 'function' || typeof list?.set !== 'function') {
        console.warn('[dsh_session_recyclebin] Session list filtering unavailable')
        return () => {}
      }
      const unsubscribe = list.subscribe(filterDeletedSessions)
      filterDeletedSessions()
      return () => {
        unsubscribe()
        // Verified implementation hook: restore current manager presentation on
        // unload without patching service methods or restoring a stale snapshot.
        if (typeof sessions.projectList === 'function') sessions.projectList()
      }
    }

    /**
     * Wait for the session-list owner without Cordis deferred injection.
     *
     * Reads the service through `ctx.get` on a short interval and stops as soon
     * as it appears, so a host that publishes the service later still gets the
     * deletion filter. Resolves to `undefined` after the budget, which simply
     * means "no version lock broke the plugin".
     *
     * @returns {Promise<object | undefined>} the session service, when found.
     */
    async function retrySessions() {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        let sessions
        try { sessions = clientCtx?.get('sessions') } catch { sessions = undefined }
        if (sessions !== undefined) return sessions
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      return undefined
    }

    /** Pull the real controller baseline, then reapply deletion tombstones. */
    async function refreshSessionList(sessions) {
      const ctx = clientCtx
      const owner = sessions ?? (ctx === null ? undefined : ctx.get('sessions'))
      if (typeof owner?.refresh !== 'function') throw new Error('Session list refresh unavailable')
      await owner.refresh()
      filterDeletedSessions()
    }

    // -------------------------------------------------------------------------
    // The menu row.
    // -------------------------------------------------------------------------

    /**
     * The "Delete Session" menu row.
     *
     * Rendered through the shipped `MenuItemButton` — the exact component the
     * WorkspaceBrowser's own rows use — so padding, hairline, icon slot, hover,
     * and the destructive row color all come from the host stylesheet instead
     * of plugin CSS. Without a primitives lane the row degrades to a plain
     * `role="menuitem"` button with the plugin's fallback styling.
     *
     * A list-slot entry receives only the row identity, so the row carries its
     * own behavior through the registration's `inject` face and dismisses the
     * menu through the slot-level `useMenuOpenState` hook the menu passes down
     * as a prop — the same hook the shipped rows use.
     *
     * @param {object} props - the slot's projected props.
     * @param {string} props.sessionId - the session this row belongs to.
     * @param {string} props.displayTitle - the session's display title.
     * @param {() => [boolean, (open: boolean) => void]} props.useMenuOpenState - the menu's own open state.
     * @param {(request: PendingDelete) => void} props.requestDelete - open the dialog.
     * @param {(key: string, values?: Record<string, string>) => string} props.t - the translate function.
     * @returns {object} the menu row.
     */
    function DeleteSessionRow({ sessionId, displayTitle, useMenuOpenState, requestDelete: ask, t }) {
      const [, setMenuOpen] = useMenuOpenState()
      if (!isEnabled()) return null
      const label = typeof displayTitle === 'string' && displayTitle !== ''
        ? t('menuWithTitle', { title: displayTitle })
        : t('menu')
      const onSelect = () => {
        setMenuOpen(false)
        ask({ sessionId, title: typeof displayTitle === 'string' ? displayTitle : sessionId })
      }

      const icon = typeof IconTrash === 'function'
        ? React.createElement(IconTrash, { size: 14 })
        : null

      if (typeof MenuItemButton === 'function') {
        return React.createElement(MenuItemButton, {
          icon,
          danger: true,
          separatorBefore: true,
          onSelect
        }, label)
      }

      return React.createElement(React.Fragment, null,
        React.createElement('div', { role: 'separator', [`data-${PLUGIN_NAME}-separator`]: '' }),
        React.createElement('button', {
          type: 'button',
          role: 'menuitem',
          [`data-${PLUGIN_NAME}-menu-fallback`]: '',
          onClick: onSelect
        }, icon, label)
      )
    }

    // -------------------------------------------------------------------------
    // The confirmation dialog.
    // -------------------------------------------------------------------------

    /**
     * The confirmation dialog, a `shell.overlay` entry.
     *
     * Subscribes to the confirmation store (installed in an effect, torn down
     * with the entry) and mirrors the trash verdict so the copy can say
     * "move to trash for N days" instead of "gone forever" when the optional
     * sub-plugin is enabled.
     *
     * @param {object} props - the slot's projected props.
     * @param {(request: PendingDelete | null) => void} props.setPending - replace the pending request.
     * @param {(key: string, values?: Record<string, string | number>) => string} props.t - the translate function.
     * @returns {object | null} the dialog, or null when closed.
     */
    function ConfirmDialog({ setPending, t }) {
      const [request, setRequest] = React.useState(current)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [trashNow, setTrashNow] = React.useState(trashState.enabled === true)
      const [retention, setRetention] = React.useState(trashState.retentionDays)

      React.useEffect(() => subscribe(() => {
        setRequest(current())
        setBusy(false)
        setError(null)
      }), [])
      React.useEffect(() => subscribeTrash(() => {
        setTrashNow(trashState.enabled === true)
        setRetention(trashState.retentionDays)
      }), [])

      if (request === null) return null

      const confirm = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        const result = await callDelete(request.sessionId)
        setBusy(false)
        if (result.ok) {
          if (result.trashed !== true) permanentSessionIds.add(request.sessionId)
          hideSessions([request.sessionId])
          setPending(null)
          try {
            if (result.trashed === true || trashState.enabled === true) await refreshTrashList()
            await refreshSessionList()
          } catch (error) {
            setTrash({ error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        setError(result.message ?? t('failed', { message: 'unknown' }))
      }

      const cancel = () => {
        if (busy) return
        setPending(null)
      }

      return React.createElement('div', {
        'data-plugin': PLUGIN_NAME,
        [`data-${PLUGIN_NAME}-overlay`]: '',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) cancel()
        }
      },
        React.createElement('div', {
          [`data-${PLUGIN_NAME}-dialog`]: '',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-label': trashNow ? t('confirmTitleTrash') : t('confirmTitle')
        },
          React.createElement('h2', null, trashNow ? t('confirmTitleTrash') : t('confirmTitle')),
          error === null
            ? null
            : React.createElement('p', { [`data-${PLUGIN_NAME}-notice`]: '', role: 'alert' }, error),
          React.createElement('p', null, trashNow
            ? t('confirmBodyTrash', { days: String(retention) })
            : t('confirmBody')),
          React.createElement('div', { [`data-${PLUGIN_NAME}-actions`]: '' },
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-button`]: 'cancel',
              onClick: cancel,
              disabled: busy
            }, t('cancelLabel')),
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-button`]: 'confirm',
              onClick: confirm,
              disabled: busy
            }, busy ? t('working') : t('confirmLabel'))
          )
        )
      )
    }

    // -------------------------------------------------------------------------
    // The trash surfaces.
    // -------------------------------------------------------------------------

    /**
     * The sidebar-foot trash button.
     *
     * @param {object} props - the slot's projected props.
     * @param {(key: string, values?: Record<string, string>) => string} props.t - the translate function.
     * @returns {object | null} the button, or null while the trash is off.
     */
    function TrashButton({ t }) {
      const [state, setState] = React.useState(trashSnapshot)
      React.useEffect(() => subscribeTrash(() => setState(trashSnapshot())), [])
      if (state.enabled !== true) return null

      const icon = typeof IconTrash === 'function'
        ? React.createElement(IconTrash, { size: 16 })
        : React.createElement('span', { 'aria-hidden': 'true' }, '🗑')
      const count = state.entries.length
      const badge = count > 0
        ? React.createElement('span', {
          [`data-${PLUGIN_NAME}-trash-badge`]: '',
          'aria-label': t(count === 1 ? 'badgeOne' : 'badgeMany', { count: String(count) })
        }, String(count))
        : null
      const label = t('button')

      const button = React.createElement('button', {
        type: 'button',
        [`data-${PLUGIN_NAME}-trash-button`]: '',
        'aria-label': label,
        title: label,
        onClick: () => setPanelOpen(!state.open)
      }, icon, badge)

      if (typeof Tooltip === 'function') {
        return React.createElement(Tooltip, { label, side: 'top', delayMs: 500 }, button)
      }
      return button
    }

    /**
     * The display title of one trash entry.
     *
     * @param {{ title?: string, sessionId: string, cwd?: string }} entry
     * @returns {string} the session name, else the directory basename, else the id.
     */
    function trashEntryTitle(entry) {
      const title = typeof entry.title === 'string' ? entry.title.trim() : ''
      if (title !== '') return title
      const cwd = typeof entry.cwd === 'string' ? entry.cwd.replace(/[/\\]+$/, '') : ''
      const cut = Math.max(cwd.lastIndexOf('/'), cwd.lastIndexOf('\\'))
      const base = cut === -1 ? cwd : cwd.slice(cut + 1)
      return base !== '' ? base : entry.sessionId
    }

    /**
     * One session row inside the trash panel.
     *
     * The host resolves the display title from the session log, so `entry.title`
     * is the session name. The fallbacks exist only for an entry written before
     * that fold existed: a readable directory basename beats a raw session id,
     * which reads as a file name rather than a conversation.
     *
     * @param {object} props - the row's props.
     * @param {object} props.entry - one host list entry.
     * @param {(key: string, values?: Record<string, string>) => string} props.t - the translate function.
     * @returns {object} the row.
     */
    function TrashRow({ entry, t }) {
      const [busy, setBusy] = React.useState(false)
      const title = trashEntryTitle(entry)

      const run = async (action) => {
        if (busy) return
        setBusy(true)
        try {
          await callTrash(action, { sessionId: entry.sessionId })
          if (action === 'restore') hiddenSessionIds.delete(entry.sessionId)
          else hideSessions([entry.sessionId])
          hideSessions([])
          setTrash({ entries: trashState.entries.filter((item) => item.sessionId !== entry.sessionId), error: null })
          await refreshTrashList()
          await refreshSessionList()
        } catch (error) {
          setTrash({ error: error instanceof Error ? error.message : String(error) })
        } finally {
          setBusy(false)
        }
      }

      const onPurge = async () => {
        if (busy) return
        const confirmed = await askTrashConfirm({
          kind: 'purge',
          sessionId: entry.sessionId,
          title,
          count: 1
        })
        if (!confirmed) return
        await run('purge')
      }

      const remaining = entry.remainingDays > 0
        ? t('remaining', { days: String(entry.remainingDays) })
        : t('remainingToday')

      return React.createElement('li', { [`data-${PLUGIN_NAME}-trash-row`]: '' },
        React.createElement('div', { [`data-${PLUGIN_NAME}-trash-row-main`]: '' },
          React.createElement('span', { [`data-${PLUGIN_NAME}-trash-row-title`]: '', title }, title),
          React.createElement('span', { [`data-${PLUGIN_NAME}-trash-row-meta`]: '' }, remaining)
        ),
        React.createElement('button', {
          type: 'button',
          [`data-${PLUGIN_NAME}-trash-act`]: 'restore',
          disabled: busy,
          onClick: () => void run('restore')
        }, t('restore')),
        React.createElement('button', {
          type: 'button',
          [`data-${PLUGIN_NAME}-trash-act`]: 'purge',
          disabled: busy,
          onClick: onPurge
        }, t('purge'))
      )
    }

    /**
     * The trash panel overlay.
     *
     * @param {object} props - the slot's projected props.
     * @param {(key: string, values?: Record<string, string>) => string} props.t - the translate function.
     * @returns {object | null} the panel, or null while closed / disabled.
     */
    function TrashPanel({ t }) {
      const [state, setState] = React.useState(trashSnapshot)
      React.useEffect(() => subscribeTrash(() => {
        setState(trashSnapshot())
        setDays(String(trashSnapshot().retentionDays))
      }), [])
      const [days, setDays] = React.useState(String(trashState.retentionDays))
      const [savedFlash, setSavedFlash] = React.useState(false)
      const [busy, setBusy] = React.useState(false)

      if (state.enabled !== true || !state.open) return null

      const close = () => setPanelOpen(false)

      const saveRetention = async () => {
        setBusy(true)
        try {
          const payload = await callTrash('settings', { retentionDays: Number(days) })
          // The host clamps and reports the effective value; show that, not
          // whatever was typed.
          setDays(String(payload.retentionDays))
          setSavedFlash(true)
          setTimeout(() => setSavedFlash(false), 1500)
          await refreshTrashList()
        } catch (error) {
          setTrash({ error: error instanceof Error ? error.message : String(error) })
        } finally {
          setBusy(false)
        }
      }

      const emptyAll = async () => {
        if (state.entries.length === 0) return
        const confirmed = await askTrashConfirm({
          kind: 'empty',
          count: state.entries.length
        })
        if (!confirmed) return
        setBusy(true)
        try {
          const report = await callTrash('empty')
          // Empty can partially succeed. Keep failed rows, hide every attempted
          // trashed identity from the sidebar, and display the host's failures.
          const entries = trashState.entries
          hideSessions(entries.map((entry) => entry.sessionId))
          const failed = Array.isArray(report.failures) ? report.failures : Array.isArray(report.failed) ? report.failed : []
          const failedIds = new Set(failed.map((item) => item.sessionId))
          setTrash({ entries: entries.filter((entry) => failedIds.has(entry.sessionId)), error: null })
          await refreshTrashList()
          await refreshSessionList()
          if (failed.length > 0) {
            setTrash({ error: failed.map((item) => `${item.sessionId ?? ''}: ${item.error?.message ?? item.message ?? String(item.error ?? 'Delete failed')}`).join('\n') })
          } else if (typeof report.failed === 'number' && report.failed > 0) {
            setTrash({ error: `Failed: ${report.failed}` })
          }
        } catch (error) {
          setTrash({ error: error instanceof Error ? error.message : String(error) })
        } finally {
          setBusy(false)
        }
      }

      return React.createElement('div', {
        'data-plugin': PLUGIN_NAME,
        [`data-${PLUGIN_NAME}-overlay`]: '',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close()
        }
      },
        React.createElement('div', {
          [`data-${PLUGIN_NAME}-trash-panel`]: '',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('title')
        },
          React.createElement('h2', null, t('title')),
          state.error === null
            ? null
            : React.createElement('p', { [`data-${PLUGIN_NAME}-trash-error`]: '', role: 'alert' },
              t('failed', { message: state.error })),
          React.createElement('div', { [`data-${PLUGIN_NAME}-trash-retention`]: '' },
            React.createElement('span', null, t('retainedFor')),
            React.createElement('input', {
              type: 'number',
              min: String(RETENTION_MIN),
              max: String(RETENTION_MAX),
              step: '1',
              value: days,
              disabled: busy,
              'aria-label': t('retainedFor'),
              onChange: (event) => setDays(event.target.value)
            }),
            React.createElement('span', null, t('daysUnit')),
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-trash-act`]: 'save',
              disabled: busy,
              onClick: () => void saveRetention()
            }, savedFlash ? t('saved') : t('save')),
            React.createElement('span', null, t('retentionHint'))
          ),
          state.loading && state.entries.length === 0
            ? React.createElement('p', { [`data-${PLUGIN_NAME}-trash-empty`]: '' }, t('loading'))
            : state.entries.length === 0
              ? React.createElement('p', { [`data-${PLUGIN_NAME}-trash-empty`]: '' }, t('empty'))
              : React.createElement('ul', { [`data-${PLUGIN_NAME}-trash-list`]: '' },
                state.entries.map((entry) =>
                  React.createElement(TrashRow, { key: entry.sessionId, entry, t }))),
          React.createElement('div', { [`data-${PLUGIN_NAME}-trash-foot`]: '' },
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-trash-act`]: 'empty',
              disabled: busy || state.entries.length === 0,
              onClick: () => void emptyAll()
            }, t('purgeAll')),
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-trash-act`]: 'refresh',
              disabled: busy,
              onClick: () => void refreshTrashList()
            }, t('refresh'))
          )
        )
      )
    }

    /**
     * The destructive-step confirmation for the trash panel.
     *
     * A `shell.overlay` entry like the delete dialog, sharing its stylesheet and
     * its button shapes, so a purge or an empty reads as the same kind of
     * decision the delete already is. It exists because `window.confirm` blocks
     * the renderer for its whole lifetime and leaves the page unable to take
     * pointer input afterwards.
     *
     * @param {object} props - the slot's projected props.
     * @param {(key: string, values?: Record<string, string>) => string} props.t - the translate function.
     * @returns {object | null} the dialog, or null when nothing awaits.
     */
    function TrashConfirmDialog({ t }) {
      const [request, setRequest] = React.useState(trashConfirmSnapshot)
      React.useEffect(() => subscribeTrashConfirm(() => setRequest(trashConfirmSnapshot())), [])

      if (request === null) return null

      const cancel = () => settleTrashConfirm(false)
      const confirm = () => settleTrashConfirm(true)
      const title = request.kind === 'empty'
        ? t('purgeAllConfirm', { count: String(request.count) })
        : t('purgeConfirm', { title: request.title ?? '' })

      return React.createElement('div', {
        'data-plugin': PLUGIN_NAME,
        [`data-${PLUGIN_NAME}-overlay`]: '',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) cancel()
        }
      },
        React.createElement('div', {
          [`data-${PLUGIN_NAME}-dialog`]: '',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-label': title
        },
          React.createElement('h2', null, request.kind === 'empty' ? t('purgeAllTitle') : t('purgeTitle')),
          React.createElement('p', null, title),
          React.createElement('div', { [`data-${PLUGIN_NAME}-actions`]: '' },
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-button`]: 'cancel',
              onClick: cancel
            }, request.kind === 'empty' ? '取消' : t('cancelLabel')),
            React.createElement('button', {
              type: 'button',
              [`data-${PLUGIN_NAME}-button`]: 'confirm',
              onClick: confirm
            }, request.kind === 'empty' ? '确认清空' : t('confirmLabel'))
          )
        )
      )
    }

    /**
     * Client plugin body.
     *
     * @param {object} ctx - the client context (`slots` + `locale`).
     * @returns {void}
     */
    function apply(ctx, options = {}) {
      isEnabled = typeof options.enabled === 'function' ? options.enabled : () => true
      clientCtx = ctx
      // Version resilience: this half declares no hard service dependency and
      // does not assume a DSH release. The sidebar filter starts as soon as the
      // session-list owner exists — immediately when the context offers deferred
      // injection, and as a retry otherwise — so a changed service set or load
      // order in a newer host cannot leave deletion unfiltered. Everything else
      // registers through the slot and locale contracts, which are stable.
      if (typeof ctx.inject === 'function') {
        ctx.inject(['sessions'], (scoped) => attachSessionFilter(scoped.sessions ?? scoped.get?.('sessions')))
      } else {
        // Older host without deferred injection: wait for the service, then
        // attach. The effect owns the eventual disposer so the subscription is
        // still removed on unload.
        ctx.effect(() => {
          let dispose = () => {}
          void retrySessions().then((sessions) => {
            if (sessions !== undefined) dispose = attachSessionFilter(sessions)
          })
          return () => dispose()
        }, `${PLUGIN_NAME}: deleted session list filter`)
      }
      attachLocale(ctx)
      ctx.effect(attachStyles, `${PLUGIN_NAME}: stylesheet`)

      const t = ctx.locale.bind(LOCALE_NS)
      const tt = ctx.locale.bind(TRASH_NS)

      ctx.effect(() => ctx.slots.inject(MENU_SLOT, () => ctx.slots.register({
        name: MENU_SLOT,
        id: `${PLUGIN_NAME}.delete-session`,
        order: MENU_ORDER,
        locale: LOCALE_NS,
        inject: () => ({ requestDelete })
      }, DeleteSessionRow)), `${PLUGIN_NAME}: session menu row`)

      ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
        name: OVERLAY_SLOT,
        id: `${PLUGIN_NAME}.confirm`,
        order: OVERLAY_ORDER,
        inject: () => ({
          setPending: (next) => {
            if (next === null) closeDialog()
            else requestDelete(next)
          },
          t
        })
      }, ConfirmDialog)), `${PLUGIN_NAME}: confirmation overlay`)

      ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
        name: OVERLAY_SLOT,
        id: `${PLUGIN_NAME}.trash-panel`,
        order: PANEL_ORDER,
        locale: TRASH_NS
      }, () => React.createElement(TrashPanel, { t: tt }))), `${PLUGIN_NAME}: trash panel overlay`)

      ctx.effect(() => ctx.slots.inject(FOOTER_SLOT, () => ctx.slots.register({
        name: FOOTER_SLOT,
        id: `${PLUGIN_NAME}.trash-button`,
        order: FOOTER_ORDER,
        locale: TRASH_NS
      }, () => React.createElement(TrashButton, { t: tt }))), `${PLUGIN_NAME}: trash footer button`)

      // The destructive-step confirmation for the trash panel. It renders ABOVE
      // the panel (a higher order), so an empty or a purge is confirmed over the
      // list it is about to remove.
      ctx.effect(() => ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
        name: OVERLAY_SLOT,
        id: `${PLUGIN_NAME}.trash-confirm`,
        order: CONFIRM_OVERLAY_ORDER,
        locale: TRASH_NS
      }, () => React.createElement(TrashConfirmDialog, { t: tt }))), `${PLUGIN_NAME}: trash confirm overlay`)

      // Trash probe: once on mount, and again whenever the window regains
      // focus — so toggling the sub-plugin in the plugin settings shows up
      // when the user clicks back into the app, without a page reload.
      ctx.effect(() => {
        void probeTrash()
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
          return () => {}
        }
        const onFocus = () => void probeTrash()
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
      }, `${PLUGIN_NAME}: trash probe`)
    }

    /**
     * Version resilience: only the two contracts this half registers through are
     * declared — the slot registry and the locale registry. The session-list
     * owner is bound late, so a renamed or later-published service cannot block
     * the plugin from loading.
     */
    const inject = ['slots', 'locale']

    /** The stores and calls, exported for the self-check. */
    const store = {
      subscribe,
      current,
      requestDelete,
      closeDialog,
      subscribeTrash,
      trashSnapshot,
      setTrash,
      setPanelOpen,
      probeTrash,
      refreshTrashList,
      refreshSessionList,
      callTrash,
      callDelete,
      subscribeTrashConfirm,
      trashConfirmSnapshot,
      askTrashConfirm,
      settleTrashConfirm,
      retrySessions
    }

    exports.open = async () => {
      await probeTrash()
      setPanelOpen(true)
      await refreshTrashList()
    }
    exports.apply = apply
    exports.inject = inject
    exports.store = store
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
    render() { return this.state.failed ? h('p', { role: 'alert', className: 'tm_note tm_note_error' }, 'TeamManeger 已因页面冲突停止，详情见 DSH 日志。') : this.props.children }
  }

  // One settings entry. The frame owns only what is shared between the two
  // pages — the module switches and the tab bar — so neither page has to know
  // the other exists.
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
    // Land on a page the user can actually use: if the remembered tab's module
    // is off but the other is on, show the one that is on.
    React.useEffect(() => {
      if (!modules || modules[tab] === true) return
      const other = tabs.find(id => modules[id] === true)
      if (other !== undefined) setTab(other)
    }, [modules, tab])
    const toggle = async (id, enabled) => {
      if (busy || !modules) return
      setBusy(true); setError('')
      try { setModules(await request('POST', { ...modules, [id]: enabled })) }
      catch (e) { setError(e.message) }
      finally { setBusy(false) }
    }
    const tabs = ['skill', 'subagent']
    const label = id => id === 'skill' ? 'Skill' : 'Subagent'
    const focusTab = id => document.getElementById('team-tab-' + id)?.focus()
    return h('div', { className: 'tm_shell', 'aria-busy': busy },
      h('h2', { className: 'tm_shell_title' }, 'TeamManeger'),
      h('p', { className: 'tm_shell_sub' },
        text('Skill 与会话里的 Subagent 都在本机文件里定义，这里统一管理。关闭模块只是隐藏入口，不会删除或停用已有定义。',
          'Skills and session subagents are both defined in local files; this page manages them together. Turning a module off only hides its tab — nothing is deleted and no existing definition is disabled.')),
      h('div', { className: 'tm_modules' }, tabs.map(id => h('label', {
        key: id, className: `tm_switch${modules && modules[id] !== true ? ' tm_switch_off' : ''}`,
      },
        h('input', {
          type: 'checkbox', role: 'switch', checked: modules?.[id] === true, disabled: busy || !modules,
          onChange: e => toggle(id, e.target.checked),
        }),
        text('启用 ', 'Enable ') + label(id)))),
      busy ? h('div', { className: 'tm_hint', role: 'status' }, text('正在应用模块配置…', 'Applying module configuration…')) : null,
      error !== '' ? h('div', { className: 'tm_note tm_note_error', role: 'alert' },
        h('b', null, text('读不到模块配置', 'Cannot read module configuration')),
        error,
        !modules ? h('div', { style: { marginTop: 8 } },
          h('button', {
            type: 'button', className: 'tm_btn',
            onClick: () => { setError(''); request('GET').then(setModules).catch(e => setError(e.message)) },
          }, text('重试', 'Retry'))) : null) : null,
      !modules && error === '' ? h('div', { className: 'tm_hint', role: 'status' }, text('正在读取模块配置…', 'Loading module configuration…')) : null,
      h('div', { className: 'tm_tabs', role: 'tablist', 'aria-label': 'TeamManeger' }, tabs.map((id, index) => h('button', {
        key: id, id: 'team-tab-' + id, role: 'tab', type: 'button',
        className: 'tm_tab',
        'aria-selected': tab === id, 'aria-controls': 'team-panel-' + id, tabIndex: tab === id ? 0 : -1,
        disabled: modules !== null && modules[id] !== true,
        onClick: () => setTab(id),
        onKeyDown: e => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
          e.preventDefault()
          const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
          setTab(next); focusTab(next)
        },
      }, label(id)))),
      tabs.map(id => h('div', {
        key: id, role: 'tabpanel', id: 'team-panel-' + id, 'aria-labelledby': 'team-tab-' + id,
        hidden: tab !== id,
      },
        modules?.[id]
          ? h(id === 'skill' ? skill.Page : subagent.Page, { locale })
          : modules
            ? h('div', { className: 'tm_offline' },
                text('这个模块当前关闭，页面内容已隐藏。上面的开关可以重新启用，配置与文件都还在。',
                  'This module is off, so its page is hidden. Re-enable it with the switch above; its configuration and files are untouched.'))
            : null)))
  }
  return { name: 'dsh-team-manager', inject: ['slots', 'locale'], apply(ctx) {
    try {
      if (typeof skill.Page !== 'function' || typeof subagent.Page !== 'function' || typeof ctx.slots?.inject !== 'function' || typeof ctx.slots?.register !== 'function') throw new Error('Incompatible TeamManeger client interfaces')
      skill.apply(ctx)
      subagent.apply(ctx)
      recycle.apply(ctx, { enabled: () => recycle.store.trashSnapshot().enabled === true })
      // The two pages register dictionaries only; the stylesheet is installed
      // once here so the shell and both pages share one <style> element.
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-team-manager')
        style.textContent = UI_CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-team-manager: styles')
      ctx.slots.inject('settings.section', () => {
        try { return ctx.slots.register({ name: 'settings.section', id: 'dsh-team-manager', order: 36, label: 'TeamManeger' }, props => h(CompatibilityBoundary, null, h(TeamPage, { ...props, locale: ctx.locale }))) }
        catch (error) { reportConflict(); throw error }
      })
    } catch (error) { reportConflict(); throw error }
  }, __test__: { TeamPage, skill, subagent } }
  }
})
