import jwt from 'jsonwebtoken';

const secret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    // An unset secret in production would let anyone forge login tokens.
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-only-secret';
};

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
