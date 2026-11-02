/**
 * Keep verification runs from littering the session list.
 *
 * Every capture script opens the web UI in a brand-new browser profile, and the
 * shell starts a session for that visitor. The script never writes a message,
 * so the run leaves a "未命名" row behind — one per run, which is how a morning
 * of CSS work turned into sixty of them.
 *
 * This guard takes a snapshot before the browser opens and moves whatever
 * appeared since — but only if it still has zero messages — into
 * `~/.dsh/sessions-trash/<stamp>/verify/`, then drops the id from the
 * workspace's list. Empty and new is the whole test: a session the script
 * actually typed into is never touched, and neither is anything that existed
 * before the run.
 *
 *   const guard = startSessionGuard()
 *   …drive the page…
 *   await guard.release()
 *
 * `release()` is best-effort and never throws: a cleanup that fails must not
 * turn a passing run into a failing one.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HOME = process.env.HOME
const SESSIONS = join(HOME, '.dsh/sessions')
const CACHE = join(HOME, '.dsh/storages/session_projcache/sessions')
const STORE = join(HOME, '.dsh/storages/workspace.json')
const TRASH = join(HOME, '.dsh/sessions-trash')

/** Every stored session id, keyed to the directory that holds it. */
function scan() {
  const found = new Map()
  for (const workspace of readdirSync(SESSIONS)) {
    const wsDir = join(SESSIONS, workspace)
    if (!statSync(wsDir).isDirectory()) continue
    for (const name of readdirSync(wsDir)) {
      if (!name.startsWith('session-')) continue
      found.set(name, { workspace, dir: join(wsDir, name) })
    }
  }
  return found
}

/** Whether a session file carries any message at all. */
function hasMessages(dir) {
  const file = join(dir, 'session.v4.jsonl.zstd')
  if (!existsSync(file)) return true
  try {
    const text = execFileSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 1 << 26 })
    for (const line of text.split('\n')) {
      if (line === '') continue
      const ev = JSON.parse(line)
      if (ev.type === 'message' || ev.type === 'user/message' || ev.type === 'assistant/message') return true
    }
    return false
  } catch {
    return true
  }
}

/**
 * Snapshot the store, then hand back the cleanup for this run.
 * @returns `release()`, which resolves to the number of sessions moved out.
 */
export function startSessionGuard() {
  const before = new Set(scan().keys())
  let released = false

  return {
    async release() {
      if (released) return 0
      released = true
      try {
        const after = scan()
        const added = [...after.entries()].filter(([id]) => !before.has(id))
        const empty = added.filter(([, entry]) => !hasMessages(entry.dir))
        if (empty.length === 0) return 0

        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const trashDir = join(TRASH, stamp, 'verify')
        for (const [id, entry] of empty) {
          mkdirSync(join(trashDir, entry.workspace), { recursive: true })
          renameSync(entry.dir, join(trashDir, entry.workspace, id))
          const cached = join(CACHE, `${id}.json`)
          if (existsSync(cached)) {
            mkdirSync(join(trashDir, '.projcache'), { recursive: true })
            renameSync(cached, join(trashDir, '.projcache', `${id}.json`))
          }
        }

        // The workspace store keeps its own list; an id whose directory is gone
        // would come back as a row that cannot open.
        const gone = new Set(empty.map(([id]) => id))
        const store = JSON.parse(readFileSync(STORE, 'utf8'))
        store.global.archivedSessionIds = (store.global.archivedSessionIds ?? []).filter(id => !gone.has(id))
        for (const workspace of Object.values(store.tables.workspaces)) {
          workspace.sessionIds = workspace.sessionIds.filter(id => !gone.has(id))
        }
        writeFileSync(STORE, JSON.stringify(store, null, 2) + '\n')
        return empty.length
      } catch (error) {
        console.warn('session guard: could not clean up this run —', String(error))
        return 0
      }
    },
  }
}
