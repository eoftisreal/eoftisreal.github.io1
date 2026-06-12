import { fetchWithAuth } from "@/lib/apiClient";

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, FormEvent } from 'react';
import { apiGet } from '@/lib/api';
import { getAuthToken } from '@/lib/storage';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function AdminProductEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artistName, setArtistName] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState(0);
  const [compareAtPrice, setCompareAtPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [tags, setTags] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [minDeliveryDays, setMinDeliveryDays] = useState('');
  const [maxDeliveryDays, setMaxDeliveryDays] = useState('');

  // Images state (array of urls)
  const [images, setImages] = useState<string[]>([]);
  const [r2ImageKeys, setR2ImageKeys] = useState<string[]>([]);

  // Master options
  const [categories, setCategories] = useState<{_id: string, name: string}[]>([]);
  const [brands, setBrands] = useState<{_id: string, name: string}[]>([]);

  // Image Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const token = getAuthToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        const [prodRes, catsRes, brsRes] = await Promise.all([
          apiGet<any>(`/products/${id}`),
          fetchWithAuth(`${apiBase}/master/categories`, { headers }).then(r => r.json()),
          fetchWithAuth(`${apiBase}/master/brands`, { headers }).then(r => r.json())
        ]);

        if (prodRes) {
          setTitle(prodRes.title);
          setDescription(prodRes.description);
          setArtistName(prodRes.artistName);
          setCategory(prodRes.category);
          setBrand(prodRes.brand || '');
          setPrice(prodRes.price);
          setCompareAtPrice(prodRes.compareAtPrice || 0);
          setStock(prodRes.stock);
          setTags((prodRes.tags || []).join(', '));
          setIsFeatured(prodRes.isFeatured || false);
          setIsCustomizable(prodRes.isCustomizable || false);
          setMinDeliveryDays(prodRes.minDeliveryDays?.toString() || '');
          setMaxDeliveryDays(prodRes.maxDeliveryDays?.toString() || '');
          setImages(prodRes.images || []);
          setR2ImageKeys(prodRes.r2ImageKeys || []);
        }

        if (Array.isArray(catsRes)) setCategories(catsRes);
        if (Array.isArray(brsRes)) setBrands(brsRes);
      } catch (e) {
        console.error(e);
        setMessage('Failed to load product details.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  async function handleImageUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploadingImage(true);
    const token = getAuthToken();

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetchWithAuth(`${apiBase}/admin/upload`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: formData,
      });

      const body = await res.json();
      if (res.ok) {
        setImages(prev => [...prev, body.url]);
        setR2ImageKeys(prev => [...prev, body.key]);
        setFile(null);
      } else {
        alert(body.message || 'Image upload failed');
      }
    } catch (e: any) {
      alert('Image upload failed due to network error');
    } finally {
      setUploadingImage(false);
    }
  }

  function handleAddImageUrl() {
    if (!newImageUrl) return;
    setImages(prev => [...prev, newImageUrl]);
    setNewImageUrl('');
  }

  function handleRemoveImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
    // We roughly sync r2keys if possible, though r2keys might be fewer if mixed with direct URLs.
    // For simplicity, we just remove the same index from r2keys if it exists.
    setR2ImageKeys(prev => prev.filter((_, i) => i !== index));
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
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
        compareAtPrice: compareAtPrice || undefined,
        stock,
        images,
        r2ImageKeys,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        isFeatured,
        isCustomizable,
        minDeliveryDays: minDeliveryDays ? Number(minDeliveryDays) : undefined,
        maxDeliveryDays: maxDeliveryDays ? Number(maxDeliveryDays) : undefined,
      };

      const response = await fetchWithAuth(`${apiBase}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (response.ok) {
        setMessage('Product updated successfully!');
      } else {
        setMessage(body.message || 'Failed to update product');
      }
    } catch {
      setMessage('Failed to update product');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Loading product...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Edit Product</h1>
        <button onClick={() => navigate('/admin/products')} className="text-sm text-foreground hover:underline">
          &larr; Back to Products
        </button>
      </div>

      <div className="rounded-md bg-white p-6 space-y-6">

        {/* Images Section */}
        <div className="space-y-4 border-b pb-6">
          <h3 className="font-semibold text-lg">Product Images</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative group rounded border aspect-square overflow-hidden bg-slate-50">
                <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 bg-foreground text-white rounded p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mt-4 p-4 bg-slate-50 rounded">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Add Image URL (Cloudflare R2, etc)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={e => setNewImageUrl(e.target.value)}
                  className="flex-1 rounded border px-3 py-1.5 text-sm"
                  placeholder="https://..."
                />
                <button type="button" onClick={handleAddImageUrl} className="rounded bg-slate-800 text-white px-3 py-1.5 text-sm">Add</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Or Upload File</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="text-sm text-slate-500 w-full file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-foreground/10 file:text-foreground"
                />
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={!file || uploadingImage}
                  className="rounded bg-foreground hover:bg-black px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {uploadingImage ? '...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Form */}
        <form onSubmit={submitProduct} className="space-y-4">
          <h3 className="font-semibold text-lg">Product Details</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Artist Name</label>
              <input type="text" required value={artistName} onChange={e => setArtistName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <div className="bg-white rounded overflow-hidden prose-sm">
              <ReactQuill theme="snow" value={description} onChange={setDescription} />
            </div>
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
              <label className="block text-sm font-medium text-gray-700">Brand</label>
              <select value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                <option value="">None / Unknown</option>
                {brands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Price (₹)</label>
              <input type="number" required min="0" value={price} onChange={e => setPrice(Number(e.target.value))} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Compare At Price (₹)</label>
              <input type="number" min="0" value={compareAtPrice} onChange={e => setCompareAtPrice(Number(e.target.value))} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock</label>
              <input type="number" required min="0" value={stock} onChange={e => setStock(Number(e.target.value))} className="mt-1 w-full rounded border px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tags (comma separated, e.g. "20% OFF, Bestseller")</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. 20% OFF, New Arrival" />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Min Delivery Days</label>
              <input type="number" min="1" value={minDeliveryDays} onChange={e => setMinDeliveryDays(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. 3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Delivery Days</label>
              <input type="number" min="1" value={maxDeliveryDays} onChange={e => setMaxDeliveryDays(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. 5" />
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isFeaturedEdit" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} className="rounded border-gray-300 text-foreground focus:ring-foreground" />
              <label htmlFor="isFeaturedEdit" className="text-sm font-medium text-gray-700">Showcase on Home Page (Featured)</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isCustomizableEdit" checked={isCustomizable} onChange={e => setIsCustomizable(e.target.checked)} className="rounded border-gray-300 text-foreground focus:ring-foreground" />
              <label htmlFor="isCustomizableEdit" className="text-sm font-medium text-gray-700">Custom Product (Requires user image upload)</label>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button disabled={submitting} className="w-full rounded bg-foreground hover:bg-black px-4 py-3 font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            {message && <p className="mt-3 text-sm text-center font-medium text-foreground">{message}</p>}
          </div>
        </form>

      </div>
    </div>
  );
}
