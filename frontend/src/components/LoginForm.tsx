'use client';

import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setAuthToken, setRefreshToken } from '@/lib/storage';
import { useCartStore } from '@/store/cart';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function LoginForm() {
  const navigate = useNavigate();
  const syncLocalCartToBackend = useCartStore(state => state.syncLocalCartToBackend);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('Logging in...');

    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const body = await response.json();
      if (response.ok) {
        setAuthToken(body.accessToken);
        setRefreshToken(body.refreshToken);
        await syncLocalCartToBackend();
        setMessage('Success!');
        navigate('/');
      } else {
        setMessage(body.message || 'Invalid credentials');
      }
    } catch {
      setMessage('An error occurred during login');
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-md bg-white p-6 border border-secondary-bg">
      <h1 className="text-2xl font-black">Log In</h1>
      <p className="mt-2 text-sm text-slate-600">Log in using your email or unique username.</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          type="text"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Email or Username"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />
        <button className="w-full rounded bg-foreground hover:bg-black px-4 py-2 font-semibold text-white">Log In</button>
      </form>

      {message ? <p className="mt-3 text-sm text-center text-secondary-text">{message}</p> : null}

      <div className="mt-6 border-t pt-4 text-center text-sm space-y-2 flex flex-col">
        <Link to="/auth/magic-link" className="text-foreground hover:underline font-semibold">Passwordless Login</Link>
        <Link to="/auth/forgot-password" className="text-slate-500 hover:underline">Forgot password?</Link>
        <Link to="/auth/signup" className="text-slate-500 hover:underline">Don't have an account? Sign up</Link>
      </div>
    </div>
  );
}
