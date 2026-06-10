'use client';

import { useEffect, useState, Suspense } from 'react';
import { apiGet, Product } from '@/lib/api';
import ProductGrid from '@/components/ProductGrid';
import { useSearchParams } from 'react-router-dom';

type ProductResponse = {
  products: Product[];
  page: number;
  totalPages: number;
};

function ProductListingContent() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q');
  const category = searchParams.get('category');
  const brand = searchParams.get('brand');
  const pageParam = searchParams.get('page');

  const [data, setData] = useState<ProductResponse>({ products: [], page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<{_id: string, name: string}[]>([]);
  const [brands, setBrands] = useState<{_id: string, name: string}[]>([]);

  useEffect(() => {
    async function fetchFilters() {
      try {
        const [cats, brs] = await Promise.all([
          apiGet<{_id: string, name: string}[]>('/products/categories'),
          apiGet<{_id: string, name: string}[]>('/products/brands')
        ]);
        setCategories(cats);
        setBrands(brs);
      } catch (e) {
        console.error('Failed to load filters', e);
      }
    }
    fetchFilters();
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchProducts() {
      const query = new URLSearchParams();
      if (q) query.set('q', q);
      if (category) query.set('category', category);
      if (brand) query.set('brand', brand);
      if (pageParam) query.set('page', pageParam);

      try {
        const res = await apiGet<ProductResponse>(`/products?${query.toString()}`);
        if (active) setData(res);
      } catch {
        if (active) setData({ products: [], page: 1, totalPages: 1 });
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProducts();

    return () => {
      active = false;
    };
  }, [q, category, pageParam]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Explore Products</h1>
      <form className="grid gap-3 rounded-md bg-white p-4 sm:grid-cols-4">
        <input name="q" defaultValue={q || ''} placeholder="Search artwork" className="rounded-lg border px-3 py-2" />
        <select name="category" defaultValue={category || ''} className="rounded-lg border px-3 py-2">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
        </select>
        <select name="brand" defaultValue={brand || ''} className="rounded-lg border px-3 py-2">
          <option value="">All Brands</option>
          {brands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
        </select>
        <button className="rounded-lg bg-foreground hover:bg-black px-4 py-2 font-semibold text-white">Apply Filters</button>
      </form>
      {loading ? (
        <p>Loading products...</p>
      ) : (
        <>
          <ProductGrid products={data.products} />
          <p className="text-sm text-slate-500">Page {data.page} of {data.totalPages}</p>
        </>
      )}
    </div>
  );
}

export default function ProductListing() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ProductListingContent />
    </Suspense>
  );
}
