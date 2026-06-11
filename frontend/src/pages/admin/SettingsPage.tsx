import { fetchWithAuth } from "@/lib/apiClient";

import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/storage';
import { parseJwt } from '@/lib/jwt';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = getAuthToken();
  const payload = token ? parseJwt(token) : null;
  const isMasterAdmin = payload?.role === 'master_admin';

  useEffect(() => {
    if (isMasterAdmin) {
      fetchSettings();
    } else {
      setLoading(false);
      setError('Master Admin access required.');
    }
  }, [isMasterAdmin]);

  const fetchSettings = async () => {
    try {
      const res = await fetchWithAuth(`${apiBase}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const res = await fetchWithAuth(`${apiBase}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: value })
      });
      if (!res.ok) throw new Error('Failed to update setting');
      const data = await res.json();
      setSettings((prev: any) => ({ ...prev, ...data }));
      alert('Setting updated successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-secondary-text">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Platform Settings</h1>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
      <div className="rounded-lg bg-white p-6 border border-secondary-bg">
        <h2 className="text-lg font-semibold mb-4">Hero Banner</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Banner Image URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings?.heroBannerUrl || ''}
                onChange={(e) => setSettings({ ...settings, heroBannerUrl: e.target.value })}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://example.com/banner.jpg"
              />
              <button
                onClick={() => handleUpdateSetting('heroBannerUrl', settings?.heroBannerUrl)}
                className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
              >
                Save Banner
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Provide an image URL for the homepage hero banner (e.g. 9:16 or 5:4 aspect ratio).</p>
          </div>
          {settings?.heroBannerUrl && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Preview:</p>
              <img src={settings.heroBannerUrl} alt="Hero Banner Preview" className="max-w-md max-h-64 object-cover rounded border border-secondary-bg" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 border border-secondary-bg">
        <h2 className="text-lg font-semibold mb-4">Custom Feature Options</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Custom Feature Icon URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings?.customFeatureIconUrl || ''}
                onChange={(e) => setSettings({ ...settings, customFeatureIconUrl: e.target.value })}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://example.com/icon.png"
              />
              <button
                onClick={() => handleUpdateSetting('customFeatureIconUrl', settings?.customFeatureIconUrl)}
                className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
              >
                Save Icon
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Provide an image URL for the icon displayed next to custom products in the cart and checkout.</p>
          </div>
          {settings?.customFeatureIconUrl && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Preview:</p>
              <img src={settings.customFeatureIconUrl} alt="Custom Feature Icon Preview" className="h-16 w-16 object-contain rounded border border-secondary-bg" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 border border-secondary-bg">
        <h2 className="text-lg font-semibold mb-4">Delivery Options</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings?.enableEmailDelivery !== false}
              onChange={(e) => handleUpdateSetting('enableEmailDelivery', e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700">Enable Email Delivery Updates</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings?.enableWhatsappDelivery !== false}
              onChange={(e) => handleUpdateSetting('enableWhatsappDelivery', e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700">Enable WhatsApp Delivery Updates</span>
          </label>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 border border-secondary-bg md:col-span-2">
        <h2 className="text-lg font-semibold mb-4">Manual UPI Payment Configuration</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Store UPI ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings?.upiId || ''}
                  onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="merchant@upi"
                />
                <button
                  onClick={() => handleUpdateSetting('upiId', settings?.upiId)}
                  className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payee Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings?.payeeName || ''}
                  onChange={(e) => setSettings({ ...settings, payeeName: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="My Store Name"
                />
                <button
                  onClick={() => handleUpdateSetting('payeeName', settings?.payeeName)}
                  className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">QR Expiry (Minutes)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settings?.qrExpiryMinutes || 10}
                  onChange={(e) => setSettings({ ...settings, qrExpiryMinutes: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleUpdateSetting('qrExpiryMinutes', settings?.qrExpiryMinutes)}
                  className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Verification Timeout (Minutes)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settings?.verificationTimeoutMinutes || 60}
                  onChange={(e) => setSettings({ ...settings, verificationTimeoutMinutes: e.target.value })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleUpdateSetting('verificationTimeoutMinutes', settings?.verificationTimeoutMinutes)}
                  className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
                >
                  Save
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings?.enableUtrSubmission !== false}
                onChange={(e) => handleUpdateSetting('enableUtrSubmission', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">Enable Customer UTR Submission</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings?.enableScreenshotUpload !== false}
                onChange={(e) => handleUpdateSetting('enableScreenshotUpload', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">Enable Customer Screenshot Upload</span>
            </label>
          </div>
        </div>
      </div>
      </div>

      <div className="rounded-lg bg-white p-6 border border-secondary-bg md:col-span-2">
        <h2 className="text-lg font-semibold mb-4">Pricing Configuration</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Tax Settings</h3>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings?.enableTax !== false}
                onChange={(e) => handleUpdateSetting('enableTax', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">Enable Tax</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tax Percentage (%)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settings?.taxPercentage ?? 18}
                  onChange={(e) => setSettings({ ...settings, taxPercentage: Number(e.target.value) })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="18"
                />
                <button
                  onClick={() => handleUpdateSetting('taxPercentage', settings?.taxPercentage)}
                  className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800">Delivery Charge Settings</h3>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings?.enableDeliveryCharge !== false}
                onChange={(e) => handleUpdateSetting('enableDeliveryCharge', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">Enable Delivery Charge</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Charge Amount (₹)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settings?.deliveryCharge ?? 0}
                  onChange={(e) => setSettings({ ...settings, deliveryCharge: Number(e.target.value) })}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="0"
                />
                <button
                  onClick={() => handleUpdateSetting('deliveryCharge', settings?.deliveryCharge)}
                  className="rounded bg-foreground px-4 py-2 text-sm font-bold text-white hover:bg-foreground/90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 border border-secondary-bg">
        <h2 className="text-lg font-semibold mb-4">Other Configuration</h2>
        <pre className="bg-slate-50 p-4 rounded text-sm overflow-x-auto text-slate-700">
          {JSON.stringify(settings, null, 2)}
        </pre>
      </div>
    </div>
  );
}
