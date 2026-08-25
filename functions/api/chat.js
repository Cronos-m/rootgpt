// =====================================================
// ENDPOINT: POST /api/chat
// Proxy seguro hacia Groq. La API key vive en las
// variables de entorno de Cloudflare, nunca en el cliente.
// =====================================================

// PUNTO DE PERSONALIZACIÓN (para el futuro)
// Cuando quieras darle una personalidad específica a la IA,
// modifica este system prompt. Por ahora es neutro.
const SYSTEM_PROMPT = `Eres un asistente de inteligencia artificial útil, preciso y conciso.
Responde en español. Sé directo y evita preámbulos innecesarios.
Si te preguntan algo que no sabes, admítelo con honestidad.`;

const GROQ_MODEL = "llama3-8b-8192";
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