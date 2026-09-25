import { execSync } from 'node:child_process'

const repoRoot = process.cwd()
const intervalMs = Number(process.env.AUTO_SYNC_INTERVAL_MS ?? '15000')
const runOnce = process.argv.includes('--once')

const runGit = (command) => {
  try {
    return execSync(command, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr || '')
        : String(error)

    if (message) {
      console.error(message.trim())
    }
    throw error
  }
}

const ensureGitIdentity = () => {
  try {
    runGit('git config user.name')
  } catch {
    runGit('git config user.name "GitHub Copilot"')
  }

  try {
    runGit('git config user.email')
  } catch {
    runGit('git config user.email "copilot@github.local"')
  }
}

const syncOnce = () => {
  const status = runGit('git status --porcelain')

  if (!status.trim()) {
    return false
  }

  try {
    runGit('git add -A')
    runGit(
      `git commit -m "Auto-update ${new Date().toISOString().replace(/[:.]/g, '-') }"`,
    )
    runGit('git push origin HEAD')
    console.log('Auto-sync committed and pushed successfully.')
    return true
  } catch (error) {
    console.error('Auto-sync failed, will retry on the next interval.')
    console.error(error)
    return false
  }
}

ensureGitIdentity()

if (runOnce) {
  syncOnce()
  process.exit(0)
}

console.log(`Auto-sync watcher started. Interval: ${intervalMs}ms`)

const poll = () => {
  try {
    syncOnce()
  } catch {
    // ignored; next loop will retry
  }
}

poll()
setInterval(poll, intervalMs)
