// /api/chat.js

// This specifies the Vercel runtime.
export const config = {
    runtime: 'edge',
};

// The main function that handles requests.
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        // Get the message history from the request body.
        // This 'messages' array is already perfectly formatted by our frontend.
        const { messages } = await req.json();

        // Get the API key securely from Vercel's environment variables.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
        }

        // ========================= THE FIX IS HERE =========================
        // We no longer need to map or change the 'messages' array.
        // We pass it directly to the 'contents' field because our frontend
        // has already formatted it correctly for the Gemini API.
        const requestBody = {
            contents: messages, // Pass the array directly
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
        };
        // =================================================================

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${apiKey}`;

        // Call the Gemini API.
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('Google API Error:', errorText);
            // Return the actual error from Google to the frontend for better debugging.
            return new Response(errorText, { status: apiResponse.status });
        }

        // Create a transform stream to process the SSE from Google.
        const transformStream = new TransformStream({
            transform(chunk, controller) {
                const text = new TextDecoder().decode(chunk);
                const matches = text.match(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
                if (matches) {
                    const extractedText = matches
                        .map(match => {
                            try {
                                return JSON.parse('{' + match + '}').text;
                            } catch (e) {
                                return '';
                            }
                        })
                        .join('');
                    controller.enqueue(new TextEncoder().encode(extractedText));
                }
            },
        });

        // Pipe the API response through our transformer and return it to the client.
        return new Response(apiResponse.body.pipeThrough(transformStream), {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error('Serverless function error:', error);
        return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 });
    }
}