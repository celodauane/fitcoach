import { calculate, formatInputsForPrompt, UserInputs } from './calculate';
import { SYSTEM_PROMPT } from './prompt';
import { 
  SECURITY_HEADERS, 
  checkRateLimit, 
  validateRequest, 
  sanitizeInputs,
  cleanupRateLimits 
} from './security';

interface Env {
  AI: Ai;
}

function addSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function jsonResponse(data: object, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Periodic cleanup
    if (Math.random() < 0.01) cleanupRateLimits();
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return addSecurityHeaders(new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      }));
    }
    
    // API endpoint
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      // Get client IP
      const clientIP = request.headers.get('cf-connecting-ip') || 
                       request.headers.get('x-forwarded-for')?.split(',')[0] || 
                       'unknown';
      
      // Rate limiting
      const { allowed, remaining } = checkRateLimit(clientIP);
      if (!allowed) {
        return addSecurityHeaders(jsonResponse(
          { error: 'Too many requests. Please wait a minute.' },
          429,
          { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' }
        ));
      }
      
      // Validate request
      const validation = validateRequest(request);
      if (!validation.valid) {
        return addSecurityHeaders(jsonResponse({ error: validation.error }, 400));
      }
      
      try {
        // Parse and sanitize inputs
        let rawInputs: Record<string, unknown>;
        try {
          rawInputs = await request.json();
        } catch {
          return addSecurityHeaders(jsonResponse({ error: 'Invalid JSON' }, 400));
        }
        
        const inputs = sanitizeInputs(rawInputs) as unknown as UserInputs;
        
        // Additional validation
        if (inputs.targetWeight >= inputs.weight) {
          return addSecurityHeaders(jsonResponse(
            { error: 'Target weight must be less than current weight' }, 
            400
          ));
        }
        
        if (inputs.cardioModalities.length === 0) {
          return addSecurityHeaders(jsonResponse(
            { error: 'At least one cardio modality required' }, 
            400
          ));
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
        
        return addSecurityHeaders(jsonResponse({
          success: true,
          calculations: calcs,
          program,
        }, 200, { 'X-RateLimit-Remaining': String(remaining) }));
        
      } catch (error) {
        console.error('Error:', error);
        return addSecurityHeaders(jsonResponse(
          { error: 'An error occurred. Please try again.' }, 
          500
        ));
      }
    }
    
    // For static assets, just add security headers
    // (Cloudflare will serve from /public automatically)
    return addSecurityHeaders(new Response('Not found', { status: 404 }));
  },
};
