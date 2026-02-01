import { calculate, formatInputsForPrompt, UserInputs } from './calculate';
import { SYSTEM_PROMPT } from './prompt';

interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // API endpoint
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      try {
        const inputs = await request.json() as UserInputs;
        
        // Validate required fields
        const required = ['age', 'sex', 'height', 'weight', 'targetWeight', 'weeks', 
                         'trainingLevel', 'activityLevel', 'cardioModalities', 'daysPerWeek', 'minutesPerSession'];
        for (const field of required) {
          if (!(field in inputs) || inputs[field as keyof UserInputs] === undefined) {
            return Response.json({ error: `Missing required field: ${field}` }, { status: 400 });
          }
        }
        
        // Calculate
        const calcs = calculate(inputs);
        const userContext = formatInputsForPrompt(inputs, calcs);
        
        // Generate program
        const response = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Generate a complete 12-week program for this user:\n\n${userContext}` }
          ],
          max_tokens: 4000,
        });
        
        const program = (response as { response: string }).response;
        
        return Response.json({
          success: true,
          calculations: calcs,
          program,
        }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return Response.json({ error: message }, { 
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
    
    return new Response('Not found', { status: 404 });
  },
};
