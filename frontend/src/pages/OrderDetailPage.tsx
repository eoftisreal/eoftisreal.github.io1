'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWithAuth } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/storage';

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
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
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
      let finalScreenshotUrl = screenshotUrl;

      // Upload the file if a new file was selected
      if (screenshotFile) {
        const formData = new FormData();
        formData.append('file', screenshotFile);
        formData.append('folder', 'customers/payment-screenshots');

        // We use the custom upload endpoint since we just need to host the image
        const token = getAuthToken();
        const uploadRes = await fetch(`${apiBase}/products/upload-custom`, {
          method: 'POST',
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          alert(`Image upload failed: ${errData.message}`);
          setPaymentDoneLoading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        finalScreenshotUrl = uploadData.url;
        setScreenshotUrl(finalScreenshotUrl);
      }

      const res = await fetchWithAuth(`${apiBase}/orders/${id}/payment-done`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ utr, screenshotUrl: finalScreenshotUrl })
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

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
      setScreenshotUrl(''); // clear direct url if any
    }
  };

  if (loading) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Loading order...</p>;
  }


  const orderFlow = ['pending_payment', 'awaiting_verification', 'payment_verified', 'processing', 'shipped', 'delivered'];
  const cancelledFlow = ['cancelled'];
  const rejectedFlow = ['rejected'];

  const getFlowIndex = (status: string) => orderFlow.indexOf(status);

  const renderProgressBar = () => {
    if (!order || cancelledFlow.includes(order.status) || rejectedFlow.includes(order.status)) return null;

    const currentIndex = order ? getFlowIndex(order.status) : -1;
    // If status is not in the normal flow, don't show the bar
    if (currentIndex === -1) return null;

    return (
      <div className="mb-8 mt-4 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {orderFlow.map((s, idx) => {
            const isCompleted = idx <= currentIndex;
            const isLast = idx === orderFlow.length - 1;

            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isCompleted ? 'bg-foreground text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <span className={`text-xs mt-2 font-medium capitalize ${isCompleted ? 'text-foreground' : 'text-slate-400'}`}>
                    {s.replace('_', ' ')}
                  </span>
                </div>
                {!isLast && (
                  <div className={`w-16 sm:w-24 h-1 mx-2 ${idx < currentIndex ? 'bg-foreground' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
                    <label className="block text-xs font-medium text-slate-700 mb-1">Upload Payment Screenshot</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-foreground file:text-white hover:file:bg-black cursor-pointer w-full"
                      />
                    </div>
                    {screenshotPreview && (
                       <div className="mt-2">
                         <img src={screenshotPreview} alt="Screenshot Preview" className="h-32 object-contain rounded border border-slate-200" />
                       </div>
                    )}
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


      {renderProgressBar()}
      <div className="space-y-4">
        <p className="rounded-md bg-white p-4 border border-secondary-bg">
          Current status: <strong>{order.status.replace('_', ' ').toUpperCase()}</strong>
        </p>

        {order.status === 'payment_verified' && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md shadow-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium">Payment successful. A confirmation email has been sent for your order.</p>
          </div>
        )}
      </div>

      <div className="space-y-2 mt-6">
        {order.timeline.map((event, index) => (
          <article key={`${event.status}-${index}`} className="rounded-md bg-white p-4 border border-secondary-bg">
            <p className="font-bold capitalize">{event.status.replace('_', ' ')}</p>
            {event.note ? <p className="text-sm text-slate-600">{event.note}</p> : null}
            <p className="text-xs text-slate-400 mt-1">{new Date(event.at).toLocaleString('en-GB')}</p>
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
