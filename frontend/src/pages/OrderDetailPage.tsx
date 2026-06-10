'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWithAuth } from '@/lib/apiClient';

const apiBase = import.meta.env.VITE_API_URL || '/api';

type Order = {
  _id: string;
  status: string;
  uniquePaymentAmount?: number;
  timeline: { status: string; note?: string; at: string }[];
};

type QRSettings = {
  upiId: string;
  payeeName: string;
  qrExpiryMinutes: number;
  qrGeneratedAt: string;
  enableUtrSubmission: boolean;
  enableScreenshotUpload: boolean;
};

import { Suspense } from 'react';

function OrderTrackingContent() {
  const { id } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSettings, setQrSettings] = useState<QRSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [utr, setUtr] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [paymentDoneLoading, setPaymentDoneLoading] = useState(false);

  async function fetchOrder() {
    if (!id) return;
    try {
      const res = await fetchWithAuth(`${apiBase}/orders/${id}`);
      if (res.ok) {
        setOrder(await res.json());
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
  }, [id]);

  async function generateQr() {
    try {
      const res = await fetchWithAuth(`${apiBase}/orders/${id}/generate-qr`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setQrSettings(data);
      }
    } catch (e) {
      console.error('Failed to generate QR', e);
    }
  }

  useEffect(() => {
    if (order?.status === 'pending_payment') {
      generateQr();
    }
  }, [order?.status]);

  useEffect(() => {
    if (!qrSettings) return;

    const interval = setInterval(() => {
      const generatedAt = new Date(qrSettings.qrGeneratedAt).getTime();
      const expiryTime = generatedAt + qrSettings.qrExpiryMinutes * 60000;
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [qrSettings]);

  const handlePaymentDone = async () => {
    setPaymentDoneLoading(true);
    try {
      const res = await fetchWithAuth(`${apiBase}/orders/${id}/payment-done`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ utr, screenshotUrl })
      });
      if (res.ok) {
        fetchOrder();
      } else {
        alert('Failed to submit payment details.');
      }
    } catch (e) {
      alert('An error occurred.');
    } finally {
      setPaymentDoneLoading(false);
    }
  };

  if (loading) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Loading order...</p>;
  }

  if (!order) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Order not found.</p>;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getUpiUrl = () => {
    if (!qrSettings || !order.uniquePaymentAmount) return '';
    return `upi://pay?pa=${qrSettings.upiId}&pn=${encodeURIComponent(qrSettings.payeeName)}&am=${order.uniquePaymentAmount}&cu=INR&tn=Order_${order._id.slice(-6)}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Track Order #{order._id.slice(-6)}</h1>

      {order.status === 'pending_payment' && qrSettings && (
        <div className="bg-white p-6 border border-secondary-bg rounded-md flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold">Complete Your Payment</h2>
            <p className="text-secondary-text">Scan the QR code with any UPI app (GPay, PhonePe, Paytm, etc.) to securely complete your payment. The amount is unique to this order for verification purposes.</p>

            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <p className="text-sm text-slate-500 mb-1">Exact Amount to Pay</p>
              <p className="text-3xl font-black text-foreground">₹{order.uniquePaymentAmount?.toFixed(2)}</p>
              <p className="text-xs text-red-500 mt-1 font-semibold">* Please do not modify this amount in your UPI app.</p>
            </div>

            {timeLeft > 0 ? (
              <p className="text-sm font-medium text-orange-600">QR Code expires in: {formatTime(timeLeft)}</p>
            ) : (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">QR Code has expired.</p>
                <button onClick={generateQr} className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Generate New QR</button>
              </div>
            )}

            {(qrSettings.enableUtrSubmission || qrSettings.enableScreenshotUpload) && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <h3 className="font-semibold text-sm">Optional Fallback (If verification is slow)</h3>
                {qrSettings.enableUtrSubmission && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bank UTR / Transaction ID</label>
                    <input type="text" value={utr} onChange={e => setUtr(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. 123456789012" />
                  </div>
                )}
                {qrSettings.enableScreenshotUpload && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Payment Screenshot URL</label>
                    <input type="text" value={screenshotUrl} onChange={e => setScreenshotUrl(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handlePaymentDone}
              disabled={paymentDoneLoading || timeLeft === 0}
              className="w-full md:w-auto rounded bg-foreground px-6 py-3 font-bold text-white hover:bg-foreground/90 disabled:opacity-50"
            >
              {paymentDoneLoading ? 'Submitting...' : 'I Have Made The Payment'}
            </button>
          </div>
          <div className="shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
            {timeLeft > 0 ? (
              <div className="bg-white p-2 rounded-lg mb-2">
                <QRCodeSVG value={getUpiUrl()} size={200} />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] bg-slate-200 rounded-lg mb-2 flex items-center justify-center text-slate-500 text-sm">
                Expired
              </div>
            )}
            <p className="text-sm font-semibold">{qrSettings.payeeName}</p>
            <p className="text-xs text-slate-500">{qrSettings.upiId}</p>
          </div>
        </div>
      )}

      <p className="rounded-md bg-white p-4 border border-secondary-bg">Current status: <strong>{order.status.replace('_', ' ').toUpperCase()}</strong></p>

      <div className="space-y-2">
        {order.timeline.map((event, index) => (
          <article key={`${event.status}-${index}`} className="rounded-md bg-white p-4 border border-secondary-bg">
            <p className="font-bold capitalize">{event.status.replace('_', ' ')}</p>
            {event.note ? <p className="text-sm text-slate-600">{event.note}</p> : null}
            <p className="text-xs text-slate-400 mt-1">{new Date(event.at).toLocaleString()}</p>
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
