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
