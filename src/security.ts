// Security headers
export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // needed for inline handlers, can remove if refactored
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
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

// Rate limiting (simple in-memory, resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

// Input sanitization
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML
    .trim();
}

export function sanitizeNumber(input: unknown, min: number, max: number, fallback: number): number {
  const num = Number(input);
  if (isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

// Validate request
export function validateRequest(request: Request): { valid: boolean; error?: string } {
  // Check content type for POST
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { valid: false, error: 'Content-Type must be application/json' };
    }
  }
  
  // Check content length (max 10KB)
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

// Clean up old rate limit entries periodically
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}
