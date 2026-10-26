// SERVER ENTRY POINT
// This file starts the OrderBoard backend after MongoDB connects.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import securityRoutes from './routes/security.js';

// Step 1: Stop startup early if important configuration is missing.
const requiredSettings = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'];
for (const setting of requiredSettings) {
  if (!process.env[setting]) {
    throw new Error(`Missing environment variable: ${setting}`);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must have at least 32 characters.');
}

// Step 2: Create the web server and install common security middleware.
const app = express();
app.disable('x-powered-by');
app.use(helmet()); // Adds HTTP security headers.
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '20kb' })); // Read incoming JSON request bodies.
app.use(cookieParser()); // Read the login cookie.

// Limit repeated password guesses: 10 attempts per 15 minutes per IP.
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again later.' },
}));

// Reject state-changing browser requests from an unexpected website.
app.use((request, response, next) => {
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const origin = request.get('origin');
  if (unsafe && origin !== process.env.CLIENT_ORIGIN) {
    return response.status(403).json({ message: 'Unrecognized request origin.' });
  }
  next();
});
// Step 3: Attach API routes. Each route lives in its own file.
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', application: 'OrderBoard', phase: 1 });
});
app.use('/api/auth', authRoutes); // Login, logout and current account.
app.use('/api/staff', staffRoutes);
app.use('/api/security', securityRoutes); // Owner-only staff management.

// Unexpected server errors should not reveal database details to the browser.
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'An unexpected error occurred.' });
});

// Step 4: Connect to the database BEFORE accepting incoming requests.
await mongoose.connect(process.env.MONGODB_URI);
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`OrderBoard API running on port ${port}`));
