import { useState, useEffect } from 'react'
import { FolderOpen, Folder, FileText, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { fetchFileTree, fetchFile, type FileEntry, type FileContent } from '@/lib/api'

function formatSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface TreeNodeProps {
  entry: FileEntry
  depth: number
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  onSelect: (entry: FileEntry) => void
}

function TreeNode({ entry, depth, selectedPath, expandedPaths, onToggle, onSelect }: TreeNodeProps) {
  const isExpanded = expandedPaths.has(entry.path)
  const isSelected = selectedPath === entry.path
  const isDirectory = entry.type === 'directory'
  
  const handleClick = () => {
    if (isDirectory) {
      onToggle(entry.path)
    } else {
      onSelect(entry)
    }
  }
  
  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-container-low/50 transition-colors ${
          isSelected ? 'bg-primary/10 text-primary' : 'text-on-surface'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
      >
        {isDirectory && (
          <span className="text-on-surface-variant/50">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}
        <span className={isSelected ? 'text-primary' : 'text-on-surface-variant/50'}>
          {isDirectory ? (
            isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />
          ) : (
            <FileText size={16} />
          )}
        </span>
        <span className="text-sm truncate flex-1">{entry.name}</span>
        {entry.size !== undefined && !isDirectory && (
          <span className="text-xs text-on-surface-variant/50">{formatSize(entry.size)}</span>
        )}
      </div>
      {isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FilesScreen() {
  const [tree, setTree] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    loadTree()
  }, [])

  const loadTree = async () => {
    setLoading(true)
    try {
      const result = await fetchFileTree()
      setTree(result.tree)
      // Expand root directories by default
      if (result.tree.length > 0) {
        setExpandedPaths(new Set(result.tree.map(d => d.path)))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const handleSelect = async (entry: FileEntry) => {
    if (entry.type !== 'file') return
    setSelectedPath(entry.path)
    setLoadingFile(true)
    try {
      const content = await fetchFile(entry.path)
      setSelectedFile(content)
    } finally {
      setLoadingFile(false)
    }
  }

  const lines = selectedFile?.content ? selectedFile.content.split('\n') : []

  return (
    <div className="flex h-full bg-surface-container-lowest">
      <div className="w-80 flex flex-col border-r border-outline-variant/20 bg-surface-container-low">
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
          <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50">
            Files
          </span>
          <button
            onClick={loadTree}
            className="text-on-surface-variant/50 hover:text-on-surface transition-colors"
            disabled={loading}
          >
            <Loader2 size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-on-surface-variant/50">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : tree && tree.length > 0 ? (
            tree.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            ))
          ) : (
            <div className="px-4 py-8 text-center text-on-surface-variant/50 text-sm">
              No files found
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-outline-variant/20 text-xs text-on-surface-variant/50">
          ~/.hermes/
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-surface-container-lowest">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 bg-surface-container-low">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <span className="text-sm font-medium text-on-surface">{selectedFile.name}</span>
                <span className="text-xs text-on-surface-variant/50">
                  {formatSize(selectedFile.size)}
                </span>
              </div>
              <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50">
                {selectedFile.type}
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-on-surface-variant/50">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <div className="flex font-mono text-sm">
                  <div className="select-none text-right pr-4 text-on-surface-variant/50 border-r border-outline-variant/20 mr-4">
                    {lines.map((_, i) => (
                      <div key={i} className="leading-6">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 text-on-surface">
                    {lines.map((line, i) => (
                      <div key={i} className="leading-6 whitespace-pre">
                        {line || ' '}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/50">
            <FileText size={48} className="mb-4 opacity-20" />
            <span className="text-sm">Select a file to view its contents</span>
          </div>
        )}
      </div>
    </div>
  )
}