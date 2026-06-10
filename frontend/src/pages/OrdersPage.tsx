'use client';

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/storage';

type Order = {
  _id: string;
  status: string;
  total: number;
  createdAt: string;
};

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('Loading orders...');

  useEffect(() => {
    async function fetchOrders() {
      const token = getAuthToken();
      if (!token) {
        setMessage('Login required to view orders.');
        return;
      }

      try {
        const headers = new Headers();
        headers.set('Authorization', ['Bearer', token].join(' '));

        const response = await fetch(`${apiBase}/orders`, {
          headers,
          cache: 'no-store',
        });

        if (!response.ok) {
          setMessage('Unable to load orders.');
          return;
        }

        const data = (await response.json()) as Order[];
        setOrders(data);
        setMessage(data.length === 0 ? 'No orders found.' : '');
      } catch {
        setMessage('Unable to load orders.');
      }
    }

    fetchOrders();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">Orders</h1>
      {message ? <p className="rounded-md bg-white p-4 border border-secondary-bg">{message}</p> : null}
      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order._id} className="rounded-md bg-white p-4 border border-secondary-bg">
            <p className="font-bold">Order #{order._id.slice(-6)}</p>
            <p className="text-sm text-slate-600">Status: {order.status}</p>
            <p className="text-sm text-slate-600">Total: ₹{order.total}</p>
            <Link to={`/orders/${order._id}`} className="mt-2 inline-block rounded border px-3 py-1 text-sm">Track Order</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
