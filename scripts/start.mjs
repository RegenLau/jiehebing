import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const preview = process.argv.includes('--preview')
const children = new Set()
let stopping = false

async function checkPort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`端口 ${port} 已被占用，请先关闭占用该端口的服务。`)))
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) child.kill('SIGTERM')
  const timeout = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
  }, 5000)
  timeout.unref()
}

function start(args, cwd = root) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' })
  children.add(child)
  child.once('error', (error) => { console.error(error.message); stop(1) })
  child.once('exit', (code) => {
    children.delete(child)
    if (!stopping) stop(code || 1)
  })
  return child
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

try {
  await Promise.all([checkPort(3006), checkPort(3010)])
  start(['mock-api/server.mjs'])
  let ready = false
  for (let attempt = 0; attempt < 50 && !stopping; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3010/health', { signal: AbortSignal.timeout(500) })
      if (response.ok) { ready = true; break }
    } catch { /* Mock 正在启动。 */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!ready) throw new Error('本地 Mock 未能启动，请查看上方错误。')
  start(['node_modules/vite/bin/vite.js', ...(preview ? ['preview'] : []), '--mode', 'mock'], `${root}frontend`)
  console.log(`结核随访模拟环境：http://127.0.0.1:3006（${preview ? '构建预览' : '开发'}）`)
} catch (error) {
  console.error(error.message)
  stop(1)
}
