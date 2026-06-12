import { useEffect, useState, Fragment } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

const apiBase = import.meta.env.VITE_API_URL || '/api';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetchWithAuth(`${apiBase}/orders`);
        if (res.ok) {
          setOrders(await res.json());
        }
      } catch (e) {
        console.error('Failed to fetch orders', e);
      }
    }
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    const matchSearch = o._id.toLowerCase().includes(term) ||
                        (o.guestEmail && o.guestEmail.toLowerCase().includes(term)) ||
                        (o.userId && o.userId.email && o.userId.email.toLowerCase().includes(term));
    const matchStatus = statusFilter === '' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Manage Orders</h1>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-md border border-secondary-bg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text w-4 h-4" />
          <input
            type="text"
            placeholder="Search by Order ID or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded text-sm focus:outline-none focus:border-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-border rounded px-4 py-2 text-sm focus:outline-none focus:border-foreground bg-white sm:w-48"
        >
          <option value="">All Statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="awaiting_verification">Awaiting Verification</option>
          <option value="payment_verified">Payment Verified</option>
          <option value="rejected">Rejected</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-md border border-secondary-bg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary-bg">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expected Amount</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-bg">
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <Fragment key={order._id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandedRowId(expandedRowId === order._id ? null : order._id)}
                          className="text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {expandedRowId === order._id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">#{order._id.slice(-6)}</td>
                    <td className="px-4 py-3 text-secondary-text">
                      {new Date(order.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-secondary-text">
                      {order.guestEmail || (order.userId && order.userId.email) || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded border border-border bg-secondary-bg text-secondary-text">
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      ₹{order.uniquePaymentAmount?.toFixed(2) || order.total}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-text">
                      {order.utr && <div>UTR: {order.utr}</div>}
                      {order.screenshotUrl && <div><a href={order.screenshotUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">View Screenshot</a></div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {order.status === 'awaiting_verification' && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetchWithAuth(`${apiBase}/admin/orders/${order._id}/approve`, {
                                  method: 'POST'
                                });
                                if (res.ok) {
                                  setOrders(orders.map(o => o._id === order._id ? { ...o, status: 'payment_verified' } : o));
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="rounded bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetchWithAuth(`${apiBase}/admin/orders/${order._id}/reject`, {
                                  method: 'POST'
                                });
                                if (res.ok) {
                                  setOrders(orders.map(o => o._id === order._id ? { ...o, status: 'rejected' } : o));
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedRowId === order._id && order.items && order.items.length > 0 && (
                    <tr className="bg-slate-50 border-t border-slate-100">
                      <td colSpan={8} className="px-10 py-4">
                        <div className="text-xs font-semibold text-slate-500 mb-2">Order Items:</div>
                        <div className="space-y-3">
                          {order.items.map((item: any, idx: number) => {
                            const imageUrl = item.image || (typeof item.productId === 'object' && item.productId?.images?.[0]) || '';
                            return (
                              <div key={idx} className="flex items-center gap-4">
                                <div className="flex gap-2 shrink-0 bg-white rounded border border-slate-200 p-1">
                                  {imageUrl && (
                                    <img src={imageUrl} alt={item.title} className="h-16 w-16 object-cover rounded" />
                                  )}
                                  {item.customImage && (
                                    <img src={item.customImage} alt="Custom upload" className="h-16 w-16 object-contain bg-slate-100 rounded border border-dashed border-slate-300" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-800">{item.title}</div>
                                  <div className="text-slate-500 mt-1">
                                    Qty: {item.quantity} &times; ₹{item.unitPrice} = <span className="font-medium text-slate-700">₹{item.quantity * item.unitPrice}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-secondary-text">
                    No orders found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
