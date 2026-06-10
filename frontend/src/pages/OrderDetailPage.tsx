'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useParams } from 'react-router-dom';

type Order = {
  _id: string;
  status: string;
  timeline: { status: string; note?: string; at: string }[];
};

import { Suspense } from 'react';

function OrderTrackingContent() {
  const { id } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchOrder() {
      if (!id) {
        if (active) setLoading(false);
        return;
      }

      try {
        const data = await apiGet<Order>(`/orders/${id}`);
        if (active) setOrder(data);
      } catch {
        if (active) setOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchOrder();

    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Loading order...</p>;
  }

  if (!order) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Order not found.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">Track Order #{order._id.slice(-6)}</h1>
      <p className="rounded-md bg-white p-4 border border-secondary-bg">Current status: <strong>{order.status}</strong></p>
      <div className="space-y-2">
        {order.timeline.map((event, index) => (
          <article key={`${event.status}-${index}`} className="rounded-md bg-white p-4 border border-secondary-bg">
            <p className="font-bold">{event.status}</p>
            {event.note ? <p className="text-sm text-slate-600">{event.note}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<p className="rounded-md bg-white p-6 border border-secondary-bg">Loading order tracking...</p>}>
      <OrderTrackingContent />
    </Suspense>
  );
}
