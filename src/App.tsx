import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import ImportAccounts from './pages/ImportAccounts'
import AccountDetail from './pages/AccountDetail'
import Activities from './pages/Activities'
import Opportunities from './pages/Opportunities'
import Products from './pages/Products'
import RoutePlanner from './pages/RoutePlanner'
import Promotions from './pages/Promotions'
import Competitors from './pages/Competitors'
import Reports from './pages/Reports'
import Users from './pages/Users'
import SettingsPage from './pages/Settings'

export default function App() {
  const { user, isAdmin, loading } = useStore()
  if (loading) return <div className="min-h-full flex items-center justify-center text-slate-500 text-sm">Loading PG Growth Hub…</div>
  if (!user) return <Login />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/import" element={isAdmin ? <ImportAccounts /> : <Navigate to="/accounts" replace />} />
        <Route path="/accounts/retail" element={<Accounts fixedType="Retail" />} />
        <Route path="/accounts/foodservice" element={<Accounts fixedType="Foodservice" />} />
        <Route path="/accounts/hotel" element={<Accounts fixedType="Hotel" />} />
        <Route path="/account/:id" element={<AccountDetail />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/products" element={<Products />} />
        <Route path="/routes" element={<RoutePlanner />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/competitors" element={<Competitors />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
