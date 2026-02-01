// Security headers
export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Turnstile verification
export async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  if (!token || !secret) return false;
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    });
    
    const result = await response.json() as { success: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

// Honeypot check - if this field has a value, it's a bot
export function checkHoneypot(value: unknown): boolean {
  return !value || (typeof value === 'string' && value.trim() === '');
}

// Input sanitization
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '')
    .trim();
}

export function sanitizeNumber(input: unknown, min: number, max: number, fallback: number): number {
  const num = Number(input);
  if (isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

// Validate request
export function validateRequest(request: Request): { valid: boolean; error?: string } {
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { valid: false, error: 'Content-Type must be application/json' };
    }
  }
  
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10240) {
    return { valid: false, error: 'Request too large' };
  }
  
  return { valid: true };
}

// Sanitize all user inputs
export function sanitizeInputs(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    age: sanitizeNumber(raw.age, 16, 80, 30),
    sex: raw.sex === 'male' || raw.sex === 'female' ? raw.sex : 'male',
    height: sanitizeNumber(raw.height, 140, 220, 170),
    weight: sanitizeNumber(raw.weight, 40, 300, 80),
    targetWeight: sanitizeNumber(raw.targetWeight, 40, 300, 70),
    weeks: sanitizeNumber(raw.weeks, 4, 24, 12),
    trainingLevel: ['beginner', 'intermediate', 'advanced'].includes(raw.trainingLevel as string) 
      ? raw.trainingLevel : 'beginner',
    activityLevel: ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(raw.activityLevel as string)
      ? raw.activityLevel : 'sedentary',
    cardioExperience: ['none', 'some', 'experienced'].includes(raw.cardioExperience as string)
      ? raw.cardioExperience : 'none',
    cardioModalities: Array.isArray(raw.cardioModalities) 
      ? raw.cardioModalities.filter((m): m is string => 
          typeof m === 'string' && ['walking', 'running', 'stationary_bike', 'outdoor_cycling', 'swimming', 'elliptical'].includes(m)
        ).slice(0, 6)
      : ['walking'],
    gymAccess: raw.gymAccess === true,
    daysPerWeek: sanitizeNumber(raw.daysPerWeek, 2, 7, 4),
    minutesPerSession: sanitizeNumber(raw.minutesPerSession, 15, 120, 45),
    injuries: sanitizeString(raw.injuries, 200),
    medical: sanitizeString(raw.medical, 200),
    dietary: sanitizeString(raw.dietary, 200),
  };
}

// Detect suspicious patterns
export function detectSuspicious(request: Request, body: Record<string, unknown>): string | null {
  const ua = request.headers.get('user-agent') || '';
  
  // No user agent (some bots)
  if (!ua) return 'missing_user_agent';
  
  // Common bot patterns (but allow legitimate ones)
  if (/curl|wget|python-requests|go-http-client/i.test(ua)) {
    return 'bot_user_agent';
  }
  
  // Suspicious input patterns (XSS attempts)
  const allInputs = JSON.stringify(body).toLowerCase();
  if (/<script|javascript:|on\w+\s*=/i.test(allInputs)) {
    return 'xss_attempt';
  }
  
  // SQL injection patterns
  if (/union\s+select|drop\s+table|insert\s+into|;\s*delete/i.test(allInputs)) {
    return 'sql_injection_attempt';
  }
  
  return null;
}
