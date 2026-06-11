'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/storage';
import { fetchWithAuth } from '@/lib/apiClient';
import { useCartStore } from '@/store/cart';
import { useNavigate } from 'react-router-dom';

const apiBase = import.meta.env.VITE_API_URL || '/api';

const steps = ['Address', 'Delivery', 'Payment'];

type CheckoutData = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryMethod: 'email' | 'whatsapp';
};

export default function CheckoutForm() {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');

  const [formData, setFormData] = useState<CheckoutData>({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    deliveryMethod: 'email'
  });

  const [deliverySettings, setDeliverySettings] = useState({
    enableEmailDelivery: true,
    enableWhatsappDelivery: true,
    customFeatureIconUrl: '',
    enableTax: true,
    taxPercentage: 18,
    enableDeliveryCharge: false,
    deliveryCharge: 0
  });

  const { items, fetchCart } = useCartStore();
  const navigate = useNavigate();

  const isLoggedIn = !!getAuthToken();

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    fetch(`${apiBase}/public/settings`)
      .then(res => res.json())
      .then(data => {
        setDeliverySettings({
          enableEmailDelivery: data.enableEmailDelivery !== false,
          enableWhatsappDelivery: data.enableWhatsappDelivery !== false,
          customFeatureIconUrl: data.customFeatureIconUrl || '',
          enableTax: data.enableTax !== false,
          taxPercentage: data.taxPercentage !== undefined ? Number(data.taxPercentage) : 18,
          enableDeliveryCharge: data.enableDeliveryCharge !== false,
          deliveryCharge: data.deliveryCharge !== undefined ? Number(data.deliveryCharge) : 0
        });

        // Auto-select whatsapp if email is disabled and whatsapp is enabled
        if (data.enableEmailDelivery === false && data.enableWhatsappDelivery !== false) {
          setFormData(prev => ({ ...prev, deliveryMethod: 'whatsapp' }));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setFormData(prev => ({
            ...prev,
            name: data.user.name || '',
            phone: data.user.phone || '',
            line1: data.user.address?.line1 || '',
            line2: data.user.address?.line2 || '',
            city: data.user.address?.city || '',
            state: data.user.address?.state || '',
            postalCode: data.user.address?.postalCode || '',
            country: data.user.address?.country || ''
          }));
        }
      })
      .catch(console.error);
    }
  }, [isLoggedIn]);

  const handleChange = (field: keyof CheckoutData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  let tax = 0;
  if (deliverySettings.enableTax !== false) {
    tax = Number((discountedSubtotal * (deliverySettings.taxPercentage / 100)).toFixed(2));
  }

  let dCharge = 0;
  if (deliverySettings.enableDeliveryCharge !== false) {
    dCharge = deliverySettings.deliveryCharge;
  }

  const finalTotal = Number((discountedSubtotal + tax + dCharge).toFixed(2));

  async function handleApplyPromo() {
    if (!promoCode) return;
    setPromoMessage('Validating...');

    try {
      const res = await fetch(`${apiBase}/checkout/validate-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ code: promoCode })
      });

      const body = await res.json();
      if (res.ok) {
        setDiscountAmount(body.discountAmount);
        setPromoMessage(`Discount applied: ₹${body.discountAmount}`);
      } else {
        setDiscountAmount(0);
        setPromoMessage(body.message || 'Invalid coupon');
      }
    } catch {
      setDiscountAmount(0);
      setPromoMessage('Error validating coupon');
    }
  }

  async function handleNext() {
    if (step === 0 && isLoggedIn) {
      // Save profile updates before moving to step 1
      try {
        const res = await fetch(`${apiBase}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            address: {
              line1: formData.line1,
              line2: formData.line2,
              city: formData.city,
              state: formData.state,
              postalCode: formData.postalCode,
              country: formData.country
            }
          })
        });
        if (!res.ok) {
          if (res.status === 401) {
            setMessage('Your session has expired. Please log in again to save your profile.');
          } else {
            setMessage('Failed to update profile.');
          }
          return;
        }
      } catch (err) {
        console.error('Failed to update profile', err);
        setMessage('Failed to update profile due to a network error.');
        return;
      }
    }

    if (step === steps.length - 1) {
      try {
        setMessage('Processing order...');
        const res = await fetchWithAuth(`${apiBase}/checkout/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shippingAddress: {
              line1: formData.line1,
              line2: formData.line2,
              city: formData.city,
              state: formData.state,
              postalCode: formData.postalCode,
              country: formData.country
            },
            deliveryMethod: formData.deliveryMethod,
            promoCode: promoCode || undefined
          })
        });

        const data = await res.json();

        if (res.ok) {
          setMessage('Order placed successfully!');
          // Call clear local cart and redirect to order tracking
          useCartStore.getState().clearLocalCart();
          navigate(`/orders/${data.order._id}`);
        } else {
          setMessage(data.message || 'Failed to place order');
        }
      } catch (err) {
        console.error('Checkout error:', err);
        setMessage('An error occurred while placing the order.');
      }
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Checkout</h1>

      {!isLoggedIn && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md p-3 text-sm mb-4">
          <strong>Authentication Required:</strong> Please <a href="/auth/login" className="underline font-semibold">log in</a> or <a href="/auth/signup" className="underline font-semibold">create an account</a> to place an order.
        </div>
      )}

      <div className="flex gap-2">
        {steps.map((name, index) => (
          <div key={name} className={`rounded-full px-4 py-2 text-sm font-semibold ${index <= step ? 'bg-foreground hover:bg-black text-white' : 'bg-slate-200 text-slate-700'}`}>
            {index + 1}. {name}
          </div>
        ))}
      </div>
      <section className="rounded-md bg-white p-6 border border-secondary-bg">
        {step === 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3">Personal Details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Full Name" className="rounded border px-3 py-2" />
                <input value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="Phone Number" className="rounded border px-3 py-2" />
              </div>
            </div>
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-3">Shipping Address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={formData.line1} onChange={e => handleChange('line1', e.target.value)} placeholder="Address line 1" className="rounded border px-3 py-2 sm:col-span-2" />
                <input value={formData.line2} onChange={e => handleChange('line2', e.target.value)} placeholder="Address line 2 (Optional)" className="rounded border px-3 py-2 sm:col-span-2" />
                <input value={formData.city} onChange={e => handleChange('city', e.target.value)} placeholder="City" className="rounded border px-3 py-2" />
                <input value={formData.state} onChange={e => handleChange('state', e.target.value)} placeholder="State" className="rounded border px-3 py-2" />
                <input value={formData.postalCode} onChange={e => handleChange('postalCode', e.target.value)} placeholder="Postal Code" className="rounded border px-3 py-2" />
                <input value={formData.country} onChange={e => handleChange('country', e.target.value)} placeholder="Country" className="rounded border px-3 py-2" />
              </div>
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="space-y-8">
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
              <h2 className="text-lg font-semibold text-foreground mb-3">Order Summary</h2>
              <div className="space-y-3 mb-6">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3">
                    <div className="flex gap-1 shrink-0 bg-white rounded border border-slate-200 p-0.5">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="h-12 w-12 object-cover rounded" />
                      )}
                      {item.customImage && (
                        <img src={item.customImage} alt="Custom upload" className="h-12 w-12 object-contain bg-slate-100 rounded border border-dashed border-slate-300" />
                      )}
                      {item.customImage && deliverySettings.customFeatureIconUrl && (
                        <img src={deliverySettings.customFeatureIconUrl} alt="Custom feature" className="h-12 w-12 object-contain bg-slate-100 rounded border border-slate-200" title="Custom Design" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.title}</p>
                      <p className="text-xs text-slate-500">Qty: {item.quantity} × ₹{item.unitPrice}</p>
                    </div>
                    <div className="font-semibold text-sm">
                      ₹{item.quantity * item.unitPrice}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-6 pt-4 border-t border-slate-200 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold text-slate-800">₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="font-semibold">-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {deliverySettings.enableTax !== false && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax ({deliverySettings.taxPercentage}%)</span>
                    <span className="font-semibold text-slate-800">₹{tax.toFixed(2)}</span>
                  </div>
                )}
                {deliverySettings.enableDeliveryCharge !== false && deliverySettings.deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Delivery Charge</span>
                    <span className="font-semibold text-slate-800">₹{dCharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-base">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-bold text-slate-800">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2 pt-4 border-t border-slate-200">
                <h2 className="text-lg font-semibold text-foreground">Review Details</h2>
                <button onClick={() => setStep(0)} className="text-sm font-medium text-foreground hover:underline">Edit Details</button>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="font-medium text-slate-800">Name:</span> {formData.name || 'Not provided'}</p>
                <p><span className="font-medium text-slate-800">Phone:</span> {formData.phone || 'Not provided'}</p>
                <p><span className="font-medium text-slate-800">Address:</span> {formData.line1} {formData.line2 ? `, ${formData.line2}` : ''}</p>
                <p>{formData.city}, {formData.state} {formData.postalCode}</p>
                <p>{formData.country}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold mb-2">Delivery Updates</h3>
              {deliverySettings.enableEmailDelivery && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery"
                    checked={formData.deliveryMethod === 'email'}
                    onChange={() => handleChange('deliveryMethod', 'email')}
                    className="cursor-pointer"
                  />
                  Email delivery updates
                </label>
              )}
              {deliverySettings.enableWhatsappDelivery && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="delivery"
                    checked={formData.deliveryMethod === 'whatsapp'}
                    onChange={() => handleChange('deliveryMethod', 'whatsapp')}
                    className="cursor-pointer"
                  />
                  WhatsApp delivery updates
                </label>
              )}
              {!deliverySettings.enableEmailDelivery && !deliverySettings.enableWhatsappDelivery && (
                <p className="text-sm text-slate-500 italic">Delivery updates are currently disabled.</p>
              )}
            </div>

            {isLoggedIn ? (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Have a Promo Code?</h3>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="rounded border px-3 py-2 flex-grow uppercase"
                  />
                  <button
                    onClick={handleApplyPromo}
                    className="rounded bg-slate-800 text-white px-4 py-2 font-semibold hover:bg-slate-700"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && <p className={`mt-2 text-sm ${discountAmount > 0 ? 'text-foreground' : 'text-secondary-text'}`}>{promoMessage}</p>}
              </div>
            ) : (
              <div className="border-t pt-4">
                <p className="text-sm text-slate-500">Please <a href="/auth/login" className="underline text-foreground">log in</a> to apply promo codes.</p>
              </div>
            )}
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment Method</h2>
            <div className="p-4 border border-border rounded-md bg-secondary-bg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" checked readOnly className="w-4 h-4 text-foreground focus:ring-foreground" />
                <span className="font-medium text-foreground">UPI</span>
              </label>
              <p className="mt-2 text-sm text-secondary-text ml-7">
                You will be provided with a unique UPI QR code after placing the order.
              </p>
            </div>
          </div>
        ) : null}
      </section>
      <div className="flex gap-3">
        <button disabled={step === 0} onClick={() => setStep((current) => current - 1)} className="rounded border px-5 py-2 disabled:opacity-50">Back</button>
        <button disabled={!isLoggedIn && step === 0} onClick={handleNext} className="rounded bg-foreground hover:bg-black px-5 py-2 font-semibold text-white disabled:opacity-50">{step === steps.length - 1 ? 'Place Order' : 'Next'}</button>
      </div>
      {message ? <p className="rounded-md bg-white p-3 text-sm border border-secondary-bg">{message}</p> : null}
    </div>
  );
}
