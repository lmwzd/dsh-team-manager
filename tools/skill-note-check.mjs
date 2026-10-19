/**
 * Notes are the user's own one-liner about a skill, kept OUTSIDE the skill:
 * `<skills-dir>/.dsh-team-manager/notes.json`. The whole point is that editing a
 * note can never touch SKILL.md — not its bytes, not its frontmatter, not its
 * body — so a note survives editing, re-importing, disabling and re-enabling the
 * skill itself.
 *
 * This checks that promise directly: it hashes SKILL.md before and after.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  deleteSkill,
  listSkills,
  noteStatePath,
  readNotes,
  setSkillEnabled,
  setSkillNote,
  writeNotes,
  NOTE_MAX,
} from '../lib/skill/skills.js'

const root = mkdtempSync(join(tmpdir(), 'skill-notes-'))
const dir = join(root, 'skills')
const skillDir = join(dir, 'alpha')
mkdirSync(skillDir, { recursive: true })

const SKILL_MD = `---
name: alpha
description: Alpha skill. Use when testing notes.
---

# Alpha

Body that must never change because of a note.
`
const skillPath = join(skillDir, 'SKILL.md')
writeFileSync(skillPath, SKILL_MD, 'utf8')

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const originalBytes = digest(skillPath)
const originalText = readFileSync(skillPath, 'utf8')

try {
  // ── No note yet ──────────────────────────────────────────────────────────
  assert.deepEqual([...readNotes(dir).keys()], [], 'a fresh skills dir has no notes')
  const before = listSkills(dir)
  assert.equal(before.skills.length, 1, 'the skill is listed')

  // ── Set a note ───────────────────────────────────────────────────────────
  const saved = setSkillNote(dir, 'alpha', '  我的第一条备注  ')
  assert.equal(saved, '我的第一条备注', 'the note is trimmed before it is stored')
  assert.equal(digest(skillPath), originalBytes, 'SKILL.md is byte-identical after setting a note')
  assert.equal(readFileSync(skillPath, 'utf8'), originalText, 'SKILL.md text is unchanged')
  assert.equal(readNotes(dir).get('alpha'), '我的第一条备注', 'the note reads back')
  assert.ok(existsSync(noteStatePath(dir)), 'the note lives in the sidecar file')
  assert.ok(noteStatePath(dir).includes('.dsh-team-manager'), 'the sidecar sits under .dsh-team-manager')
  const stored = JSON.parse(readFileSync(noteStatePath(dir), 'utf8'))
  assert.deepEqual(stored.notes, { alpha: '我的第一条备注' }, 'the sidecar holds a name -> note map')

  // ── Update and clear ─────────────────────────────────────────────────────
  setSkillNote(dir, 'alpha', '改过一次')
  assert.equal(readNotes(dir).get('alpha'), '改过一次', 'a note can be replaced')
  assert.equal(digest(skillPath), originalBytes, 'SKILL.md is still untouched by the edit')

  setSkillNote(dir, 'alpha', '')
  assert.equal(readNotes(dir).has('alpha'), false, 'an empty note clears the entry')
  assert.deepEqual(JSON.parse(readFileSync(noteStatePath(dir), 'utf8')).notes, {}, 'the sidecar drops empty notes')
  assert.equal(digest(skillPath), originalBytes, 'SKILL.md survives clearing the note')

  // ── Length is bounded, not free text ─────────────────────────────────────
  const long = 'x'.repeat(NOTE_MAX + 80)
  const clipped = setSkillNote(dir, 'alpha', long)
  assert.equal(clipped.length, NOTE_MAX, `a note is clipped to ${NOTE_MAX} characters`)
  assert.ok(clipped.endsWith('…'), 'a clipped note is marked with an ellipsis')

  // ── Newlines collapse to one line ────────────────────────────────────────
  setSkillNote(dir, 'alpha', 'first line\nsecond   line')
  assert.equal(readNotes(dir).get('alpha'), 'first line second line', 'a multi-line note becomes one line')

  // ── Disabling / enabling does not disturb the note ───────────────────────
  setSkillNote(dir, 'alpha', '停用期间的备注')
  setSkillEnabled(dir, 'alpha', false)
  assert.ok(!existsSync(skillPath), 'disabling renames SKILL.md')
  assert.equal(readNotes(dir).get('alpha'), '停用期间的备注', 'the note survives disabling')
  setSkillEnabled(dir, 'alpha', true)
  assert.equal(readFileSync(skillPath, 'utf8'), originalText, 're-enabling restores the same bytes')
  assert.equal(readNotes(dir).get('alpha'), '停用期间的备注', 'the note survives re-enabling')

  // ── Unknown skill is refused, so there are no orphan notes ───────────────
  assert.throws(() => setSkillNote(dir, 'nope', 'x'), /unknown skill/i, 'a note needs a real skill')

  // ── Corrupt sidecar degrades to "no notes" ───────────────────────────────
  writeFileSync(noteStatePath(dir), '{ this is not json', 'utf8')
  assert.deepEqual([...readNotes(dir).keys()], [], 'a corrupt notes file reads as empty instead of throwing')
  assert.equal(listSkills(dir).skills.length, 1, 'and the skill list still works')

  // ── Illegal names in the file are ignored ────────────────────────────────
  writeNotes(dir, new Map([['..', 'escape'], ['ok-name', 'fine'], ['has space', 'no']]))
  const sane = readNotes(dir)
  assert.equal(sane.has('..'), false, 'path-like names are rejected')
  assert.equal(sane.has('has space'), false, 'names with spaces are rejected')
  assert.equal(sane.get('ok-name'), 'fine', 'valid names are kept')

  // ── Delete removes the note with the skill ───────────────────────────────
  writeFileSync(skillPath, SKILL_MD, 'utf8')
  setSkillNote(dir, 'alpha', '将被删除')
  deleteSkill(dir, 'alpha')
  assert.equal(readNotes(dir).has('alpha'), false, 'deleting a skill drops its note')

  console.log('PASS: notes live beside the skill, never inside it (SKILL.md bytes unchanged throughout)')
} finally {
  rmSync(root, { recursive: true, force: true })
}
