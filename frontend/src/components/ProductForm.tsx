'use client';

import { FormEvent, useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/storage';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const apiBase = import.meta.env.VITE_API_URL || '/api';

interface ProductFormProps {
  onSuccess?: () => void;
}

export default function ProductForm({ onSuccess }: ProductFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artistName, setArtistName] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState(0);

  const [isFeatured, setIsFeatured] = useState(false);
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [minDeliveryDays, setMinDeliveryDays] = useState('');
  const [maxDeliveryDays, setMaxDeliveryDays] = useState('');

  const [categories, setCategories] = useState<{_id: string, name: string}[]>([]);
  const [brands, setBrands] = useState<{_id: string, name: string}[]>([]);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const token = getAuthToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        const [catsRes, brsRes] = await Promise.all([
          fetch(`${apiBase}/master/categories`, { headers }),
          fetch(`${apiBase}/master/brands`, { headers })
        ]);

        if (catsRes.ok) setCategories(await catsRes.json());
        if (brsRes.ok) setBrands(await brsRes.json());
      } catch (e) {
        console.error('Error fetching categories/brands', e);
      }
    }
    fetchOptions();
  }, []);
  const [stock, setStock] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [r2Key, setR2Key] = useState('');

  async function handleImageUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploadingImage(true);
    const token = getAuthToken();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'admin/product-images');

      const res = await fetch(`${apiBase}/admin/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData,
      });

      const body = await res.json();
      if (res.ok) {
        setUploadedUrl(body.url);
        setR2Key(body.key);
        setFile(null);
        setMessage(''); // Clear any previous error messages on success
      } else {
        setMessage(body.message || 'Image upload failed');
        // Do NOT setFile(null) so they can try again or see why it failed
      }
    } catch (e: any) {
      setMessage(e.message || 'Image upload failed due to network error');
    } finally {
      setUploadingImage(false);
    }
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const token = getAuthToken();
      const payload = {
        title,
        description,
        artistName,
        category,
        brand: brand || undefined,
        price,
        stock,
        images: uploadedUrl ? [uploadedUrl] : [],
        r2ImageKeys: r2Key ? [r2Key] : [],
        isFeatured,
        isCustomizable,
        minDeliveryDays: minDeliveryDays ? Number(minDeliveryDays) : undefined,
        maxDeliveryDays: maxDeliveryDays ? Number(maxDeliveryDays) : undefined,
      };

      const response = await fetch(`${apiBase}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (response.ok) {
        setMessage('Product created successfully!');
        setTitle('');
        setDescription('');
        setArtistName('');
        setCategory('');
        setBrand('');
        setPrice(0);
        setStock(0);
        setIsFeatured(false);
        setUploadedUrl('');
        setR2Key('');
        if (onSuccess) onSuccess();
      } else {
        setMessage(body.message || 'Failed to create product');
      }
    } catch {
      setMessage('Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md bg-white p-6 space-y-6">
      <h2 className="font-bold text-xl border-b pb-2">Add New Product</h2>

      {/* Image Upload Section */}
      <div className="space-y-2 border-b pb-4">
        <h3 className="font-semibold">1. Upload Product Image (Optional)</h3>
        <div className="flex gap-2 items-center">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-foreground/10 file:text-foreground hover:file:bg-foreground/20"
          />
          <button
            type="button"
            onClick={handleImageUpload}
            disabled={!file || uploadingImage}
            className="rounded bg-foreground hover:bg-black px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploadingImage ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>
        {uploadedUrl && (
          <div className="mt-2">
            <p className="text-xs text-foreground mb-1">Image uploaded successfully!</p>
            {}
            <img src={uploadedUrl} alt="Uploaded preview" className="max-h-32 rounded object-cover border" />
          </div>
        )}
      </div>

      {/* Product Form Section */}
      <form onSubmit={submitProduct} className="space-y-4">
        <h3 className="font-semibold">2. Product Details</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <div className="bg-white rounded overflow-hidden prose-sm">
            <ReactQuill theme="snow" value={description} onChange={setDescription} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Artist Name</label>
          <input type="text" required value={artistName} onChange={e => setArtistName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select required value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
              <option value="">Select a category</option>
              {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Brand (Optional)</label>
            <select value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
              <option value="">None / Unknown</option>
              {brands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Price</label>
            <input type="number" required min="0" value={price} onChange={e => setPrice(Number(e.target.value))} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stock</label>
            <input type="number" required min="0" value={stock} onChange={e => setStock(Number(e.target.value))} className="mt-1 w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Min Delivery Days</label>
            <input type="number" min="1" value={minDeliveryDays} onChange={e => setMinDeliveryDays(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. 3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Delivery Days</label>
            <input type="number" min="1" value={maxDeliveryDays} onChange={e => setMaxDeliveryDays(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. 5" />
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isFeatured" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} className="rounded border-gray-300 text-foreground focus:ring-foreground" />
            <label htmlFor="isFeatured" className="text-sm font-medium text-gray-700">Showcase on Home Page (Featured)</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isCustomizable" checked={isCustomizable} onChange={e => setIsCustomizable(e.target.checked)} className="rounded border-gray-300 text-foreground focus:ring-foreground" />
            <label htmlFor="isCustomizable" className="text-sm font-medium text-gray-700">Custom Product (Requires user image upload)</label>
          </div>
        </div>

        <button disabled={loading} className="w-full rounded bg-foreground hover:bg-black px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? 'Creating Product...' : 'Create Product'}
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-center font-medium">{message}</p>}
    </div>
  );
}
