import { fetchWithAuth } from "@/lib/apiClient";
import { useEffect, useState } from "react";
import { ShoppingBag, DollarSign, Package } from "lucide-react";
import { getAuthToken } from "@/lib/storage";
import { Link } from "react-router-dom";

const apiBase = import.meta.env.VITE_API_URL || "/api";

type RecentOrder = {
  _id: string;
  total: number;
  status: string;
  createdAt: string;
  guestEmail?: string;
  userId?: {
    email: string;
  };
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    recentOrders: [] as RecentOrder[],
    revenueTimeline: [] as { date: string; revenue: number }[],
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetchWithAuth(`${apiBase}/admin/analytics`, {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        });
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch stats", e);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Dashboard Overview</h1>
        <div className="text-sm text-secondary-text bg-white px-3 py-1.5 rounded-full border border-secondary-bg">
          Real-time updates
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-md bg-white p-6 border border-secondary-bg flex items-center gap-4">
          <div className="p-3 rounded-lg bg-secondary-bg text-secondary-text">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-secondary-text">
              Total Products
            </p>
            <p className="text-2xl font-bold">
              {stats.totalProducts.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="rounded-md bg-white p-6 border border-secondary-bg flex items-center gap-4">
          <div className="p-3 rounded-lg bg-secondary-bg text-secondary-text">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-secondary-text">
              Total Orders
            </p>
            <p className="text-2xl font-bold">
              {stats.totalOrders.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="rounded-md bg-white p-6 border border-secondary-bg flex items-center gap-4">
          <div className="p-3 rounded-lg bg-foreground/10 text-foreground">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-secondary-text">
              Total Revenue
            </p>
            <p className="text-2xl font-bold">
              ₹{stats.totalRevenue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-md bg-white p-6 border border-secondary-bg h-96 flex flex-col">
          <h2 className="text-lg font-bold mb-4">Revenue Overview</h2>
          {stats.revenueTimeline && stats.revenueTimeline.length > 0 ? (
            <div className="flex-1 flex items-end gap-2 pt-4">
              {stats.revenueTimeline.map((item, idx) => {
                const maxRev = Math.max(
                  ...stats.revenueTimeline.map((i) => i.revenue),
                );
                const heightPercent =
                  maxRev > 0 ? (item.revenue / maxRev) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    <div
                      className="w-full bg-secondary-bg group-hover:bg-foreground transition-colors rounded-t-sm"
                      style={{
                        height: `${heightPercent}%`,
                        minHeight: heightPercent > 0 ? "4px" : "0",
                      }}
                    ></div>
                    <p className="text-[10px] text-secondary-text mt-2 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                      {new Date(item.date).toLocaleDateString('en-GB')}
                    </p>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-foreground text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                      ₹{item.revenue.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-secondary-text">
              No revenue data available
            </div>
          )}
        </div>

        <div className="rounded-md bg-white p-6 border border-secondary-bg h-96 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Recent Orders</h2>
            <Link
              to="/admin/orders"
              className="text-xs text-foreground hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {stats.recentOrders && stats.recentOrders.length > 0 ? (
              stats.recentOrders.map((order) => (
                <div
                  key={order._id}
                  className="border-b border-secondary-bg pb-3 last:border-0"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-sm">
                      #{order._id.slice(-6)}
                    </p>
                    <span className="text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-secondary-bg">
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-secondary-text truncate">
                    {order.guestEmail ||
                      order.userId?.email ||
                      "Unknown Customer"}
                  </p>
                  <p className="text-sm font-bold mt-1">₹{order.total}</p>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-secondary-text">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
