'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, Mail, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('username')
          .ilike('username', username) 
          .single();

        if (existingUser) {
          throw new Error('Esse username já está sendo usado por outro atleta. Escolha outro.');
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username, full_name: username },
            // A MÁGICA DO REDIRECIONAMENTO AQUI 👇
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
        alert('Verifique seu e-mail para confirmar o cadastro!');

      } else {
        let loginEmail = emailOrUsername.trim();

        if (!loginEmail.includes('@')) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('email') 
            .ilike('username', loginEmail)
            .single();

          if (profileError || !profileData) {
            throw new Error('Usuário não encontrado. Se tiver dúvidas, use seu e-mail.');
          }
          
          loginEmail = profileData.email;
        }

        const { error } = await supabase.auth.signInWithPassword({ 
          email: loginEmail, 
          password 
        });
        
        if (error) throw error;
        router.push('/'); 
      }
    } catch (error: unknown) { 
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-race-volt p-4 rounded-2xl mb-4 text-black rotate-3 shadow-lg shadow-race-volt/20">
            <Trophy size={40} strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-center">
            Race <span className="text-race-volt">Hub</span>
          </h1>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-2 text-center">
            {isSignUp ? 'Crie sua conta no Squad' : 'Acesse seu Dashboard'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {isSignUp && (
            <>
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-500" size={20} />
                <input 
                  type="text" placeholder="Escolha um Nickname" required
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-race-card border border-white/10 rounded-xl p-3 pl-10 text-white outline-none focus:border-race-volt transition-all"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-500" size={20} />
                <input 
                  type="email" placeholder="Seu E-mail" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-race-card border border-white/10 rounded-xl p-3 pl-10 text-white outline-none focus:border-race-volt transition-all"
                />
              </div>
            </>
          )}

          {!isSignUp && (
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-500" size={20} />
              <input 
                type="text" placeholder="E-mail ou Username" required
                value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)}
                className="w-full bg-race-card border border-white/10 rounded-xl p-3 pl-10 text-white outline-none focus:border-race-volt transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-500" size={20} />
            <input 
              type="password" placeholder="Senha" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-race-card border border-white/10 rounded-xl p-3 pl-10 text-white outline-none focus:border-race-volt transition-all"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 mt-4 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-race-volt/20"
          >
            {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar na Pista'}
          </button>
        </form>

        <button 
          onClick={() => {
            setIsSignUp(!isSignUp);
            setEmailOrUsername('');
            setEmail('');
            setUsername('');
            setPassword('');
          }}
          className="w-full text-center mt-8 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-race-volt transition-colors"
        >
          {isSignUp ? 'Já tem conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
    </main>
  );
}