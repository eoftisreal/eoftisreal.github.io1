'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function VerifyEmailPage() {
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    async function verify() {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        setMessage('Missing verification token.');
        return;
      }

      try {
        const response = await fetch(`${apiBase}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const body = await response.json();
        if (!response.ok) {
          setMessage(body.message || 'Verification failed.');
          return;
        }

        setMessage('Email verified successfully! You can now log in.');
      } catch {
        setMessage('Verification failed.');
      }
    }

    verify();
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-md bg-white p-6 text-center">
      <h1 className="text-2xl font-black">Email Verification</h1>
      <p className="mt-4 text-slate-700">{message}</p>
      <div className="mt-6">
        <Link to="/auth/login" className="text-foreground hover:underline font-semibold">Go to Login</Link>
      </div>
    </div>
  );
}
