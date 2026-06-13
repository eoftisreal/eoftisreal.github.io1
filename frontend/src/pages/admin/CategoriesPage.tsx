import { fetchWithAuth } from "@/lib/apiClient";

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/storage';
import { Plus, Trash2 } from 'lucide-react';

const apiBase = import.meta.env.VITE_API_URL || '/api';

type Category = {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  image?: string;
  r2ImageKey?: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [r2Key, setR2Key] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetchWithAuth(`${apiBase}/master/categories`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  async function handleImageUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploadingImage(true);
    const token = getAuthToken();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'admin/category-images');

      const res = await fetchWithAuth(`${apiBase}/admin/upload`, {
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
      } else {
        alert(body.message || 'Image upload failed');
      }
    } catch (e: any) {
      alert(e.message || 'Image upload failed due to network error');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingId ? `${apiBase}/master/categories/${editingId}` : `${apiBase}/master/categories`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          name,
          description,
          image: uploadedUrl || undefined,
          r2ImageKey: r2Key || undefined
        })
      });
      if (res.ok) {
        resetForm();
        fetchCategories();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(cat: Category) {
    setEditingId(cat._id);
    setName(cat.name);
    setDescription(cat.description || '');
    setUploadedUrl(cat.image || '');
    setR2Key(cat.r2ImageKey || '');
    window.scrollTo(0, 0);
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setUploadedUrl('');
    setR2Key('');
    setFile(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return;
    try {
      const res = await fetchWithAuth(`${apiBase}/master/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (res.ok) fetchCategories();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Categories Master</h1>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        <div className="md:col-span-1 rounded-md bg-white p-6 border border-secondary-bg">
          <h2 className="font-bold text-lg mb-4">{editingId ? 'Edit Category' : 'Add Category'}</h2>
          <div className="space-y-2 border-b pb-4 mb-4">
            <h3 className="text-sm font-medium text-slate-700">Category Background Image (Optional)</h3>
            <div className="mb-2">
              <label className="block text-xs text-slate-500 mb-1">Image URL (from Cloudflare R2 or other)</label>
              <input
                type="url"
                value={uploadedUrl}
                onChange={(e) => {
                  setUploadedUrl(e.target.value);
                  if (e.target.value === '') setR2Key(''); // Clear r2key if URL is cleared manually
                }}
                placeholder="https://..."
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="text-xs font-bold text-slate-400 text-center my-2">OR UPLOAD FILE</div>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="text-sm text-slate-500 w-full mb-2 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-foreground/10 file:text-foreground hover:file:bg-foreground/20"
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
                <img src={uploadedUrl} alt="Uploaded preview" className="max-h-24 rounded object-cover border" />
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <button disabled={loading} className="w-full flex justify-center items-center gap-2 rounded-md bg-foreground hover:bg-black px-4 py-2 font-semibold text-white disabled:opacity-50">
                <Plus className="w-4 h-4" /> {editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="w-full rounded-md bg-slate-200 hover:bg-slate-300 px-4 py-2 font-semibold text-slate-700">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="md:col-span-2 rounded-md bg-white p-6 border border-secondary-bg">
          <h2 className="font-bold text-lg mb-4">Existing Categories</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Image</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">No categories found.</td></tr>
                ) : categories.map(cat => (
                  <tr key={cat._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                    <td className="px-4 py-3 text-slate-500">{cat.description || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEdit(cat)} className="text-foreground hover:underline p-1 mr-2 text-sm font-medium">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(cat._id)} className="text-secondary-text hover:text-foreground p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
