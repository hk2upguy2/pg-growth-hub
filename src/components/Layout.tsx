import { ReactNode, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Sun, Home, Plus, Building2, ShoppingCart, UtensilsCrossed, Hotel, ClipboardList, Target, Package, Route,
  CalendarDays, Swords, BarChart3, Users, Settings, FileText, Tag, MessageSquare, ShieldCheck, Ship, Trophy, Activity as ActivityIcon, ScrollText, LineChart, Lightbulb, ClipboardCheck, Boxes, MapPinned, Menu, X, LogOut, FlaskConical, Camera, CloudOff,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { NotificationBell } from './NotificationBell'
import { AccountType, channelAllows } from '../types'
import { hasSupabase } from '../lib/supabase'
import { cx } from '../lib/utils'
import { QuickVisit, openLogVisit } from './QuickVisit'
import { unreadMessages } from '../lib/analytics'

type Item = { to: string; label: string; icon: typeof Building2; end?: boolean; admin?: boolean; rep?: boolean; svc?: boolean; type?: AccountType }
type Group = { title: string; items: Item[] }
/** The menu is grouped so people find things by job, not by scanning 25 names. Reps and managers get a different front page. */
const GROUPS: Group[] = [
  { title: 'My day', items: [
    { to: '/', label: 'Today', icon: Sun, end: true, rep: true },
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, admin: true },
    { to: '/messages', label: 'Messages', icon: MessageSquare, svc: true },
    { to: '/routes', label: 'Route Planner', icon: Route },
    { to: '/activities', label: 'Sales Activities', icon: ClipboardList },
  ] },
  { title: 'Customers', items: [
    { to: '/accounts', label: 'All Accounts', icon: Building2, end: true, svc: true },
    { to: '/accounts/retail', label: 'Retail', icon: ShoppingCart, type: 'Retail' },
    { to: '/accounts/foodservice', label: 'Foodservice', icon: UtensilsCrossed, type: 'Foodservice' },
    { to: '/accounts/hotel', label: 'Hotels', icon: Hotel, type: 'Hotel' },
    { to: '/accounts/military', label: 'Commissary & Military', icon: ShieldCheck },
    { to: '/accounts/islands', label: 'Other Islands', icon: Ship },
    { to: '/village-board', label: 'Village Board', icon: MapPinned },
  ] },
  { title: 'Selling', items: [
    { to: '/opportunities', label: 'Opportunities', icon: Target },
    { to: '/quotes', label: 'Quotes', icon: FileText },
    { to: '/orders', label: 'Orders', icon: ClipboardCheck, svc: true },
    { to: '/price-list', label: 'Price List', icon: Tag, svc: true },
    { to: '/stock', label: 'Stock & Expiry', icon: Boxes, svc: true },
    { to: '/insights', label: 'Sales Insights', icon: Lightbulb },
  ] },
  { title: 'Performance', items: [
    { to: '/dashboard', label: 'My Numbers', icon: LayoutDashboard, rep: true },
    { to: '/scorecard', label: 'Scorecard', icon: Trophy },
    { to: '/forecast', label: 'Forecast', icon: LineChart },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/team-activity', label: 'Team Activity', icon: ActivityIcon, admin: true },
  ] },
  { title: 'Market', items: [
    { to: '/promotions', label: 'Promotion Calendar', icon: CalendarDays },
    { to: '/competitors', label: 'Competitor Tracking', icon: Swords },
    { to: '/products', label: 'Product Tracking', icon: Package },
    { to: '/photos', label: 'Shelf Photos', icon: Camera },
  ] },
  { title: 'Admin', items: [
    { to: '/users', label: 'User Management', icon: Users, admin: true },
    { to: '/audit', label: 'Audit Log', icon: ScrollText, admin: true },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, isService, user, messages, messageReads } = useStore()
  const unread = unreadMessages(user?.id, messages, messageReads).length
  const show = (n: Item) => isService ? !!n.svc : (!n.admin || isAdmin) && (!n.rep || !isAdmin) && (!n.type || isAdmin || channelAllows(user?.channel, n.type))
  return (
    <nav className="px-3 pb-2">
      {GROUPS.map(g => ({ ...g, items: g.items.filter(show) })).filter(g => g.items.length).map(g => (
        <div key={g.title} className="mt-4 first:mt-0">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-400">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map(n => (
              <NavLink key={n.to + n.label} to={n.to} end={n.end} onClick={onNavigate}
                className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 lg:py-2 text-[15px] lg:text-sm font-medium transition', isActive ? 'bg-white/15 text-white' : 'text-navy-200 hover:bg-white/10 hover:text-white')}>
                <n.icon size={18} /> {n.label}
                {n.to === '/messages' && unread > 0 && <span className="ml-auto rounded-full bg-red-500 text-white text-xs font-semibold px-2 py-0.5">{unread}</span>}
              </NavLink>))}
          </div>
        </div>))}
    </nav>
  )
}

/** Phone bottom bar: the four things reps do all day, with Log visit in the middle. */
function BottomBar({ onMore }: { onMore: () => void }) {
  const { isAdmin, isService, user, messages, messageReads } = useStore()
  const unread = unreadMessages(user?.id, messages, messageReads).length
  const tab = ({ isActive }: { isActive: boolean }) => cx('flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium relative', isActive ? 'text-navy-800' : 'text-slate-500')
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-stretch h-16 pb-[env(safe-area-inset-bottom)] box-content" aria-label="Main">
      <NavLink to="/" end className={tab}><Home size={22} />{isAdmin ? 'Home' : isService ? 'Orders' : 'Today'}</NavLink>
      <NavLink to="/accounts" className={tab}><Building2 size={22} />Customers</NavLink>
      {!isService && <button onClick={() => openLogVisit()} aria-label="Log a visit" className="flex-1 flex flex-col items-center justify-center text-[11px] font-semibold text-navy-800">
        <span className="-mt-6 h-14 w-14 rounded-full bg-navy-800 text-white shadow-lg flex items-center justify-center ring-4 ring-white"><Plus size={28} /></span>Log visit</button>}
      <NavLink to="/messages" className={tab}><MessageSquare size={22} />Messages{unread > 0 && <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">{unread}</span>}</NavLink>
      <button onClick={onMore} className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500"><Menu size={22} />More</button>
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
        <main key={loc.pathname} className="flex-1 p-4 sm:p-6 pb-28 lg:pb-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <BottomBar onMore={() => setOpen(true)} />
    </div>
  )
}

function UserBox({ onLogout }: { onLogout: () => void }) {
  const { user } = useStore()
  return (
    <div className="p-4 border-t border-white/10 text-white">
      <div className="text-sm font-semibold truncate">{user?.name}</div>
      <div className="text-xs text-navy-300 mb-2">{user?.role === 'admin' ? 'Management / Administrator' : user?.role === 'service' ? 'Customer Service' : 'Sales Representative'}</div>
      <button onClick={onLogout} className="flex items-center gap-2 text-xs text-navy-200 hover:text-white"><LogOut size={14} /> Sign out</button>
    </div>
  )
}
