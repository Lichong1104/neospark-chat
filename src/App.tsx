import { Toaster } from 'sonner';
import { AuthProvider } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';
import ChatPage from './pages/ChatPage';

export default function App() {
  return (
    <AuthProvider>
      <ChatPage />
      <LoginModal />
      <Toaster position="bottom-center" richColors />
    </AuthProvider>
  );
}
