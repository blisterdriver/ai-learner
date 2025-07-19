// /api/chat.js

// This specifies the Vercel runtime.
export const config = {
    runtime: 'edge',
};

// The main function that handles requests.
export default async function handler(req) {
    // 1. Check if this is a POST request.
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        // 2. Get the message history from the request body.
        const { messages } = await req.json();

        // 3. Get the API key securely from Vercel's environment variables.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
        }

        // 4. Prepare the request for the Gemini API.
        // We use the 'flash' model as requested.
        // The format is specific to Google's Generative Language API.
        // Note: Gemini alternates between 'user' and 'model' roles.
        const requestBody = {
            contents: messages.map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            })),
            generationConfig: {
                // Configuration for the model's output
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            },
        };

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${apiKey}`;

        // 5. Call the Gemini API.
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!apiResponse.ok) {
            // If the API returns an error, forward it to the client.
            const errorText = await apiResponse.text();
            console.error('Google API Error:', errorText);
            return new Response(errorText, { status: apiResponse.status });
        }

        // 6. Create a transform stream to process the SSE (Server-Sent Events) from Google.
        // Google's streaming API sends data in a specific JSON format. We need to parse it
        // and extract just the text content to send back to our frontend.
        const transformStream = new TransformStream({
            transform(chunk, controller) {
                const text = new TextDecoder().decode(chunk);
                // The response is a stream of JSON objects. We look for the "text" field.
                // A simple regex is used here for demonstration. A robust parser might be better.
                const matches = text.match(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
                if (matches) {
                    const extractedText = matches
                        .map(match => {
                            try {
                                // Extract and un-escape the string content
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

        // 7. Pipe the API response through our transformer and return it to the client.
        // This creates the smooth, word-by-word typing effect on the frontend.
        return new Response(apiResponse.body.pipeThrough(transformStream), {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error('Serverless function error:', error);
        return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500 });
    }
}