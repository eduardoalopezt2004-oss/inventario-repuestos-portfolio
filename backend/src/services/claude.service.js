const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `Eres un asistente especializado en extraer datos de listas de precios de proveedores de repuestos automotrices y lubricantes.
Extrae TODOS los productos y retorna un JSON array con los campos:
"codigo", "nombre", "descripcion", "marca", "modelo", "precioCompra", "stock".
Retorna ÚNICAMENTE el JSON array válido, sin markdown, sin explicaciones.`;

/**
 * @param {{ type: 'image'|'document'|'text', data?: string, mediaType?: string, text?: string }} options
 * @returns {Promise<Array>}
 */
async function extractProductsFromContent({ type, data, mediaType, text }) {
  let contentBlock;

  if (type === 'image') {
    contentBlock = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data
        }
      },
      {
        type: 'text',
        text: 'Extrae todos los productos de esta lista de precios.'
      }
    ];
  } else if (type === 'document') {
    contentBlock = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data
        }
      },
      {
        type: 'text',
        text: 'Extrae todos los productos de esta lista de precios.'
      }
    ];
  } else {
    contentBlock = [
      {
        type: 'text',
        text: `Extrae todos los productos de la siguiente lista de precios:\n\n${text}`
      }
    ];
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: contentBlock
      }
    ]
  });

  const raw = response.content[0].text.trim();

  // Intentar parsear el JSON directamente o extraerlo si viene entre corchetes
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Claude no devolvió un JSON válido: ' + raw.substring(0, 200));
  }
}

module.exports = { extractProductsFromContent };
