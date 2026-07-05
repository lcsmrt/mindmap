import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth.js';
import { RedirectIfAuthed } from './auth/RedirectIfAuthed.js';
import { AuthPage } from './pages/auth/AuthPage.js';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.js';
import { HomePage } from './pages/home/HomePage.js';
import { MapPage } from './pages/map/MapPage.js';
import { ProfilePage } from './pages/profile/ProfilePage.js';
import { VersionBadge } from './components/VersionBadge.js';

export const App = () => (
  <>
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <AuthPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuthed>
            <ForgotPasswordPage />
          </RedirectIfAuthed>
        }
      />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/maps/:id" element={<MapPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Routes>
    <VersionBadge />
  </>
);

export default App;
