export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'El mensaje está vacío' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
    }

    const promptText = `Sos el Sommelier Virtual de V&M Fragancias. Asesorá brevemente en español argentino sobre los perfumes del catálogo. Usuario dice: ${message}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey.trim()}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error en la API de Gemini' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: `Exception: ${err.message}` });
  }
}
