import { useEffect, useState, useMemo } from 'react'
import {
  Puzzle,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Folder,
  ArrowLeft,
} from 'lucide-react'
import { fetchSkills, fetchSkill, type SkillSummary } from '@/lib/api'

export default function SkillsScreen() {
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<(SkillSummary & { content: string }) | null>(null)
  const [loadingSkill, setLoadingSkill] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const loadSkills = async () => {
    setLoading(true)
    try {
      const result = await fetchSkills()
      setSkills(result.skills)
      setCategories(result.categories)
      // Expand all categories by default
      setExpandedCategories(new Set(result.categories))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return skills
    const q = search.toLowerCase()
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q),
    )
  }, [skills, search])

  const grouped = useMemo(() => {
    const groups: Record<string, SkillSummary[]> = { uncategorized: [] }
    for (const cat of categories) groups[cat] = []
    for (const skill of filtered) {
      const cat = skill.category || 'uncategorized'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(skill)
    }
    return Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, categories])

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const openSkill = async (name: string) => {
    setLoadingSkill(true)
    try {
      const data = await fetchSkill(name)
      setSelectedSkill(data)
    } finally {
      setLoadingSkill(false)
    }
  }

  if (selectedSkill) {
    return (
      <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
        <div className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 gap-3 shrink-0">
          <button
            onClick={() => setSelectedSkill(null)}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant/50 hover:text-on-surface"
          >
            <ArrowLeft size={16} />
          </button>
          <Puzzle size={16} className="text-primary" />
          <h1 className="font-headline font-bold text-sm tracking-tight text-on-surface">
            {selectedSkill.name}
          </h1>
          {selectedSkill.category && (
            <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/40 bg-surface-container-high px-1.5 py-0.5 rounded">
              {selectedSkill.category}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          <pre className="text-sm text-on-surface/80 font-label leading-relaxed whitespace-pre-wrap break-words">
            {loadingSkill ? 'Loading...' : selectedSkill.content}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
      {/* Header */}
      <div className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Puzzle size={16} className="text-primary" />
          <h1 className="font-headline font-bold text-sm tracking-tight text-on-surface">
            Skills
          </h1>
          <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/40">
            ({skills.length})
          </span>
        </div>
        <button
          onClick={loadSkills}
          className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant/50 hover:text-on-surface"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-2 border-b border-outline-variant/15">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH SKILLS"
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase pl-7 pr-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-3 space-y-1">
        {loading && skills.length === 0 && (
          <div className="flex items-center justify-center py-12 text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase">
            Loading skills...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant/40">
            <Puzzle size={32} className="mb-3 opacity-40" />
            <span className="font-label text-xs tracking-widest uppercase">
              No skills found
            </span>
          </div>
        )}
        {grouped.map(([category, items]) => (
          <div key={category}>
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-surface-container-high rounded-md transition-colors"
            >
              {expandedCategories.has(category) ? (
                <ChevronDown size={12} className="text-on-surface-variant/50" />
              ) : (
                <ChevronRight size={12} className="text-on-surface-variant/50" />
              )}
              <Folder size={12} className="text-primary/60" />
              <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant/60">
                {category}
              </span>
              <span className="font-label text-[9px] text-on-surface-variant/30 ml-auto">
                {items.length}
              </span>
            </button>
            {expandedCategories.has(category) && (
              <div className="ml-6 space-y-0.5">
                {items.map((skill) => (
                  <button
                    key={skill.name}
                    onClick={() => openSkill(skill.name)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-surface-container-high transition-colors group"
                  >
                    <div className="text-xs font-medium text-on-surface group-hover:text-primary transition-colors">
                      {skill.name}
                    </div>
                    <div className="text-[10px] text-on-surface-variant/40 line-clamp-1 mt-0.5">
                      {skill.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
