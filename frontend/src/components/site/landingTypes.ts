// ساختار محتوای صفحه‌ی لندینگ (همان ساختاری که بک‌اند در /cms/landing/ برمی‌گرداند)

export interface LandingContent {
  hero: {
    visible: boolean;
    badge: string;
    title: string;
    subtitle: string;
    primary_text: string;
    primary_link: string;
    secondary_text: string;
    secondary_link: string;
  };
  promo: { visible: boolean; title: string; text: string; button_text: string; button_link: string };
  vip: {
    visible: boolean;
    card_title: string;
    card_text: string;
    bullets: string[];
    button_text: string;
    button_link: string;
    side_title: string;
    side_text: string;
  };
  business: {
    visible: boolean;
    title: string;
    text: string;
    features: { title: string; desc: string }[];
    button_text: string;
    button_link: string;
  };
}

export interface LandingPayload {
  content: LandingContent;
  hero_image: string | null;
  updated_at?: string;
}
