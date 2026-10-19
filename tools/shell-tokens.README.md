# shell-tokens.css

A verbatim copy of the theme sheet the DSH shell ships: the `body{--dsw-alias-*}`
block and its `body[data-ds-dark-theme]` override, extracted from the installed
`app.asar`.

It exists so checks can render against the shell's *real* token names and values
instead of a hand-written list that could drift. Refresh it when the shell's
theme changes; nothing at runtime reads this file.

Why it matters: the shell defines these tokens on `body`, not `:root`. A plugin
that aliases them on `:root` resolves nothing and silently loses every border,
surface and colour. See `design-system-check.mjs`.
