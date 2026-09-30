export const SUPPORT_BOT_FAQ = [
  { keys: ['как добавить', 'добавить звук', 'загрузить', 'опубликовать'], answer: 'Чтобы добавить звук: нажмите «+» на карте, войдите в аккаунт и заполните форму. Новая запись уходит на модерацию.' },
  { keys: ['не играет', 'нет звука', 'playback'], answer: 'Проверьте интернет и громкость. На iOS иногда помогает повторный play после разблокировки экрана.' },
  { keys: ['вход', 'регистрац', 'аккаунт', 'логин'], answer: 'Регистрация и вход — через профиль. Карту можно смотреть без аккаунта; публикация и лайки требуют входа и согласия на cookies.' },
  { keys: ['пароль', 'забыл парол', 'сброс'], answer: 'На экране входа нажмите «Забыли пароль?». Нужен подтверждённый email.' },
  { keys: ['подтверд email', 'код на почт'], answer: 'Email подтверждается один раз в кабинете кодом из письма noreply@polevka.art.' },
  { keys: ['экспедиц', 'маршрут'], answer: 'Экспедиции создаются в кабинете и видны во вкладке «Экспедиции» ленты.' },
  { keys: ['жалоба', 'репорт'], answer: 'На запись или комментарий можно пожаловаться из меню ⋯. Жалобы смотрит модерация.' },
  { keys: ['политик', 'конфиденциал'], answer: 'Политика конфиденциальности открывается из помощи и с экрана входа.', openLegal: 'privacy' as const },
  { keys: ['соглашен', 'оферт', 'условия'], answer: 'Пользовательское соглашение — в помощи.', openLegal: 'terms' as const },
  { keys: ['поддержк', 'контакт'], answer: 'Пишите в этот чат. Также: support@polevka.art. Если FAQ не помог — напишите «обращение».' },
  { keys: ['привет', 'здравств'], answer: 'Здравствуйте! Я бот поддержки Полёвки. Опишите вопрос своими словами.' },
];

export function matchSupportBotFaq(text: string): (typeof SUPPORT_BOT_FAQ)[number] | null {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return null;
  let best: (typeof SUPPORT_BOT_FAQ)[number] | null = null;
  let bestScore = 0;
  SUPPORT_BOT_FAQ.forEach((item) => {
    let score = 0;
    item.keys.forEach((k) => { if (q.includes(k)) score += k.length; });
    if (score > bestScore) { bestScore = score; best = item; }
  });
  return bestScore > 0 ? best : null;
}
