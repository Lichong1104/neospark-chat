import { Toaster } from 'sonner';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';
import ChatPage from './pages/ChatPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ChatPage />
        <LoginModal />
        <Toaster position="bottom-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
