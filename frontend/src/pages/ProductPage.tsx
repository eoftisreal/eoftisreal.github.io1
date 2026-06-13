'use client';

import { useEffect, useState } from 'react';
import { apiGet, Product } from '@/lib/api';
import AddToCartButton from '@/components/AddToCartButton';
import { X, Check } from 'lucide-react';
import { getAuthToken } from '@/lib/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const apiBase = import.meta.env.VITE_API_URL || '/api';

import { useParams } from 'react-router-dom';

export default function ProductDetailPage() {
  const { id } = useParams();
  if (!id) return <p>Invalid product</p>;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string>('');

  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string>('');
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');

  useEffect(() => {
    let active = true;

    async function fetchProduct() {
      try {
        const data = await apiGet<Product>(`/products/${id}`);
        if (active) {
          setProduct(data);
          if (data.images && data.images.length > 0) {
            setActiveImage(data.images[0]);
          }
        }
      } catch {
        if (active) setProduct(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProduct();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Loading product...</p>;
  }

  if (!product) {
    return <p className="rounded-md bg-white p-6 border border-secondary-bg">Product not found.</p>;
  }

  const handleCustomImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomImageFile(file);
      setCustomImagePreview(URL.createObjectURL(file));
      setCustomImageUrl('');
    }
  };

  const handleCustomUploadConfirm = async () => {
    if (!customImageFile) return;
    setUploadingCustom(true);

    const formData = new FormData();
    formData.append('file', customImageFile);
    formData.append('folder', 'customers/product-images');

    try {
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/products/upload-custom`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCustomImageUrl(data.url);
      } else {
        alert(data.message || 'Image upload failed');
      }
    } catch (err) {
      alert('Upload failed due to network error');
    } finally {
      setUploadingCustom(false);
    }
  };

  const handleCustomUploadCancel = () => {
    setCustomImageFile(null);
    setCustomImagePreview('');
    setCustomImageUrl('');
  };

  const gallery = product.images.length > 0 ? product.images : ['https://placehold.co/300x300?text=Preview'];
  const currentImage = activeImage || gallery[0] || 'https://placehold.co/700x700?text=Art';

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4 overflow-hidden">
        <img src={currentImage} alt={product.title} className="aspect-square w-full rounded-md object-cover" />
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {gallery.map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={image || 'https://placehold.co/300x300?text=Preview'}
              alt={`${product.title} preview ${index + 1}`}
              onClick={() => setActiveImage(image)}
              className={`aspect-square w-24 shrink-0 cursor-pointer rounded-lg object-cover border-2 transition-all ${activeImage === image ? 'border-foreground' : 'border-transparent hover:border-slate-300'}`}
            />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-black">{product.title}</h1>
        <p className="text-slate-600">By {product.artistName}</p>

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {product.tags.map((tag: string, idx: number) => (
              <span key={idx} className="bg-foreground text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ">
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="text-2xl font-bold">₹{product.price}</p>
        <div className="prose prose-sm prose-slate max-w-none prose-headings:font-heading prose-headings:font-bold prose-a:text-blue-600">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {product.description}
          </ReactMarkdown>
        </div>
        <p className="text-sm text-slate-500">Stock: {product.stock}</p>

        {product.minDeliveryDays && product.maxDeliveryDays && (
          <p className="text-sm font-medium text-foreground bg-secondary-bg px-3 py-2 rounded-md border border-border inline-block">
            🚚 Deliver in {product.minDeliveryDays} to {product.maxDeliveryDays} days
          </p>
        )}

        {product.isCustomizable ? (
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-bold">Customize Product</h3>
            {!customImagePreview ? (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                <p className="text-sm text-slate-600 mb-2">Upload an image to customize this product</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageSelect}
                  className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-foreground file:text-white hover:file:bg-black cursor-pointer w-full max-w-xs mx-auto block"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block border rounded p-1 bg-white">
                  <img src={customImagePreview} alt="Custom design preview" className="h-40 w-auto object-contain rounded" />
                  {!customImageUrl && (
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button
                        onClick={handleCustomUploadCancel}
                        className="p-1.5 bg-white text-foreground rounded-full shadow hover:bg-secondary-bg transition-colors"
                        title="Discard Image"
                        disabled={uploadingCustom}
                      >
                        <X size={18} />
                      </button>
                      <button
                        onClick={handleCustomUploadConfirm}
                        className="p-1.5 bg-foreground text-white rounded-full shadow hover:bg-black transition-colors"
                        title="Confirm Image"
                        disabled={uploadingCustom}
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  )}
                  {uploadingCustom && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded">
                      <p className="font-semibold text-sm">Uploading...</p>
                    </div>
                  )}
                </div>
                {customImageUrl && (
                  <div className="text-foreground text-sm font-semibold flex items-center gap-1">
                    <Check size={16} /> Image confirmed!
                  </div>
                )}
              </div>
            )}

            {customImageUrl && (
              <div className="pt-2">
                <AddToCartButton productId={product._id} title={product.title} price={product.price} image={product.images?.[0]} customImage={customImageUrl} />
              </div>
            )}
          </div>
        ) : (
          <div className="pt-4 border-t border-border">
            <AddToCartButton productId={product._id} title={product.title} price={product.price} image={product.images?.[0]} />
          </div>
        )}

      </div>
    </div>
  );
}
