import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAuthToken, setAuthToken } from '@/lib/storage';
import { Toaster } from 'react-hot-toast';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  useEffect(() => {
    const syncToken = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          // Update local storage and trigger auth-change event
          setAuthToken(data.accessToken);
        }
      } catch (error) {
        // Silently fail if unable to sync
        console.error('Failed to sync auth token:', error);
      }
    };

    syncToken();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-foreground antialiased">
      <Toaster position="bottom-center" reverseOrder={true} />
      <Header />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
