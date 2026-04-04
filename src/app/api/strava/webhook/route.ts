import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Senha nossa para o Strava provar que é ele mesmo
const VERIFY_TOKEN = 'racehub_strava_webhook_secret_2026';

// 🚨 O Webhook roda sem o usuário logado, então precisamos da chave "Service Role" (Admin)
// para conseguir salvar a corrida no banco passando pela segurança (RLS).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAdminKey);

// ==========================================
// ROTA GET: Usada só 1 vez para validar o Webhook
// ==========================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('🟢 Strava Webhook Validado com Sucesso!');
    return NextResponse.json({ 'hub.challenge': challenge });
  }
  return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
}

// ==========================================
// ROTA POST: Recebe o aviso toda vez que alguém corre
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('🚨 Alerta do Strava Recebido:', body);

    // Só queremos processar se for uma ATIVIDADE NOVA sendo CRIADA
    if (body.object_type === 'activity' && body.aspect_type === 'create') {
      const athleteId = String(body.owner_id);
      const activityId = body.object_id;

      // 1. Busca quem é o dono dessa atividade no nosso banco
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('strava_athlete_id', athleteId)
        .single();

      if (profile) {
        let currentAccessToken = profile.strava_access_token;
        const nowInSeconds = Math.floor(Date.now() / 1000);

        // 2. Verifica se o token expirou e renova invisivelmente
        if (profile.strava_expires_at && (profile.strava_expires_at - 60) < nowInSeconds) {
          const refreshRes = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: 220016, 
              client_secret: 'ff187c140ae7d513c5e8e297da714062879305ec', 
              grant_type: 'refresh_token',
              refresh_token: profile.strava_refresh_token
            })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            currentAccessToken = refreshData.access_token;
            
            await supabase.from('profiles').update({
              strava_access_token: refreshData.access_token,
              strava_refresh_token: refreshData.refresh_token,
              strava_expires_at: refreshData.expires_at
            }).eq('id', profile.id);
          }
        }

        // 3. Puxa os dados completos da corrida lá do Strava
        const actRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
          headers: { Authorization: `Bearer ${currentAccessToken}` }
        });

        if (actRes.ok) {
          const act = await actRes.json();

          // 4. Se for Corrida, formata e joga pro Feed!
          if (act.type === 'Run') {
            const dateStr = act.start_date_local.split('T')[0];
            const isRace = act.workout_type === 1;
            const definedActivityType = isRace ? 'prova' : 'treino';

            const distKm = (act.distance / 1000).toFixed(2);
            const timeSec = act.moving_time;
            const hrs = Math.floor(timeSec / 3600);
            const mins = Math.floor((timeSec % 3600) / 60);
            const secs = timeSec % 60;
            const timeStr = hrs > 0 
              ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
              : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            const speedMps = act.average_speed;
            let paceStr = '00:00';
            if (speedMps > 0) {
              const paceMinDec = (1000 / speedMps) / 60;
              const paceMin = Math.floor(paceMinDec);
              const paceSec = Math.floor((paceMinDec - paceMin) * 60);
              paceStr = `${paceMin.toString().padStart(2, '0')}:${paceSec.toString().padStart(2, '0')}`;
            }

            // Verifica se já não salvamos isso hoje (anti-bug)
            const { data: existingRace } = await supabase
              .from('races')
              .select('id')
              .eq('user_id', profile.id)
              .eq('name', act.name)
              .eq('date', dateStr)
              .single();

            if (!existingRace) {
              await supabase.from('races').insert({
                user_id: profile.id,
                name: act.name,
                date: dateStr,
                distance: distKm,
                finish_time: timeStr,
                pace: paceStr,
                status: 'Concluído',
                activity_type: definedActivityType,
                event_location: 'Sincronizado Auto', // Marcador pra gente saber que foi o bot
                map_polyline: act.map?.summary_polyline || null
              });
              console.log(`✅ [Webhook] Corrida "${act.name}" salva para ${profile.username}!`);
            }
          }
        }
      }
    }

    // O Strava exige que você diga "OK" em menos de 2 segundos, se não ele cancela.
    return NextResponse.json({ message: 'EVENT_RECEIVED' }, { status: 200 });
  } catch (error) {
    console.error('❌ Erro Crítico no Webhook:', error);
    return NextResponse.json({ error: 'Erro Interno' }, { status: 500 });
  }
}