import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ConfirmProvider, Spinner, ToastProvider } from './components/ui';
import Layout from './components/Layout';
import { Login, Register, ForgotPassword, NewPassword } from './pages/Auth';
import Pending from './pages/Pending';
import HomePage from './pages/Home';
import Important from './pages/Important';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import Scanner from './pages/Scanner';
import Members from './pages/Members';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import MyQr from './pages/MyQr';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

function Gate() {
  const { loading, session, profile, perms, recovery } = useAuth();
  if (loading) return <Spinner center />;

  if (recovery && session) return <NewPassword />;

  if (!session) {
    return (
      <Routes>
        <Route path="/rejestracja" element={<Register />} />
        <Route path="/reset" element={<ForgotPassword />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!profile) return <Spinner center />;

  if (!perms.active) {
    return (
      <Routes>
        <Route path="/ja/edytuj" element={<Pending editing />} />
        <Route path="*" element={<Pending />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="wazne" element={<Important />} />
        <Route path="spotkania" element={<Meetings />} />
        <Route path="spotkania/:id" element={<MeetingDetail />} />
        <Route path="spotkania/:id/skaner" element={perms.scan ? <Scanner /> : <Navigate to="/spotkania" replace />} />
        <Route path="czlonkowie" element={<Members />} />
        <Route path="u/:id" element={<Profile />} />
        <Route path="ja/edytuj" element={<EditProfile />} />
        <Route path="moj-qr" element={<MyQr />} />
        <Route path="admin" element={perms.board ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="rejestracja" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
