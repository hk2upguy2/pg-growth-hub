import { ReactNode, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, ShoppingCart, UtensilsCrossed, Hotel, ClipboardList, Target, Package, Route,
  CalendarDays, Swords, BarChart3, Users, Settings, FileText, Tag, MessageSquare, ShieldCheck, Ship, Trophy, Activity as ActivityIcon, ScrollText, LineChart, Menu, X, LogOut, FlaskConical, Camera, CloudOff,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { NotificationBell } from './NotificationBell'
import { AccountType, channelAllows } from '../types'
import { hasSupabase } from '../lib/supabase'
import { cx } from '../lib/utils'
import { QuickVisit } from './QuickVisit'
import { unreadMessages } from '../lib/analytics'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Account Directory', icon: Building2, end: true },
  { to: '/accounts/retail', label: 'Retail Accounts', icon: ShoppingCart, type: 'Retail' },
  { to: '/accounts/foodservice', label: 'Foodservice Accounts', icon: UtensilsCrossed, type: 'Foodservice' },
  { to: '/accounts/hotel', label: 'Hotel Accounts', icon: Hotel, type: 'Hotel' },
  { to: '/accounts/military', label: 'Commissary & Military', icon: ShieldCheck },
  { to: '/accounts/islands', label: 'Other Islands', icon: Ship },
  { to: '/activities', label: 'Sales Activities', icon: ClipboardList },
  { to: '/opportunities', label: 'Opportunities', icon: Target },
  { to: '/products', label: 'Product Tracking', icon: Package },
  { to: '/routes', label: 'Route Planner', icon: Route },
  { to: '/promotions', label: 'Promotion Calendar', icon: CalendarDays },
  { to: '/competitors', label: 'Competitor Tracking', icon: Swords },
  { to: '/scorecard', label: 'Scorecard', icon: Trophy },
  { to: '/photos', label: 'Shelf Photos', icon: Camera },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/price-list', label: 'Price List', icon: Tag },
  { to: '/forecast', label: 'Forecast', icon: LineChart },
  { to: '/team-activity', label: 'Team Activity', icon: ActivityIcon, admin: true },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/users', label: 'User Management', icon: Users, admin: true },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, admin: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, user, messages, messageReads } = useStore()
  const unread = unreadMessages(user?.id, messages, messageReads).length
  return (
    <nav className="px-3 space-y-0.5">
      {NAV.filter(n => (!n.admin || isAdmin) && (!('type' in n) || isAdmin || channelAllows(user?.channel, n.type as AccountType))).map(n => (
        <NavLink
          key={n.to} to={n.to} end={n.end} onClick={onNavigate}
          className={({ isActive }) => cx(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
            isActive ? 'bg-white/15 text-white' : 'text-navy-200 hover:bg-white/10 hover:text-white',
          )}
        >
          <n.icon size={18} /> {n.label}
          {n.to === '/messages' && unread > 0 && <span className="ml-auto rounded-full bg-red-500 text-white text-xs font-semibold px-2 py-0.5">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between">
        <div><div className="text-white font-bold text-lg leading-tight">PG Growth Hub</div>
          <div className="text-navy-300 text-xs">Pacific Grocers · Guam</div></div>
        <div className="hidden lg:block -mr-2 -mt-1"><NotificationBell /></div>
      </div>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, offlineSince } = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  return (
    <div className="min-h-full flex">
      <QuickVisit />
      {/* desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-navy-800 sticky top-0 h-screen overflow-y-auto">
        <Brand />
        <div className="flex-1 pb-4"><NavList /></div>
        <UserBox onLogout={logout} />
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[85%] bg-navy-800 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pr-3"><Brand />
              <button className="text-white p-2" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
            <div className="flex-1 pb-4"><NavList onNavigate={() => setOpen(false)} /></div>
            <UserBox onLogout={logout} />
          </div>
          <div className="flex-1 bg-navy-900/50" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 bg-navy-800 text-white flex items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <span className="font-semibold">PG Growth Hub</span>
          <span className="ml-auto text-xs text-navy-200 truncate max-w-[40%]">{user?.name}</span>
          <NotificationBell dark />
        </header>
        {offlineSince && (
          <div className="bg-amber-50 border-b border-amber-300 text-amber-900 text-xs px-4 py-2 flex items-center gap-2">
            <CloudOff size={14} className="shrink-0" />
            <span><strong>Offline:</strong> showing data saved {new Date(offlineSince).toLocaleString()}. You can look things up and log visits and photos; other changes need a connection.</span>
          </div>
        )}
        {!hasSupabase && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center gap-2">
            <FlaskConical size={14} className="shrink-0" />
            <span>
              <strong>Demo mode:</strong> data is stored in this browser only. Records marked “Demo” are illustrative and are not confirmed customers or actual sales.
            </span>
          </div>
        )}
        <main key={loc.pathname} className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}

function UserBox({ onLogout }: { onLogout: () => void }) {
  const { user } = useStore()
  return (
    <div className="p-4 border-t border-white/10 text-white">
      <div className="text-sm font-semibold truncate">{user?.name}</div>
      <div className="text-xs text-navy-300 mb-2">{user?.role === 'admin' ? 'Management / Administrator' : 'Sales Representative'}</div>
      <button onClick={onLogout} className="flex items-center gap-2 text-xs text-navy-200 hover:text-white"><LogOut size={14} /> Sign out</button>
    </div>
  )
}
