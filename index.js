// Cloudflare Worker для Scoffe2
// Переменные окружения: AITUNNEL_KEY, YOOMONEY_WALLET

const ALLOWED_ORIGINS = ['http://localhost', 'http://127.0.0.1', 'null'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
      const body = await request.json();
      const apiKey = env.AITUNNEL_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'AITUNNEL_KEY not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const path = url.pathname.replace('/', '');
      
      // === AI CHAT ===
      if (path === 'ai') {
        const response = await fetch('https://api.aitunnel.ru/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body)
        });
        const data = await response.text();
        return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // === ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ ===
      if (path === 'image') {
        const response = await fetch('https://api.aitunnel.ru/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: body.model, prompt: body.prompt, n: 1, size: '1024x1024' })
        });
        const data = await response.json();
        return new Response(JSON.stringify({ image_url: data.data?.[0]?.url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // === ГЕНЕРАЦИЯ ВИДЕО ===
      if (path === 'video') {
        const response = await fetch('https://api.aitunnel.ru/v1/videos/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: body.model, prompt: body.prompt })
        });
        const data = await response.json();
        return new Response(JSON.stringify({ video_url: data.data?.[0]?.url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // === РЕРАНК ===
      if (path === 'rerank') {
        const response = await fetch('https://api.aitunnel.ru/v1/rerank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: body.model, query: body.query, documents: body.documents })
        });
        const data = await response.json();
        return new Response(JSON.stringify({ results: data.data || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // === ОПЛАТА ===
      if (path === 'pay') {
        const wallet = env.YOOMONEY_WALLET;
        if (!wallet) return new Response(JSON.stringify({ error: 'YOOMONEY_WALLET not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

        const { amount, tariff, userId } = body;
        if (!amount || !tariff || !userId) return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

        const tariffName = tariff === 'flash' ? 'Флэш' : 'Домашний';
        const label = `scoffe2_${userId}_${tariff}_${Date.now()}`;
        const params = new URLSearchParams({
          receiver: wallet, quickpay_form: 'shop', targets: `Scoffe2 — тариф ${tariffName}`,
          paymentType: 'AC', sum: amount, label: label,
          successURL: `${origin}/?payment=success&tariff=${tariff}&label=${label}`,
          need_fio: 'false', need_email: 'false', need_phone: 'false', need_address: 'false'
        });

        const paymentUrl = `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;
        return new Response(JSON.stringify({ paymentUrl, label }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
