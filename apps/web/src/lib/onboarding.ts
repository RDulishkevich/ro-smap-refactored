export const ABOUT_ROLES = [
  { id: 'recordist', ru: 'Полевой рекордист', en: 'Field recordist' },
  { id: 'researcher', ru: 'Исследователь', en: 'Researcher' },
  { id: 'artist', ru: 'Художник / композитор', en: 'Artist / composer' },
  { id: 'student', ru: 'Студент', en: 'Student' },
  { id: 'listener', ru: 'Слушатель', en: 'Listener' },
  { id: 'organizer', ru: 'Организатор экспедиций', en: 'Expedition organizer' },
] as const;

export const USE_GOALS = [
  { id: 'listen', ru: 'Слушать карту', en: 'Listen to the map' },
  { id: 'publish', ru: 'Публиковать записи', en: 'Publish recordings' },
  { id: 'expeditions', ru: 'Собирать экспедиции', en: 'Build expeditions' },
  { id: 'learn', ru: 'Учиться звукозаписи', en: 'Learn field recording' },
  { id: 'archive', ru: 'Архив мест', en: 'Archive places' },
  { id: 'community', ru: 'Сообщество', en: 'Community' },
] as const;

export const EXPEDITION_KINDS = [
  { id: 'field', ru: 'Полевая', en: 'Field' },
  { id: 'city', ru: 'Городская', en: 'Urban' },
  { id: 'night', ru: 'Ночная', en: 'Night' },
  { id: 'water', ru: 'Водная', en: 'Water' },
  { id: 'forest', ru: 'Лесная', en: 'Forest' },
  { id: 'archive', ru: 'Архивная', en: 'Archive' },
] as const;

export function locLabel(item: { ru: string; en: string }, locale: string) {
  return locale === 'en' ? item.en : item.ru;
}
