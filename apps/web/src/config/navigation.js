import {
  BarChart3, CalendarRange, CircleGauge, FileText, HeartPulse, Image, Inbox, Landmark,
  Mail, Map, MapPinned, Network, Newspaper, Server, Settings, Sparkles, Users,
} from 'lucide-react';

/**
 * `capability` names the real WordPress capability a route needs.
 *
 * bt_manage_operations gates dashboard login and is held by seven roles, but
 * only administrator also holds edit_posts / upload_files / manage_options. An
 * item without a capability is visible to anyone who can sign in.
 *
 * Hiding is UI only — every route enforces the same check server-side. The
 * point here is that an operator never sees a link that would 403 on click.
 */
export const navGroups = [
  { id: 'overview', label: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: CircleGauge, end: true },
  ]},
  { id: 'tour-operations', label: 'Tour Operations', items: [
    { to: '/inquiries', label: 'Inquiries & Bookings', icon: Inbox },
    { to: '/tours', label: 'Tours', icon: Map },
    { to: '/departures', label: 'Departures', icon: CalendarRange },
    { to: '/destinations', label: 'Destinations', icon: MapPinned },
    { to: '/experiences', label: 'Experiences', icon: Sparkles },
  ]},
  { id: 'content', label: 'Content', items: [
    { to: '/content', label: 'Articles & Pages', icon: Newspaper, capability: 'edit_posts' },
    { to: '/media', label: 'Media Library', icon: Image, capability: 'upload_files' },
  ]},
  { id: 'communications', label: 'Communications', items: [
    { to: '/inbox', label: 'Form Inbox', icon: Mail },
    { to: '/newsletter', label: 'Newsletter', icon: FileText },
  ]},
  { id: 'management', label: 'Management', items: [
    { to: '/analytics', label: 'Analytics & SEO', icon: BarChart3 },
    { to: '/team', label: 'Team', icon: Users },
    { to: '/connections', label: 'Connections', icon: Network },
    { to: '/reports', label: 'Reports', icon: Landmark },
  ]},
  { id: 'system', label: 'System', items: [
    { to: '/system-health', label: 'System Health', icon: HeartPulse },
    { to: '/site', label: 'WordPress Site', icon: Server, capability: 'manage_options' },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export const allNavItems = navGroups.flatMap((group) => group.items);

/** True when the signed-in user holds the capability an item declares. */
export function canSeeNavItem(item, capabilities) {
  if (!item?.capability) return true;
  return Array.isArray(capabilities) && capabilities.includes(item.capability);
}

/**
 * Groups filtered to what this user may actually reach, with empty groups
 * dropped so the sidebar never renders a heading over nothing.
 */
export function visibleNavGroups(capabilities) {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canSeeNavItem(item, capabilities)) }))
    .filter((group) => group.items.length > 0);
}

export function findNavItem(pathname) {
  return allNavItems.find((item) => item.to !== '/' && pathname.startsWith(item.to)) || allNavItems.find((item) => item.to === pathname) || null;
}
