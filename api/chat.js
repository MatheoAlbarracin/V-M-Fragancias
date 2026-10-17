export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Le message ne peut pas être vide' });
  }

  const systemPrompt = `
Sos el Sommelier y Asesor Virtual de "V&M Fragancias", un emprendimiento de perfumería exclusiva en Buenos Aires, Argentina.
Tu objetivo es asesorar a los clientes de forma elegante, atenta, breve y profesional.

REGLAS DE RESPUESTA:
1. Respondé siempre en español argentino, de forma cordial, moderna y concisa (máximo 2 a 3 oraciones por respuesta).
2. Recomendá perfumes o decants del catálogo de V&M según lo que busque el cliente (notas cítricas, dulces, para salir de noche, día a día, etc.).
3. Si el cliente pregunta cómo comprar, decile que agregue los productos al carrito y toque el botón de "Pedir por WhatsApp".
4. NUNCA inventes información de contacto fuera de la web ni hables de otros temas ajenos a la perfumería o la tienda.

CATÁLOGO PRINCIPAL (Sellados y Decants 5ml):
- 9PM (Afnan): Oriental amaderado, dulce, bergamota y pachulí. Ideal para la noche y salidas.
- 9PM Elixir (Afnan): Más oscuro e intenso, oud y almizcle.
- Hawas For Him / Ice / Malibu (Rasasi): Acuáticos, frescos, marinos y frutales (menta, coco). Muy versátiles y duraderos.
- Lattafa (The Kingdom, Honor and Glory, Khamrah Qawha, Asad Bourbon, Fakhar Silver): Orientales, gourmand, dulces, especiados y versátiles.
- Al Haramain (Amber Oud Gold, Dubai Night): Ámbar, oud y notas florales/amaderadas premium.
- Odyssey (Mandarin Sky, Aqua): Cítricos, mandarina y notas marinas.
`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq Error response:', data);
      return res.status(500).json({ error: data.error?.message || 'Erreur API Groq' });
    }

    const reply = data.choices[0]?.message?.content || 'Aucune réponse générée.';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Error en API Chat:', error);
    return res.status(500).json({ error: 'Un problème est survenu lors du traitement de votre demande.' });
  }
}
