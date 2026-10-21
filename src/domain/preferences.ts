import type { EnvironmentOption, Tag } from '../types'

export const ENVIRONMENT_OPTIONS_AT = '2026-10-03T00:00:00.000Z'
export const DEFAULT_WEATHER_OPTIONS: EnvironmentOption[] = [
  ['weather:sunny','晴','☀️'],['weather:partly-cloudy','晴间多云','🌤️'],['weather:cloudy','多云','⛅'],['weather:overcast','阴','☁️'],
  ['weather:light-rain','小雨','🌦️'],['weather:moderate-rain','中雨','🌧️'],['weather:heavy-rain','大雨','☔'],
  ['weather:thunderstorm','雷暴','⛈️'],['weather:hail','冰雹','🧊'],['weather:typhoon','台风','🌀'],['weather:fog','雾','🌫️'],
  ['weather:rainbow','雨后天晴','🌈'],['weather:light-snow','小雪','🌨️'],['weather:moderate-snow','中雪','❄️'],['weather:heavy-snow','大雪','☃️']
].map(([id,name,emoji],order)=>({id,name,emoji,order,builtin:true,updatedAt:ENVIRONMENT_OPTIONS_AT}))

export const DEFAULT_THERMAL_OPTIONS: EnvironmentOption[] = [
  ['thermal:cold','寒冷','🥶'],['thermal:cool','偏冷','🤧'],['thermal:comfortable','舒适','🌿'],['thermal:warm','偏热','😥'],
  ['thermal:hot','炎热','🥵'],['thermal:humid','潮湿','💧'],['thermal:muggy','闷热','🥴'],['thermal:dry','干燥','🍂']
].map(([id,name,emoji],order)=>({id,name,emoji,order,builtin:true,updatedAt:ENVIRONMENT_OPTIONS_AT}))

export function normalizeEnvironmentOptions(rows:EnvironmentOption[]|undefined, defaults:EnvironmentOption[]) {
  if(Array.isArray(rows)&&rows.length) {
    const merged=defaults.map(base=>{
      const existing=rows.find(item=>item.id===base.id)
      return existing ? {...existing,name:base.name,emoji:base.emoji,builtin:true,deletedAt:undefined,archived:false} : {...base}
    })
    const custom=rows.filter(item=>!item.builtin&&!defaults.some(base=>base.id===item.id))
    return [...merged,...custom].map((item,index)=>({...item,order:index}))
  }
  return defaults.map(item=>({...item}))
}

export const DEFAULT_TAG_ID = 'default'
export const LEGACY_TAG_MIGRATION_AT = '2026-09-23T00:00:00.000Z'
export const DEFAULT_TAG: Tag = { id: DEFAULT_TAG_ID, name: '默认', color: '#9aa59f', scope: 'both', system: true, systemKind: 'default', updatedAt: LEGACY_TAG_MIGRATION_AT }
export const IMPORT_SOURCE_TAG_PREFIX = 'system-import-source:'
// Keep the legacy `...:dida` id for the umbrella tag so existing imported tasks remain compatible.
export const EXTERNAL_SOURCE_TAG_ID = `${IMPORT_SOURCE_TAG_PREFIX}dida`
export const DIDA_APP_SOURCE_TAG_ID = `${IMPORT_SOURCE_TAG_PREFIX}dida-list`
export const GENERIC_SOURCE_TAG_ID = `${IMPORT_SOURCE_TAG_PREFIX}generic`
export const FOREST_SOURCE_TAG_ID = `${IMPORT_SOURCE_TAG_PREFIX}forest`
export const EXTERNAL_SOURCE_TAG: Tag = { id: EXTERNAL_SOURCE_TAG_ID, name: '从外部导入', color: '#789da3', scope: 'task', system: true, systemKind: 'import-source', sourceKey: 'external', updatedAt: LEGACY_TAG_MIGRATION_AT }
export const DIDA_APP_SOURCE_TAG: Tag = { id: DIDA_APP_SOURCE_TAG_ID, name: '滴答清单', color: '#789da3', scope: 'task', system: true, systemKind: 'import-source', sourceKey: 'dida', updatedAt: LEGACY_TAG_MIGRATION_AT }
export const GENERIC_SOURCE_TAG: Tag = { id: GENERIC_SOURCE_TAG_ID, name: '通用', color: '#789da3', scope: 'task', system: true, systemKind: 'import-source', sourceKey: 'generic', updatedAt: LEGACY_TAG_MIGRATION_AT }
export const FOREST_SOURCE_TAG: Tag = { id: FOREST_SOURCE_TAG_ID, name: 'Forest', color: '#789da3', scope: 'both', system: true, systemKind: 'import-source', sourceKey: 'forest', updatedAt: LEGACY_TAG_MIGRATION_AT }

export function isImportSourceTagId(id:string) { return id.startsWith(IMPORT_SOURCE_TAG_PREFIX) }
export function isImportSourceTag(tag:Tag) { return tag.systemKind === 'import-source' || isImportSourceTagId(tag.id) }
export function normalizeTags(rows: Tag[]): Tag[] { return rows.map(tag => tag.updatedAt ? tag : { ...tag, updatedAt: LEGACY_TAG_MIGRATION_AT }) }
export const REQUIRED_SYSTEM_TAGS: Tag[] = [DEFAULT_TAG, EXTERNAL_SOURCE_TAG, DIDA_APP_SOURCE_TAG, GENERIC_SOURCE_TAG, FOREST_SOURCE_TAG]
export function ensureRequiredSystemTags(rows: Tag[]): Tag[] {
  const normalized = normalizeTags(rows)
  const existing = new Set(normalized.map(tag => tag.id))
  return [...REQUIRED_SYSTEM_TAGS.filter(tag => !existing.has(tag.id)), ...normalized]
}

export const TAG_COLORS = ['#f58f7d', '#eb7258', '#df8748', '#f5a64b', '#ffc557', '#ffdc4f', '#d7df55', '#a6c35a', '#65d19b', '#79ccd4', '#58b4c7', '#7695bd', '#9183da', '#d69bae', '#b9848f']
