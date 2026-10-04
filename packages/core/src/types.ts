export type StaffRole = 'admin' | 'moderator' | 'user';

export type Comment = {
  id: string;
  author: string;
  authorId?: string | null;
  text: string;
  date: string;
  replies: Array<{ id: string; author: string; authorId?: string | null; text: string; date: string }>;
  reactedBy: string[];
  reports?: unknown[];
};

export type TimeMarker = { t: number; label: string };

export type Sound = {
  id: string | number;
  title: string;
  location?: string;
  description?: string;
  type?: string;
  ecoCategory?: string;
  ucsCat?: string;
  duration?: string;
  url?: string;
  lat?: number;
  lng?: number;
  plays?: number | string;
  likes?: number;
  likedBy?: string[];
  dislikedBy?: string[];
  user?: string;
  recordist?: string;
  recordistId?: string | null;
  avatar?: string;
  ago?: string;
  wf?: number;
  comments?: Comment[];
  status?: string;
  images?: string[];
  gear?: string;
  date?: string;
  sessionId?: string | null;
  reports?: unknown[];
  tagArray?: string[];
  weather?: string;
  principle?: string;
  recorder?: string;
  microphone?: string;
  channels?: string;
  license?: string;
  route?: Array<{ lat: number; lng: number } | [number, number]>;
  ucsCatId?: string;
  ucsCategory?: string;
  fxName?: string;
  fileName?: string;
  formatLabel?: string;
  rejectNote?: string;
  deleted?: boolean;
  timeMarkers?: TimeMarker[];
  [key: string]: unknown;
};

export type Profile = {
  login?: string;
  loginName?: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  role?: StaffRole;
  email?: string;
  emailVerified?: boolean;
  totpEnabled?: boolean;
  sessions?: Expedition[];
  notifications?: AppNotification[];
  blocked?: boolean;
  gear?: string;
  links?: string;
  following?: string[];
  pdConsent?: boolean;
  pdConsentAt?: string;
  aboutRole?: string;
  useGoals?: string[];
  [key: string]: unknown;
};

export type Expedition = {
  id?: string;
  title: string;
  desc?: string;
  preview?: string;
  dur?: string;
  n?: number;
  emoji?: string;
  createdAt?: string;
  ownerLogin?: string;
  members?: string[];
  photos?: string[];
  route?: Array<{ lat: number; lng: number }>;
  soundIds?: Array<string | number>;
  invites?: ExpeditionInvite[];
  date?: string;
  place?: string;
  kind?: string;
};

export type ExpeditionInvite = {
  login: string;
  soundId: string;
  status: 'pending' | 'accepted' | 'declined';
};

export type FeedPost = {
  id?: string;
  title?: string;
  text?: string;
  author?: string;
  createdAt?: string;
  images?: string[];
  comments?: Comment[];
  likes?: number;
  soundId?: string | number;
  [key: string]: unknown;
};

export type AppEvent = {
  id?: string;
  title: string;
  loc?: string;
  location?: string;
  date?: string;
  time?: string;
  n?: number;
  emoji?: string;
  tag?: string;
  status?: string;
  attendees?: string[];
  [key: string]: unknown;
};

export type MailReplyTo = {
  id: string;
  fromId?: string;
  fromName?: string;
  text?: string;
  image?: boolean;
  video?: boolean;
};

export type MailMsg = {
  id: string;
  fromId: string;
  fromName?: string;
  text: string;
  date: string;
  read?: boolean;
  readAt?: string;
  deleted?: boolean;
  editedAt?: string;
  image?: string;
  video?: string;
  replyTo?: MailReplyTo;
  reactions?: Record<string, string[]>;
  ticketNumber?: number;
  _ticket?: boolean;
  _supportThread?: boolean;
};

export type MailBox = {
  loginName: string;
  inbox: MailMsg[];
  notifications?: Array<Record<string, unknown>>;
  activityLog?: unknown[];
};

export type Conversation = {
  id: string;
  name: string;
  avatar?: string;
  lastMsg: string;
  time: string;
  unread: number;
};

export type ChatMsg = { from: 'me' | 'them'; text: string; at?: string };

export type AppNotification = {
  avatar?: string;
  from: string;
  text: string;
  time: string;
  read?: boolean;
  icon?: string;
};

export type SessionUser = {
  username: string;
  loginName: string;
  role: StaffRole;
  totpEnabled?: boolean;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  avatar?: string;
  bio?: string;
};
