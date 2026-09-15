export interface DropdownItem {
  name: string;
  href: string;
  description?: string;
  icon?: string;
}

export interface NavigationItem {
  name: string;
  href: string;
  icon?: string;
  hasDropdown?: boolean;
  dropdownType?: 'games' | 'legal' | 'custom';
  dropdownItems?: DropdownItem[];
}

export interface SocialLink {
  name: string;
  href: string;
  icon: string;
}

export interface ClientSpace {
  name: string;
  href: string;
  icon: string;
}

export interface Banner {
  show: boolean;
  text: string;
  couponCode: string;
  useThemeColor?: boolean;
  backgroundColor: string;
  fallbackColor: string;
}

export interface NavigationConfig {
  mainNavigation: NavigationItem[];
  socialLinks: SocialLink[];
  clientSpace: ClientSpace;
  banner: Banner;
}
