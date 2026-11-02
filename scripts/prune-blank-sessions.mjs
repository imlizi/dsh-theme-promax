#!/usr/bin/env node
/**
 * Move empty sessions out of the store.
 *
 *   node scripts/prune-blank-sessions.mjs            # dry run: what would move
 *   node scripts/prune-blank-sessions.mjs --apply    # move them to the trash
 *
 * A session that never received a message is a press of "new conversation"
 * that was never used — usually a verification run: each script opens the web
 * UI in a fresh browser profile, the shell starts a session for it, and the
 * script exits without writing a word. They pile up as "未命名" rows.
 *
 * Nothing is deleted: a session's directory and its projection cache move to
 * `~/.dsh/sessions-trash/<stamp>/` with their workspace path intact, and the
 * workspace's own list drops the id. Rescuing one is a `mv` back, plus the id
 * in `workspace.json`. The DSH app must be closed while this runs — it holds
 * the workspace store in memory and would write the old list back on exit.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const HOME = process.env.HOME
const SESSIONS = join(HOME, '.dsh/sessions')
const CACHE = join(HOME, '.dsh/storages/session_projcache/sessions')
const STORE = join(HOME, '.dsh/storages/workspace.json')
const TRASH = join(HOME, '.dsh/sessions-trash')
const apply = process.argv.includes('--apply')

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const store = JSON.parse(readFileSync(STORE, 'utf8'))

/** Events in a session file, plus whether any of them carries a message. */
function readSession(file) {
  const text = execFileSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 1 << 28 })
  let created = null
  let messages = 0
  for (const line of text.split('\n').filter(Boolean)) {
    try {
      const ev = JSON.parse(line)
      if (ev.type === 'session') created = ev.createdAt
      if (ev.type === 'message' || ev.type === 'user/message' || ev.type === 'assistant/message') messages += 1
    } catch { /* a torn last line is not a message */ }
  }
  return { created, messages, bytes: text.length }
}

const blanks = []
const kept = []
for (const workspace of readdirSync(SESSIONS)) {
  const wsDir = join(SESSIONS, workspace)
  if (!statSync(wsDir).isDirectory()) continue
  for (const name of readdirSync(wsDir)) {
    if (!name.startsWith('session-')) continue
    const dir = join(wsDir, name)
    const file = join(dir, 'session.v4.jsonl.zstd')
    if (!existsSync(file)) continue
    const info = readSession(file)
    const row = { name, workspace, dir, file, ...info }
    if (info.messages === 0) blanks.push(row)
    else kept.push(row)
  }
}

blanks.sort((a, b) => (a.created ?? 0) - (b.created ?? 0))
const when = t => t === null ? '?' : new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
console.log(`${apply ? 'MOVING' : 'WOULD MOVE'} ${blanks.length} empty session(s); keeping ${kept.length} with messages.`)
for (const row of blanks) console.log(`  ${when(row.created)}  ${String(row.bytes).padStart(6)}B  ${row.dir}`)
console.log('keeping:')
for (const row of kept) console.log(`  ${when(row.created)}  ${String(row.messages).padStart(3)}msg  ${row.name}`)

if (!apply) {
  console.log('\ndry run — pass --apply to move them')
  process.exit(0)
}
if (kept.length + blanks.length === 0) process.exit(0)

// The workspace store is edited, so it is copied first; an app that writes it
// while this runs would still win, which is why the app has to be closed.
writeFileSync(`${STORE}.bak-${stamp}`, JSON.stringify(store, null, 2) + '\n')

const trashDir = join(TRASH, stamp)
let moved = 0
for (const row of blanks) {
  const target = join(trashDir, row.workspace, row.name)
  mkdirSync(join(trashDir, row.workspace), { recursive: true })
  renameSync(row.dir, target)
  const cached = join(CACHE, `${row.name}.json`)
  if (existsSync(cached)) {
    mkdirSync(join(trashDir, '.projcache'), { recursive: true })
    renameSync(cached, join(trashDir, '.projcache', `${row.name}.json`))
  }
  moved += 1
}

const gone = new Set(blanks.map(row => row.name))
store.global.archivedSessionIds = (store.global.archivedSessionIds ?? []).filter(id => !gone.has(id))
for (const workspace of Object.values(store.tables.workspaces)) {
  workspace.sessionIds = workspace.sessionIds.filter(id => !gone.has(id))
}
writeFileSync(STORE, JSON.stringify(store, null, 2) + '\n')

console.log(`\nmoved ${moved} to ${trashDir}`)
console.log(`workspace store rewritten (backup: ${STORE}.bak-${stamp})`)
