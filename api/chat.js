
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido'
    });
  }

  try {
    const { message } = req.body || {};

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'El mensaje está vacío'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        error: 'Falta configurar GEMINI_API_KEY en Vercel.'
      });
    }

    const promptText = `
Sos el Sommelier Virtual de V&M Fragancias.
Asesorá brevemente en español argentino sobre perfumes.
Respondé de manera amable y ayudá a elegir una fragancia.
Si no conocés un dato específico del catálogo, no lo inventes.

Consulta del cliente: ${message.trim()}
`;

    const model =
      process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', response.status, data);

      return res.status(502).json({
        error:
          data.error?.message ||
          'Error al consultar la API de Gemini'
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: 'Gemini no devolvió una respuesta de texto.'
      });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Sommelier API exception:', err);

    return res.status(500).json({
      error: 'Ocurrió un error interno al consultar al sommelier.'
    });
  }
}
