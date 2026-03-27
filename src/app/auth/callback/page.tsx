'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        router.push('/');
      }
    });

    const timeout = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 border-4 border-race-volt border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-xl font-black uppercase italic tracking-widest text-white">
        Validando <span className="text-race-volt">Acesso...</span>
      </h1>
      <p className="text-xs text-gray-500 uppercase font-bold mt-2">Preparando sua credencial do Squad</p>
    </main>
  );
}