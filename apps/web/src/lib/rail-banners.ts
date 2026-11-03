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
    image: '/stock/feed.svg',
    objectPosition: 'center',
    action: 'library',
  },
  {
    id: 'walk',
    title: 'Идите в экспедицию',
    hint: 'Маршруты и совместные записи',
    tint: color.olive,
    image: '/stock/expeditions.svg',
    objectPosition: 'center',
    action: 'expeditions',
  },
  {
    id: 'guess',
    title: 'Угадайка',
    hint: 'Угадайте место по звуку',
    tint: color.accent,
    image: '/stock/guessr.svg',
    objectPosition: 'center',
    action: 'guessr',
  },
];

export const RAIL_BANNER_MS = 30_000;
