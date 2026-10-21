import type { DailyEnvironment, EnvironmentOption } from '../types'

export type EnvironmentKind = 'weather' | 'thermal'

export function environmentByDate(rows: DailyEnvironment[]) {
  return new Map(rows.map(row => [row.date, row]))
}

function keepEnvironmentRow(row: DailyEnvironment) {
  return Boolean(row.weatherOptionId || row.thermalOptionId || row.locationCity)
}

export function setEnvironmentChoice(
  rows: DailyEnvironment[],
  date: string,
  kind: EnvironmentKind,
  optionId: string,
  updatedAt: string,
): DailyEnvironment[] {
  const existing = rows.find(row => row.date === date)
  const next: DailyEnvironment = {
    date,
    weatherOptionId: existing?.weatherOptionId,
    thermalOptionId: existing?.thermalOptionId,
    locationCity: existing?.locationCity,
    locationCountry: existing?.locationCountry,
    updatedAt,
  }
  if (kind === 'weather') next.weatherOptionId = optionId || undefined
  else next.thermalOptionId = optionId || undefined
  if (!keepEnvironmentRow(next)) return rows.filter(row => row.date !== date)
  return existing ? rows.map(row => row.date === date ? next : row) : [...rows, next]
}

export function setEnvironmentLocation(
  rows: DailyEnvironment[],
  date: string,
  city: string,
  country: string | undefined,
  updatedAt: string,
): DailyEnvironment[] {
  const existing = rows.find(row => row.date === date)
  const next: DailyEnvironment = {
    date,
    weatherOptionId: existing?.weatherOptionId,
    thermalOptionId: existing?.thermalOptionId,
    locationCity: city.trim() || undefined,
    locationCountry: country?.trim() || undefined,
    updatedAt,
  }
  if (!keepEnvironmentRow(next)) return rows.filter(row => row.date !== date)
  return existing ? rows.map(row => row.date === date ? next : row) : [...rows, next]
}

export function environmentOptionUsed(rows: DailyEnvironment[], kind: EnvironmentKind, id: string) {
  return rows.some(row => kind === 'weather' ? row.weatherOptionId === id : row.thermalOptionId === id)
}

export function environmentOptionNameTaken(rows: EnvironmentOption[], name: string, exceptId?: string) {
  return rows.some(row => row.id !== exceptId && !row.deletedAt && row.name === name)
}

export function createEnvironmentOption(
  rows: EnvironmentOption[],
  kind: EnvironmentKind,
  id: string,
  name: string,
  emoji: string | undefined,
  updatedAt: string,
): EnvironmentOption[] {
  const order = Math.max(-1, ...rows.filter(row => !row.deletedAt).map(row => row.order)) + 1
  return [...rows, { id: `${kind}:${id}`, name, emoji: emoji || undefined, order, updatedAt }]
}

export function updateEnvironmentOption(
  rows: EnvironmentOption[],
  id: string,
  patch: Partial<Pick<EnvironmentOption, 'name' | 'emoji' | 'archived'>>,
  updatedAt: string,
) {
  return rows.map(row => row.id === id ? { ...row, ...patch, updatedAt } : row)
}

export function deleteEnvironmentOption(rows: EnvironmentOption[], id: string, updatedAt: string) {
  return rows.map(row => row.id === id ? { ...row, deletedAt: updatedAt, updatedAt } : row)
}

export function moveEnvironmentOption(rows: EnvironmentOption[], id: string, direction: -1 | 1, updatedAt: string) {
  const active = rows.filter(row => !row.deletedAt).sort((a, b) => a.order - b.order)
  const index = active.findIndex(row => row.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= active.length) return rows
  const item = active[index]
  const other = active[target]
  return rows.map(row => row.id === item.id
    ? { ...row, order: other.order, updatedAt }
    : row.id === other.id
      ? { ...row, order: item.order, updatedAt }
      : row)
}
