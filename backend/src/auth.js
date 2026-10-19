import jwt from 'jsonwebtoken';

const secret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    // An unset secret in production would let anyone forge login tokens, so refuse instead.
    throw Object.assign(new Error('The server is missing its JWT_SECRET setting, so login is turned off.'), {
      status: 503,
      expose: true,
    });
  }
  return 'dev-only-secret';
};

// Call before doing any work that ends in signing a token, so a misconfigured server fails cleanly
// instead of (for example) creating an account and then erroring.
export const assertAuthConfigured = () => { secret(); };

// Like requireAuth, but visitors without a valid token pass through with req.user unset.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), secret());
      req.user = { id: payload.sub, role: payload.role };
    } catch { /* treat as anonymous */ }
  }
  next();
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const payload = jwt.verify(token, secret());
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: `Only ${role}s can do this` });
    }
    next();
  };
}
