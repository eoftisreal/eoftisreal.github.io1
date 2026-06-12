'use client';

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/storage';

type OrderItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  image?: string;
  customImage?: string;
  productId?: { images?: string[] } | string;
};

type Order = {
  _id: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
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
            {order.items && order.items.length > 0 && (
              <div className="mt-3 mb-3 border-t border-slate-100 pt-2">
                <p className="text-xs font-semibold text-slate-500 mb-2">Products:</p>
                <div className="space-y-3">
                  {order.items.map((item, idx) => {
                    const imageUrl = item.image || (typeof item.productId === 'object' && item.productId?.images?.[0]) || '';
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex gap-2 shrink-0 bg-white rounded border border-slate-200 p-1">
                          {imageUrl && (
                            <img src={imageUrl} alt={item.title} className="h-16 w-16 object-cover rounded" />
                          )}
                          {item.customImage && (
                            <img src={item.customImage} alt="Custom upload" className="h-16 w-16 object-contain bg-slate-100 rounded border border-dashed border-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-700 truncate">{item.title}</p>
                          <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <Link to={`/orders/${order._id}`} className="mt-2 inline-block rounded border px-3 py-1 text-sm">Track Order</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
