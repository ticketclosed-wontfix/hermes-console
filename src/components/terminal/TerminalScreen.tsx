import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export default function TerminalScreen() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  const connect = () => {
    setStatus('connecting')
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      if (terminalInstanceRef.current && fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
    }

    ws.onerror = () => {
      setStatus('disconnected')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'output' && terminalInstanceRef.current) {
          terminalInstanceRef.current.write(message.data)
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    }
  }

  useEffect(() => {
    if (!terminalRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#0d0d0d',
        foreground: '#e0e0e0',
        cursor: '#d4a574',
        selectionBackground: 'rgba(212, 165, 116, 0.3)'
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true
    })

    terminalInstanceRef.current = terminal

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    terminal.loadAddon(fitAddon)

    terminal.open(terminalRef.current)
    fitAddon.fit()

    terminal.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const handleResize = () => {
      if (fitAddonRef.current && terminalInstanceRef.current) {
        fitAddonRef.current.fit()
        const { cols, rows } = terminalInstanceRef.current
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
        }
      }
    }

    window.addEventListener('resize', handleResize)

    connect()

    return () => {
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
      wsRef.current?.close()
    }
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-amber-500'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest border border-outline-variant/20 rounded overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="flex items-center gap-2">
          <span className="font-label text-[9px] tracking-widest uppercase text-on-surface">
            TERMINAL
          </span>
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </div>
        {status === 'disconnected' && (
          <button
            onClick={connect}
            className="font-label text-[9px] tracking-widest uppercase text-primary hover:opacity-80 transition-opacity"
          >
            Reconnect
          </button>
        )}
      </div>
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  )
}