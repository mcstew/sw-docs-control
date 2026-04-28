import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch {
    // Auth provider not configured — fall through
  }

  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

  if (!session?.user && !(isDev && !oauthConfigured)) {
    redirect('/login');
  }

  const user = session?.user ?? { email: 'dev@sudowrite.com', name: 'Dev User' };

  return (
    <div className="min-h-screen bg-[#0a0f14] text-slate-300 font-sans p-4 md:p-6">
      {children}
    </div>
  );
}
