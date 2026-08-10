import {
  CalendarRange, CircleGauge, FileText, HeartPulse, Inbox, Landmark, Mail,
  Map, MapPinned, Network, Settings, Sparkles, Users,
} from 'lucide-react';

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
  { id: 'communications', label: 'Communications', items: [
    { to: '/inbox', label: 'Form Inbox', icon: Mail },
    { to: '/newsletter', label: 'Newsletter', icon: FileText },
  ]},
  { id: 'management', label: 'Management', items: [
    { to: '/team', label: 'Team', icon: Users },
    { to: '/connections', label: 'Connections', icon: Network },
    { to: '/reports', label: 'Reports', icon: Landmark },
  ]},
  { id: 'system', label: 'System', items: [
    { to: '/system-health', label: 'System Health', icon: HeartPulse },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]},
];
export const allNavItems = navGroups.flatMap((group) => group.items);
export function findNavItem(pathname) {
  return allNavItems.find((item) => item.to !== '/' && pathname.startsWith(item.to)) || allNavItems.find((item) => item.to === pathname) || null;
}
