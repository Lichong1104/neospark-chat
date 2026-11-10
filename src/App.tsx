import { Toaster } from 'sonner';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';
import ChatPage from './pages/ChatPage';
import SharePage from './pages/SharePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="*" element={<ChatPage />} />
        </Routes>
        <LoginModal />
        <Toaster position="bottom-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
