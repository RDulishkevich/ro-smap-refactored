import { color } from '@polevka/design';

export type RailBannerAction = 'library' | 'feed' | 'expeditions' | 'guessr';

export type RailBanner = {
  id: string;
  title: string;
  hint: string;
  tint: string;
  image?: string;
  action: RailBannerAction;
};

export const RAIL_BANNERS: RailBanner[] = [
  {
    id: 'listen',
    title: 'Слушайте поле',
    hint: 'Новые метки на карте Ростова',
    tint: color.mist,
    image: '/banners/listen.webp',
    action: 'library',
  },
  {
    id: 'walk',
    title: 'Идите в экспедицию',
    hint: 'Маршруты и совместные записи',
    tint: color.olive,
    image: '/banners/walk.webp',
    action: 'expeditions',
  },
  {
    id: 'guess',
    title: 'Audio Guesser',
    hint: 'Угадайте место по звуку',
    tint: color.accent,
    image: '/banners/guess.webp',
    action: 'guessr',
  },
];

export const RAIL_BANNER_MS = 30_000;
