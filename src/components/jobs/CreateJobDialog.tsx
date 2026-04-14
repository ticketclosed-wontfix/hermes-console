import { useState } from 'react'
import { X } from 'lucide-react'
import { createJob } from '@/lib/api'

type Props = {
  onClose: () => void
  onCreated: () => void
}

export default function CreateJobDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [prompt, setPrompt] = useState('')
  const [skills, setSkills] = useState('')
  const [deliver, setDeliver] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!schedule.trim() || !prompt.trim()) {
      setError('Schedule and prompt are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createJob({
        name: name.trim() || 'Untitled Job',
        schedule: schedule.trim(),
        prompt: prompt.trim(),
        skills: skills.trim() ? skills.split(',').map((s) => s.trim()) : undefined,
        deliver: deliver.trim() || undefined,
      })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-container-low border border-outline-variant/20 rounded-xl w-full max-w-lg mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
          <h2 className="font-headline font-bold text-sm text-on-surface">New Job</h2>
          <button onClick={onClose} className="text-on-surface-variant/50 hover:text-on-surface">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Field label="Name" value={name} onChange={setName} placeholder="My cron job" />
          <Field label="Schedule *" value={schedule} onChange={setSchedule} placeholder="0 9 * * * or every 2h or 30m" />
          <div>
            <label className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50 block mb-1">
              Prompt *
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do?"
              rows={4}
              className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 font-label text-xs px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          </div>
          <Field label="Skills" value={skills} onChange={setSkills} placeholder="skill1, skill2 (comma-separated)" />
          <Field label="Deliver" value={deliver} onChange={setDeliver} placeholder="telegram:chat_id:thread_id" />

          {error && (
            <div className="text-error text-xs font-label bg-error/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-outline-variant/15">
          <button
            onClick={onClose}
            className="font-label text-[10px] tracking-widest uppercase px-4 py-2 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="font-label text-[10px] tracking-widest uppercase px-4 py-2 rounded-md bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50 block mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 font-label text-xs px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  )
}
