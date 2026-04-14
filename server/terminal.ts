import { WebSocketServer, WebSocket } from 'ws'
import * as pty from 'node-pty'
import type { Server } from 'http'

export function attachTerminalWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/terminal' })

  wss.on('connection', (ws: WebSocket) => {
    const shell = process.env.SHELL || '/bin/bash'
    const term = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.env.HOME || '/home',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      } as Record<string, string>,
    })

    // PTY -> WebSocket
    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }))
      }
    })

    term.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
        ws.close()
      }
    })

    // WebSocket -> PTY
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        switch (msg.type) {
          case 'input':
            term.write(msg.data)
            break
          case 'resize':
            if (msg.cols && msg.rows) {
              term.resize(msg.cols, msg.rows)
            }
            break
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.on('close', () => {
      term.kill()
    })

    ws.on('error', () => {
      term.kill()
    })
  })

  return wss
}
