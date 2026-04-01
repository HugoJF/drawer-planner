import { createStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { useStore } from 'zustand'
import type { ProjectMeta, ProjectData } from '@/lib/types'
import { DEFAULT_CONFIG } from '@/lib/types'
import { drawerStore } from '@/lib/store'
import { generateId } from '@/lib/gridfinity'

// ---- Plain localStorage helpers (not Zustand state) ----

export function getProjectData(id: string): ProjectData | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(`gdp-project-${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ProjectData
  } catch {
    return null
  }
}

export function saveProjectData(id: string, data: ProjectData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(`gdp-project-${id}`, JSON.stringify(data))
}

function removeProjectData(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`gdp-project-${id}`)
}

const EMPTY_PROJECT_DATA: ProjectData = {
  config: DEFAULT_CONFIG,
  drawers: [],
  items: [],
  categories: [],
}

// ---- Store ----

interface ProjectsStore {
  activeProjectId: string | null
  projects: ProjectMeta[]

  createProject: (name: string, data?: ProjectData) => string
  switchProject: (id: string) => void
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  upsertProjectMeta: (meta: ProjectMeta) => void
}

// Prevents the subscriber from firing during project switches
let _isSwitching = false

function makeEmptyMeta(id: string, name: string): ProjectMeta {
  const now = new Date().toISOString()
  return { id, name, createdAt: now, updatedAt: now, drawerCount: 0, itemCount: 0 }
}

const projectsStoreInstance = createStore<ProjectsStore>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      projects: [],

      createProject: (name, data = EMPTY_PROJECT_DATA) => {
        const id = generateId()
        const meta = makeEmptyMeta(id, name)
        saveProjectData(id, data)
        set((s) => ({ projects: [...s.projects, meta], activeProjectId: id }))
        _isSwitching = true
        try {
          drawerStore.getState().loadProject(data)
        } finally {
          _isSwitching = false
        }
        // Update counts from actual data after load
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, drawerCount: data.drawers.length, itemCount: data.items.length }
              : p
          ),
        }))
        return id
      },

      switchProject: (id) => {
        const { activeProjectId } = get()
        if (id === activeProjectId) return
        _isSwitching = true
        try {
          // Save current project before switching
          if (activeProjectId) {
            const { drawers, items, config, categories } = drawerStore.getState()
            saveProjectData(activeProjectId, { drawers, items, config, categories })
          }
          // Update active ID before loadProject so the subscriber routes correctly
          set({ activeProjectId: id })
          const data = getProjectData(id) ?? EMPTY_PROJECT_DATA
          drawerStore.getState().loadProject(data)
        } finally {
          _isSwitching = false
        }
      },

      deleteProject: (id) => {
        const { projects, activeProjectId } = get()
        removeProjectData(id)
        const remaining = projects.filter((p) => p.id !== id)
        set({ projects: remaining })
        if (activeProjectId === id) {
          if (remaining.length > 0) {
            get().switchProject(remaining[0].id)
          } else {
            set({ activeProjectId: null })
            _isSwitching = true
            try {
              drawerStore.getState().loadProject(EMPTY_PROJECT_DATA)
            } finally {
              _isSwitching = false
            }
          }
        }
      },

      renameProject: (id, name) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
          ),
        }))
      },

      upsertProjectMeta: (meta) => {
        set((s) => {
          const exists = s.projects.some((p) => p.id === meta.id)
          return {
            projects: exists
              ? s.projects.map((p) => (p.id === meta.id ? meta : p))
              : [...s.projects, meta],
          }
        })
      },
    }),
    {
      name: 'gdp-projects-meta',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Migration: if no projects exist, attempt to load from the old single-project key
        if (state.projects.length === 0 && typeof window !== 'undefined') {
          const raw = localStorage.getItem('gridfinity-drawer-planner')
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              const stored = parsed?.state
              if (stored && (stored.drawers?.length > 0 || stored.items?.length > 0)) {
                const id = generateId()
                const data: ProjectData = {
                  config: stored.config ?? DEFAULT_CONFIG,
                  drawers: stored.drawers ?? [],
                  items: stored.items ?? [],
                  categories: stored.categories ?? [],
                }
                saveProjectData(id, data)
                const now = new Date().toISOString()
                state.projects = [{
                  id,
                  name: 'My Project',
                  createdAt: now,
                  updatedAt: now,
                  drawerCount: data.drawers.length,
                  itemCount: data.items.length,
                }]
                state.activeProjectId = id
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      },
    }
  )
)

// ---- Module-level sync subscriber ----
// Fires on every drawer store mutation; skipped during project switches
drawerStore.subscribe((state, prev) => {
  if (_isSwitching) return
  if (
    state.drawers === prev.drawers &&
    state.items === prev.items &&
    state.config === prev.config &&
    state.categories === prev.categories
  ) return

  const { activeProjectId, projects } = projectsStoreInstance.getState()
  if (!activeProjectId) return

  saveProjectData(activeProjectId, {
    config: state.config,
    drawers: state.drawers,
    items: state.items,
    categories: state.categories,
  })

  const existing = projects.find((p) => p.id === activeProjectId)
  if (existing) {
    projectsStoreInstance.getState().upsertProjectMeta({
      ...existing,
      drawerCount: state.drawers.length,
      itemCount: state.items.length,
      updatedAt: new Date().toISOString(),
    })
  }
})

export function useProjectsStore<T>(selector: (s: ProjectsStore) => T): T {
  return useStore(projectsStoreInstance, selector)
}

export { projectsStoreInstance as projectsStoreApi }
