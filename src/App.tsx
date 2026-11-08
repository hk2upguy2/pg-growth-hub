import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import ImportAccounts from './pages/ImportAccounts'
import BalanceImport from './pages/BalanceImport'
import SalesImport from './pages/SalesImport'
import AccountDetail from './pages/AccountDetail'
import Activities from './pages/Activities'
import Opportunities from './pages/Opportunities'
import Products from './pages/Products'
import RoutePlanner from './pages/RoutePlanner'
import Promotions from './pages/Promotions'
import Competitors from './pages/Competitors'
import Quotes from './pages/Quotes'
import PriceList from './pages/PriceList'
import Insights from './pages/Insights'
import Today from './pages/Today'
import Orders from './pages/Orders'
import VillageBoard from './pages/VillageBoard'
import Stock from './pages/Stock'
import Forecast from './pages/Forecast'
import TeamActivity from './pages/TeamActivity'
import AuditLog from './pages/AuditLog'
import Photos from './pages/Photos'
import Scorecard from './pages/Scorecard'
import Messages from './pages/Messages'
import Reports from './pages/Reports'
import Users from './pages/Users'
import SettingsPage from './pages/Settings'

/** Managers land on the dashboard; reps land on Today. */
function Home() {
  const { isAdmin, isService } = useStore()
  return isAdmin ? <Dashboard /> : isService ? <Orders /> : <Today />
}

export default function App() {
  const { user, isAdmin, loading } = useStore()
  if (loading) return <div className="min-h-full flex items-center justify-center text-slate-500 text-sm">Loading PG Growth Hub…</div>
  if (!user) return <Login />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/import" element={isAdmin ? <ImportAccounts /> : <Navigate to="/accounts" replace />} />
        <Route path="/accounts/sales-update" element={isAdmin ? <SalesImport /> : <Navigate to="/accounts" replace />} />
        <Route path="/accounts/balances-update" element={isAdmin ? <BalanceImport /> : <Navigate to="/accounts" replace />} />
        <Route path="/accounts/retail" element={<Accounts fixedType="Retail" />} />
        <Route path="/accounts/foodservice" element={<Accounts fixedType="Foodservice" />} />
        <Route path="/accounts/hotel" element={<Accounts fixedType="Hotel" />} />
        <Route path="/accounts/military" element={<Accounts fixedMarket="Military" />} />
        <Route path="/accounts/islands" element={<Accounts fixedMarket="Other Island" />} />
        <Route path="/account/:id" element={<AccountDetail />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/products" element={<Products />} />
        <Route path="/routes" element={<RoutePlanner />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/competitors" element={<Competitors />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/price-list" element={<PriceList />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/village-board" element={<VillageBoard />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/team-activity" element={isAdmin ? <TeamActivity /> : <Navigate to="/" replace />} />
        <Route path="/audit" element={isAdmin ? <AuditLog /> : <Navigate to="/" replace />} />
        <Route path="/scorecard" element={<Scorecard />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
