import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import { lazy, Suspense } from 'react';
import App from './App';

const HomePage = lazy(() => import('./pages/HomePage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const MagicLinkPage = lazy(() => import('./pages/auth/MagicLinkPage'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const CallbackPage = lazy(() => import('./pages/auth/CallbackPage'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminProductEditPage = lazy(() => import('./pages/admin/AdminProductEditPage'));
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const BrandsPage = lazy(() => import('./pages/admin/BrandsPage'));
const CouponsPage = lazy(() => import('./pages/admin/CouponsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AdminsPage = lazy(() => import('./pages/admin/AdminsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/OrdersPage'));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductPage />} />
          <Route path="about" element={<AboutPage />} />

          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />

          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="account" element={<AccountPage />} />

          <Route path="auth/login" element={<LoginPage />} />
          <Route path="auth/signup" element={<SignupPage />} />
          <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="auth/magic-link" element={<MagicLinkPage />} />
          <Route path="auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="auth/callback" element={<CallbackPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/:id" element={<AdminProductEditPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
