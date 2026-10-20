export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'El mensaje está vacío' });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Falta configurar GROQ_API_KEY en Vercel.' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Sos el Sommelier Virtual de V&M Fragancias. Asesorá brevemente en español argentino sobre los perfumes del catálogo.'
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error en Groq' });
    }

    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || 'Sin respuesta' });

  } catch (err) {
    return res.status(500).json({ error: `Exception: ${err.message}` });
  }
}
