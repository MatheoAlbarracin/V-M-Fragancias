export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { message } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'El mensaje está vacío' });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({
        error: 'Falta configurar GEMINI_API_KEY en Vercel.'
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const promptText = `Sos el Sommelier Virtual de V&M Fragancias. Asesorá brevemente en español argentino sobre los perfumes del catálogo. No inventes stock ni disponibilidad. Consulta del usuario: ${message.trim()}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptText }] }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', response.status, data);
      return res.status(502).json({
        error: data.error?.message || 'Error en la API de Gemini'
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!reply) {
      return res.status(502).json({ error: 'Gemini no devolvió una respuesta de texto.' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Sommelier API exception:', err);
    return res.status(500).json({ error: 'Error interno al consultar al sommelier.' });
  }
}
