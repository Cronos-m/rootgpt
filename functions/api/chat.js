// =====================================================
// ENDPOINT: POST /api/chat
// Proxy seguro hacia Groq. La API key vive en las
// variables de entorno de Cloudflare, nunca en el cliente.
// =====================================================

// PUNTO DE PERSONALIZACIÓN
// Este system prompt define el formato y el tono de la IA.
// Reglas clave: texto plano (sin Markdown) y respuestas breves
// y conversacionales, adecuadas para un chat en vivo.
const SYSTEM_PROMPT = `Eres la IA conversacional de RootGPT, un chat con estética de ChatGPT que se usa en espectáculos de magia.
Responde siguiendo estrictamente estas reglas de formato y estilo:
1. Texto plano absoluto: prohibido usar Markdown. Nada de asteriscos, guiones bajos, almohadillas, viñetas con símbolos, encabezados ni enlaces entre corchetes.
2. No construyas listas con guiones o asteriscos. Si debes enumerar algo, hazlo dentro de la frase, con comas o con números seguidos de punto.
3. Sé breve y conversacional: entre 2 y 5 frases, como si hablaras con un amigo, no como una enciclopedia ni una ficha técnica.
4. Solo extiéndete con detalles si el usuario te lo pide explícitamente.
5. Responde siempre en español, con tono natural, cercano y seguro.`;

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Preflight CORS (necesario para peticiones desde el navegador)
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}

export async function onRequestPost(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
    };

    // 1. Verificar que la API key esté configurada
    const apiKey = context.env.GROQ_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: "GROQ_API_KEY no está configurada en Cloudflare" }),
            { status: 500, headers: corsHeaders }
        );
    }

    // 2. Leer el cuerpo de la petición
    let body;
    try {
        body = await context.request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: "JSON inválido" }),
            { status: 400, headers: corsHeaders }
        );
    }

    const userMessage = (body.message || "").toString().trim();
    if (!userMessage) {
        return new Response(
            JSON.stringify({ error: "Campo 'message' vacío" }),
            { status: 400, headers: corsHeaders }
        );
    }

    // 3. Llamar a Groq
    try {
        const groqResponse = await fetch(GROQ_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.7,
            }),
        });

        if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            console.error("Groq error:", groqResponse.status, errText);
            return new Response(
                JSON.stringify({ error: `Groq respondió ${groqResponse.status}`, detail: errText }),
                { status: 502, headers: corsHeaders }
            );
        }

        const data = await groqResponse.json();
        const reply = data.choices?.[0]?.message?.content || "Sin respuesta del modelo.";

        return new Response(
            JSON.stringify({ reply }),
            { status: 200, headers: corsHeaders }
        );
    } catch (err) {
        console.error("Error en fetch a Groq:", err);
        return new Response(
            JSON.stringify({ error: "Error de red al contactar a Groq" }),
            { status: 500, headers: corsHeaders }
        );
    }
}