import { color } from '@polevka/design';

export type RailBannerAction = 'library' | 'feed' | 'expeditions' | 'guessr';

export type RailBanner = {
  id: string;
  title: string;
  hint: string;
  tint: string;
  image?: string;
  objectPosition?: string;
  action: RailBannerAction;
};

export const RAIL_BANNERS: RailBanner[] = [
  {
    id: 'listen',
    title: 'Слушайте мир вокруг',
    hint: 'Новые метки на карте',
    tint: color.mist,
    image: '/banners/walk.png',
    objectPosition: 'center 35%',
    action: 'library',
  },
  {
    id: 'walk',
    title: 'Идите в экспедицию',
    hint: 'Маршруты и совместные записи',
    tint: color.olive,
    image: '/banners/listen.png',
    objectPosition: 'left 80%',
    action: 'expeditions',
  },
  {
    id: 'guess',
    title: 'Audio Guesser',
    hint: 'Угадайте место по звуку',
    tint: color.accent,
    image: '/banners/guess.png',
    objectPosition: 'center 48%',
    action: 'guessr',
  },
];

export const RAIL_BANNER_MS = 30_000;
