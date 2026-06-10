import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiGet, Product } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

type Category = {
  _id: string;
  name: string;
  description: string;
  image?: string;
};

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [heroBannerUrl, setHeroBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [catsRes, prodsRes, settingsRes] = await Promise.all([
          apiGet<Category[]>('/products/categories'),
          apiGet<{products: Product[]}>('/products?isFeatured=true&limit=4'),
          fetch((import.meta.env.VITE_API_URL || '/api') + '/public/settings').then(res => res.ok ? res.json() : {})
        ]);
        setCategories(catsRes);
        if (prodsRes && prodsRes.products) {
          setFeaturedProducts(prodsRes.products);
        }
        const parsedSettings = settingsRes as { heroBannerUrl?: string };
        if (parsedSettings && parsedSettings.heroBannerUrl) {
          setHeroBannerUrl(parsedSettings.heroBannerUrl);
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-10 md:space-y-16 pb-10 md:pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden aspect-[2/1] w-full max-h-[70vh] flex items-center justify-center bg-secondary-bg">
        {heroBannerUrl ? (
          <div className="absolute inset-0 z-0">
            <img src={heroBannerUrl} alt="Hero Banner" className="w-full h-full object-cover object-center" loading="eager" fetchPriority="high" />
            <div className="absolute inset-0 bg-black/20"></div>
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-accent/30"></div>
        )}
        <div className="relative z-10 text-center max-w-2xl px-2 sm:px-4 flex flex-col items-center">
          <h1 className="text-2xl sm:text-3xl md:text-6xl font-heading text-foreground mb-2 md:mb-6 leading-tight">
            {heroBannerUrl ? <span className="text-white">Discover the Art of Style</span> : "Discover the Art of Style"}
          </h1>
          <p className="text-[10px] sm:text-xs md:text-base text-secondary-text mb-4 md:mb-8 max-w-md mx-auto px-4">
            {heroBannerUrl ? <span className="text-white/90">Explore our latest collection of curated pieces designed for the modern aesthetic.</span> : "Explore our latest collection of curated pieces designed for the modern aesthetic."}
          </p>
          <Link to="/products" className="inline-block border border-foreground bg-btn-bg text-btn-text px-4 py-1.5 md:px-10 md:py-3 text-[9px] md:text-sm tracking-widest uppercase transition-colors hover:bg-transparent hover:text-foreground">
            Shop Collection
          </Link>
        </div>
      </section>

      {/* Category Grid Section */}
      <section className="px-4 md:px-8 max-w-7xl mx-auto">
        <h2 className="mb-6 md:mb-8 text-xl md:text-2xl font-heading text-center">Shop by Category</h2>
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category._id}
              to={`/products?category=${encodeURIComponent(category.name)}`}
              className="group relative overflow-hidden rounded-md border border-secondary-bg aspect-square flex flex-col justify-end bg-white"
            >
              {category.image ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img src={category.image} alt={category.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-black/30"></div>
                  </div>
                  <div className="relative z-10 p-4 md:p-6">
                    <p className="text-[9px] md:text-[10px] tracking-widest uppercase text-white/80 mb-1 md:mb-2">{category.description || 'Collection'}</p>
                    <p className="text-lg md:text-xl font-heading text-white">{category.name}</p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 z-0 transition-colors group-hover:bg-secondary-bg/50">
                  <div className="p-4 md:p-6 h-full flex flex-col justify-end">
                    <p className="text-[9px] md:text-[10px] tracking-widest uppercase text-secondary-text mb-1 md:mb-2">{category.description || 'Collection'}</p>
                    <p className="text-lg md:text-xl font-heading text-foreground">{category.name}</p>
                  </div>
                </div>
              )}
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="col-span-full text-center text-secondary-text">No collections available at the moment.</p>
          )}
        </div>
      </section>

      {/* Featured Products Section */}
      {featuredProducts.length > 0 && (
        <section className="px-4 md:px-8 max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-heading">Featured Pieces</h2>
            <Link to="/products" className="text-xs md:text-sm border-b border-foreground pb-0.5 md:pb-1 hover:text-secondary-text hover:border-secondary-text transition-colors">
              View All
            </Link>
          </div>
          <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
