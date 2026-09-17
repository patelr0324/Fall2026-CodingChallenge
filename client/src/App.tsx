import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { CollectionsPage } from './pages/CollectionsPage'
import { CollagesPage } from './pages/CollagesPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { FriendsPage } from './pages/FriendsPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/collections" replace />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="collages" element={<CollagesPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/collections" replace />} />
    </Routes>
  )
}

export default App
