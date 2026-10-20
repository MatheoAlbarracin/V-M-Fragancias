export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message, catalog } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje está vacío' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
  }

  if (!catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.decants)) {
    return res.status(400).json({ error: 'Falta el catálogo. Actualizá index.html.' });
  }

  const cleanItem = (item, kind) => ({
    tipo: kind,
    nombre: String(item?.name || '').slice(0, 100),
    marca: String(item?.brand || '').slice(0, 80),
    descripcion: kind === 'sellado' ? String(item?.desc || '').slice(0, 300) : undefined,
    categoria: kind === 'sellado' ? String(item?.cat || '').slice(0, 30) : undefined,
    disponible: item?.stock === true,
    precioARS: Number.isFinite(Number(item?.priceARS)) ? Number(item.priceARS) : undefined
  });
  const catalogo = [
    ...catalog.products.slice(0, 150).map(p => cleanItem(p, 'sellado')),
    ...catalog.decants.slice(0, 150).map(d => cleanItem(d, 'decant'))
  ].filter(p => p.nombre);
  if (!catalogo.length) return res.status(400).json({ error: 'El catálogo está vacío.' });

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

    const prompt = `Sos el Sommelier Virtual de V&M Fragancias, una perfumería argentina.
El siguiente JSON es el catálogo ACTUAL de la tienda. Solo podés recomendar perfumes que aparezcan en este JSON. Los productos con disponible=false están agotados: no los ofrezcas como disponibles. Distinguí claramente los frascos sellados de los decants; un perfume puede estar agotado en sellado pero disponible como decant. Usá solo precios indicados y expresalos en pesos argentinos. No inventes productos, notas, precios ni stock. Si no hay una opción adecuada disponible, decilo y preguntá si quiere explorar otras familias olfativas. Recomendá de 1 a 3 opciones relevantes según el pedido, explicando brevemente por qué. Si la consulta pide un producto agotado, informá el estado y ofrecé alternativas disponibles del catálogo. Respondé en español argentino, claro y cálido, sin mencionar el JSON.

CATÁLOGO:
${JSON.stringify(catalogo)}

CONSULTA DEL CLIENTE:
${message.trim().slice(0, 1500)}`;
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
