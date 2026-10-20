export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje está vacío' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
  }

  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

  try {
    // Consultamos los modelos realmente disponibles para esta clave.
    let models = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ pageSize: '1000' });
      if (pageToken) params.set('pageToken', pageToken);
      const listResponse = await fetch(`${baseUrl}/models?${params}`, { headers });
      const listData = await listResponse.json();
      if (!listResponse.ok) {
        console.error('Gemini ListModels:', listResponse.status, listData);
        return res.status(502).json({ error: listData.error?.message || 'No se pudieron consultar los modelos de Gemini.' });
      }
      models.push(...(listData.models || []));
      pageToken = listData.nextPageToken;
    } while (pageToken);

    const available = models.filter(m =>
      m.name?.startsWith('models/gemini-') &&
      m.supportedGenerationMethods?.includes('generateContent') &&
      !/embedding|image|tts|audio|robotics|computer-use/i.test(m.name)
    );

    const preferred = process.env.GEMINI_MODEL?.trim().replace(/^models\//, '');
    const candidates = available.sort((a, b) => {
      const rank = m => {
        const name = m.name.replace(/^models\//, '');
        if (preferred && name === preferred) return -100;
        if (/flash/i.test(name) && !/preview|exp|lite/i.test(name)) return 0;
        if (/flash-lite/i.test(name) && !/preview|exp/i.test(name)) return 1;
        if (/flash/i.test(name)) return 2;
        if (/pro/i.test(name)) return 3;
        return 4;
      };
      return rank(a) - rank(b);
    });

    if (!candidates.length) {
      return res.status(502).json({ error: 'Tu API Key no tiene modelos de texto disponibles para generateContent.' });
    }

    const prompt = `Sos el Sommelier Virtual de V&M Fragancias. Respondé de forma breve y clara en español argentino sobre perfumes. No inventes stock, precios ni disponibilidad. Consulta: ${message.trim()}`;
    let lastError = 'No se pudo generar una respuesta.';

    for (const model of candidates.slice(0, 5)) {
      const response = await fetch(`${baseUrl}/${model.name}:generateContent`, {
        method: 'POST', headers,
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      if (response.ok) {
        const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
        if (reply) return res.status(200).json({ reply });
        lastError = 'Gemini no devolvió texto.';
      } else {
        console.error(`Gemini ${model.name}:`, response.status, data);
        lastError = data.error?.message || `Error HTTP ${response.status}`;
        // No probar otros modelos si la clave es inválida o se agotó la cuota.
        if ([401, 403, 429].includes(response.status)) break;
      }
    }
    return res.status(502).json({ error: lastError });
  } catch (err) {
    console.error('Sommelier API:', err);
    return res.status(500).json({ error: 'No se pudo conectar con Gemini.' });
  }
}
