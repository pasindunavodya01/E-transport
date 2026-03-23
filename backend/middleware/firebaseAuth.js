const admin = require('firebase-admin');

// Initialize Firebase Admin (Skipped if mocking)
if (process.env.MOCK_AUTH !== 'true') {
  try {
    const serviceAccount = require('../firebase-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.warn('Firebase Service Account not found. Authentication will fail if not mocked.');
  }
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (process.env.MOCK_AUTH === 'true') {
    // Mock user decoding - handle real JWTs gracefully without signature verify
    let mockUid = token;
    let mockEmail = 'mockuser@example.com';
    
    if (token.split('.').length === 3) {
      try {
        const payloadPayload = token.split('.')[1];
        // Decode base64url correctly using Node.js Buffer
        const payloadStr = Buffer.from(payloadPayload, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadStr);
        
        // Real firebase tokens use user_id or sub for the uid
        mockUid = payload.user_id || payload.sub || token;
        mockEmail = payload.email || mockEmail;
      } catch(e) {
        console.error("JWT Parse Error in Mock Auth:", e);
      }
    }
    
    req.user = { uid: mockUid, email: mockEmail };
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = verifyToken;
