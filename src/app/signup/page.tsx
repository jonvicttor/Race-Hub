'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Activity } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M'); // COMEÇA COMO MASCULINO POR PADRÃO
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cria o usuário na Autenticação do Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Salva o Nickname, Gênero e a Meta padrão na tabela de Perfis
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              username: username.trim(),
              gender: gender,
              monthly_goal: 50, // Meta inicial padrão
            },
          ]);

        // Se o seu Supabase já tiver um gatilho (trigger) que cria o perfil automático,
        // a inserção acima pode dar erro de duplicidade (código 23505). 
        // Então fazemos um UPDATE de segurança:
        if (profileError && profileError.code === '23505') {
          await supabase
            .from('profiles')
            .update({ username: username.trim(), gender: gender, monthly_goal: 50 })
            .eq('id', authData.user.id);
        } else if (profileError) {
          console.error("Erro ao salvar perfil:", profileError);
        }
      }

      alert('Bem-vindo ao Pelotão! Conta criada com sucesso.');
      router.push('/profile'); // Joga o usuário direto pro perfil dele!

    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar conta. Tente novamente.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-6 font-sans flex flex-col justify-center relative overflow-hidden">
      {/* GLOW DE FUNDO PRA DAR UM ESTILO */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-race-volt/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md mx-auto relative z-10">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-race-card border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-xl shadow-race-volt/20">
            <Activity size={32} className="text-race-volt -rotate-3" />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">
            RACE <span className="text-race-volt">HUB</span>
          </h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">
            Crie sua conta e entre para o pelotão
          </p>
        </div>

        <div className="bg-race-card border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl">
          <form onSubmit={handleRegister} className="flex flex-col gap-5">
            
            {/* CAMPO DE E-MAIL */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">E-mail</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Mail size={16} />
                </span>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full bg-background border border-white/10 rounded-xl p-3 pl-12 text-white outline-none focus:border-race-volt transition-colors" 
                  placeholder="seu@email.com" 
                />
              </div>
            </div>

            {/* CAMPO DE NICKNAME */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">Nickname (Como vão te chamar)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <User size={16} />
                </span>
                <input 
                  type="text" 
                  required 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="w-full bg-background border border-white/10 rounded-xl p-3 pl-12 text-white outline-none focus:border-race-volt transition-colors uppercase font-bold" 
                  placeholder="EX: JONES" 
                />
              </div>
            </div>

            {/* SELETOR DE GÊNERO (NOVIDADE!) */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">Selecione seu Gênero</label>
              <div className="flex bg-background border border-white/10 rounded-xl p-1">
                <button 
                  type="button"
                  onClick={() => setGender('M')}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${gender === 'M' ? 'bg-race-volt text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  Masculino
                </button>
                <button 
                  type="button"
                  onClick={() => setGender('F')}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${gender === 'F' ? 'bg-race-volt text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  Feminino
                </button>
              </div>
            </div>

            {/* CAMPO DE SENHA */}
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">Senha (Mínimo 6 caracteres)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Lock size={16} />
                </span>
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-background border border-white/10 rounded-xl p-3 pl-12 text-white outline-none focus:border-race-volt transition-colors" 
                  placeholder="******" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-race-volt text-black font-black uppercase italic rounded-xl p-4 mt-2 hover:bg-opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'AQUECENDO MOTORES...' : 'CRIAR CONTA E ACELERAR'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs font-bold text-gray-500">
              Já tem as credenciais?{' '}
              <Link href="/login" className="text-race-volt hover:underline uppercase tracking-widest ml-1">
                Fazer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}