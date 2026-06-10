import { Link } from 'react-router-dom';

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">Your Account</h1>
      <p className="rounded-md bg-white p-4 border border-secondary-bg">Manage your profile, saved addresses, and order history.</p>
      <Link to="/orders" className="inline-block rounded bg-foreground hover:bg-black px-4 py-2 font-semibold text-white">View Order History</Link>
    </div>
  );
}
