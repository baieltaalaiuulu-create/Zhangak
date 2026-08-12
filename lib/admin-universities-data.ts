import { supabase } from '@/lib/supabase'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

// Admin CRUD for the universities catalog (/admin/universities and
// /admin/universities/[id]/specialties). Kept in its own file rather than
// growing lib/admin-data.ts further — reads go straight through the
// anon-key client (RLS disabled on all three tables, same convention as
// practice_tests/questions/practice_lessons/announcements), writes go
// through /api/admin/universities and /api/admin/university-specialties
// with the service role.

export interface AdminUniversity {
  id: string
  name: string
  city: string
  type: 'government' | 'private'
  description: string | null
  logo_url: string | null
  website_url: string | null
  min_score: number | null
  avg_score: number | null
  tuition_min: number | null
  tuition_max: number | null
  dormitory: boolean
  budget_places: boolean
  rating: number | null
  languages: string[]
  total_specialties: number | null
  is_active: boolean
  created_at: string
}

export async function fetchAdminUniversities(): Promise<AdminUniversity[]> {
  const { data } = await supabase.from('universities').select('*').order('created_at', { ascending: false })
  return (data ?? []) as AdminUniversity[]
}

export async function fetchAdminUniversityById(id: string): Promise<AdminUniversity | null> {
  const { data } = await supabase.from('universities').select('*').eq('id', id).maybeSingle()
  return (data as AdminUniversity) ?? null
}

export interface UniversityPayload {
  name: string
  city: string
  type: 'government' | 'private'
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  minScore: number | null
  avgScore: number | null
  tuitionMin: number | null
  tuitionMax: number | null
  dormitory: boolean
  budgetPlaces: boolean
  rating: number | null
  languages: string[]
  totalSpecialties: number | null
  isActive: boolean
}

export async function createUniversity(payload: UniversityPayload): Promise<void> {
  const res = await authenticatedFetch('/api/admin/universities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create university')
}

export async function updateUniversity(id: string, payload: UniversityPayload): Promise<void> {
  const res = await authenticatedFetch('/api/admin/universities', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...payload }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update university')
}

export async function setUniversityActive(id: string, isActive: boolean): Promise<void> {
  const res = await authenticatedFetch('/api/admin/universities', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, isActive }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update university')
}

export async function deleteUniversity(id: string): Promise<void> {
  const res = await authenticatedFetch('/api/admin/universities', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete university')
}

// ── Specialties (/admin/universities/[id]/specialties) ──────────────────

export interface AdminSpecialty {
  id: string
  university_id: string
  name: string
  faculty: string | null
  min_score: number | null
  tuition: number | null
  language: string | null
  form: string
  type: string
  is_active: boolean
}

export async function fetchAdminSpecialties(universityId: string): Promise<AdminSpecialty[]> {
  const { data } = await supabase
    .from('university_specialties')
    .select('*')
    .eq('university_id', universityId)
    .order('name', { ascending: true })
  return (data ?? []) as AdminSpecialty[]
}

export interface SpecialtyPayload {
  universityId: string
  name: string
  faculty: string | null
  minScore: number | null
  tuition: number | null
  language: string | null
  form: string
  type: string
}

export async function createSpecialty(payload: SpecialtyPayload): Promise<void> {
  const res = await authenticatedFetch('/api/admin/university-specialties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create specialty')
}

export async function updateSpecialty(id: string, payload: SpecialtyPayload): Promise<void> {
  const res = await authenticatedFetch('/api/admin/university-specialties', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...payload }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update specialty')
}

export async function deleteSpecialty(id: string): Promise<void> {
  const res = await authenticatedFetch('/api/admin/university-specialties', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete specialty')
}
