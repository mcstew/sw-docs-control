import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function Home() {
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

  // In dev without OAuth, go straight to dashboard
  if (isDev && !oauthConfigured) {
    redirect('/dashboard');
  }

  let session;
  try {
    session = await auth();
  } catch {
    redirect('/login');
  }

  if (session?.user) {
    redirect('/dashboard');
  }

  redirect('/login');
}
