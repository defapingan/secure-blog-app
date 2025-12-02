import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import session from 'express-session';
import csrf from 'csurf';
import validator from 'validator';
import { createLogger, format, transports } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Add detailed error handling
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.log('Uncaught exception:', error);
  console.log('Error stack:', error.stack);
});

// 🛡️ secure:Create logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'security.log' }),
    new transports.Console()
  ]
});

// Security log function
const logSecurityEvent = (req, action, userId = null) => {
  logger.info({
    action,
    userId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    path: req.path,
    timestamp: new Date().toISOString()
  });
};

// 🛡️ secure:secure helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 🛡️ secure:CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3002');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
  next();
});

app.use(express.json({ limit: '1mb' }));

// 🛡️ secure:Session management
app.use(session({
  name: 'secureBlogSession',
  secret: 'your-secret-key-should-be-in-environment-variables',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  }
}));

// 🛡️ secure:CSRF protection
const csrfProtection = csrf({ 
  cookie: false
});
app.use(csrfProtection);

app.use(express.static(path.join(__dirname, 'public')));

// Handle favicon request
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Wroley2004',
  database: 'blog_secure',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 🛡️ secure:Input validation middleware
const validateRegistration = (req, res, next) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (!validator.isLength(username, { min: 3, max: 50 })) {
    return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
  }
  
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (!validator.isLength(password, { min: 6 })) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  req.body.username = validator.escape(validator.trim(username));
  req.body.email = validator.normalizeEmail(email, { 
    gmail_remove_dots: false,
    gmail_remove_subaddress: false 
  });
  
  next();
};

const validatePost = (req, res, next) => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  if (!validator.isLength(title, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'Title must be between 1 and 255 characters' });
  }
  
  req.body.title = validator.escape(validator.trim(title));
  req.body.content = validator.escape(validator.trim(content));
  
  next();
};

// 🛡️ secure:Certified middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    logSecurityEvent(req, 'UNAUTHORIZED_ACCESS');
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.role !== 'admin') {
    logSecurityEvent(req, 'UNAUTHORIZED_ADMIN_ACCESS', req.session.userId);
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// 🛡️ secure:Register
app.post('/api/register', validateRegistration, async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      logSecurityEvent(req, 'REGISTRATION_DUPLICATE');
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    logSecurityEvent(req, 'USER_REGISTERED', result.insertId);
    res.json({ 
      success: true, 
      userId: result.insertId,
      csrfToken: req.csrfToken()
    });
    
  } catch (error) {
    console.log('Register error:', error);
    logSecurityEvent(req, 'REGISTRATION_ERROR');
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 🛡️ secure:Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, password, role FROM users WHERE username = ?',
      [validator.escape(username)]
    );
    
    if (users.length === 0) {
      logSecurityEvent(req, 'LOGIN_FAILED_USER_NOT_FOUND');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      logSecurityEvent(req, 'LOGIN_FAILED_INVALID_PASSWORD', user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    logSecurityEvent(req, 'LOGIN_SUCCESS', user.id);
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      },
      csrfToken: req.csrfToken()
    });
    
  } catch (error) {
    console.log('Login error:', error);
    logSecurityEvent(req, 'LOGIN_ERROR');
    res.status(500).json({ error: 'Login failed' });
  }
});

// 🛡️ secure:Logout
app.post('/api/logout', (req, res) => {
  logSecurityEvent(req, 'LOGOUT', req.session.userId);
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('secureBlogSession');
    res.json({ success: true });
  });
});

// 🛡️ secure:Get current user information
app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role
    }
  });
});

// 🛡️ secure:get posts list
app.get('/api/posts', async (req, res) => {
  let connection;
  try {
    const [rows] = await pool.execute(`
      SELECT p.id, p.title, p.content, p.author_id, p.created_at, p.updated_at, u.username 
      FROM posts p 
      LEFT JOIN users u ON p.author_id = u.id 
      ORDER BY p.created_at DESC
    `);
    
    res.json(rows);
    
  } catch (error) {
    console.log('❌ Database query failed:', error.message);
    
    const mockPosts = [
      {
        id: 1,
        title: "Welcome to Secure Blog",
        content: "This is a secure blog application with proper input validation.",
        author_id: 1,
        username: "admin",
        created_at: "2025-11-28 22:45:30"
      },
      {
        id: 2, 
        title: "Security Best Practices",
        content: "Always use parameterized queries and validate user inputs!",
        author_id: 2,
        username: "john_doe", 
        created_at: "2025-11-28 22:45:30"
      }
    ];
    
    res.json(mockPosts);
  }
});

// 🛡️ secure:create posts
app.post('/api/posts', requireAuth, csrfProtection, validatePost, async (req, res) => {
  const { title, content } = req.body;
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)',
      [title, content, req.session.userId]
    );
    
    logSecurityEvent(req, 'POST_CREATED', req.session.userId);
    res.json({ 
      success: true, 
      postId: result.insertId,
      csrfToken: req.csrfToken()
    });
    
  } catch (error) {
    console.log('Create post error:', error);
    logSecurityEvent(req, 'POST_CREATION_ERROR', req.session.userId);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// 🛡️ secure:delet posts
app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  const postId = req.params.id;
  
  if (!validator.isInt(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  
  try {
    const [posts] = await pool.execute(
      'SELECT author_id FROM posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = posts[0];
    
    if (post.author_id !== req.session.userId && req.session.role !== 'admin') {
      logSecurityEvent(req, 'UNAUTHORIZED_POST_DELETE', req.session.userId);
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }
    
    await pool.execute('DELETE FROM posts WHERE id = ?', [postId]);
    
    logSecurityEvent(req, 'POST_DELETED', req.session.userId);
    res.json({ success: true });
    
  } catch (error) {
    console.log('Delet post error:', error);
    logSecurityEvent(req, 'POST_DELETION_ERROR', req.session.userId);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// 🛡️ secure:search
app.get('/api/search', async (req, res) => {
  const searchTerm = req.query.q;
  
  if (!searchTerm || !validator.isLength(searchTerm, { min: 1, max: 100 })) {
    return res.json([]);
  }
  
  let connection;
  try {
    const [results] = await pool.execute(
      `SELECT p.id, p.title, p.content, p.author_id, p.created_at, p.updated_at, u.username 
       FROM posts p 
       LEFT JOIN users u ON p.author_id = u.id 
       WHERE p.title LIKE ? OR p.content LIKE ? 
       ORDER BY p.created_at DESC`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    
    res.json(results);
    
  } catch (error) {
    console.log('❌ Search failed:', error.message);
    
    const mockPosts = [
      {
        id: 1,
        title: "Welcome to Secure Blog",
        content: "This is a secure blog application with proper input validation.",
        author_id: 1,
        username: "admin",
        created_at: "2025-11-28 22:45:30"
      },
      {
        id: 2,
        title: "Security Best Practices", 
        content: "Always use parameterized queries and validate user inputs!",
        author_id: 2,
        username: "john_doe",
        created_at: "2025-11-28 22:45:30"
      }
    ].filter(post => 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      post.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    res.json(mockPosts);
  }
});

// 🛡️ secure:Reflective XSS
app.get('/api/reflect-xss', async (req, res) => {
  const userInput = req.query.input;
  
  if (!userInput) {
    return res.json({ 
      message: `No input provided.`,
      userInput: userInput
    });
  }
  
  if (!validator.isLength(userInput, { min: 1, max: 500 })) {
    return res.status(400).json({ error: 'Input length must be between 1 and 500 characters' });
  }
  
  const sanitizedInput = validator.escape(validator.trim(userInput));
  
  try {
    res.json({ 
      message: `Search results for: ${sanitizedInput}`,
      userInput: sanitizedInput
    });
  } catch (error) {
    console.error('Error in reflect-xss endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🛡️ secure:get CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.log('Global error handling:', err);
  
  if (err.code === 'EBADCSRFTOKEN') {
    logSecurityEvent(req, 'CSRF_TOKEN_INVALID');
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  logSecurityEvent(req, 'SERVER_ERROR');
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🛡️ Secure server running on http://localhost:${PORT}`);
  console.log('🛡️ All security measures enabled:');
  console.log('   ✅ SQL Injection protection');
  console.log('   ✅ XSS protection');
  console.log('   ✅ CSRF protection');
  console.log('   ✅ Input validation');
  console.log('   ✅ Session management');
  console.log('   ✅ Security headers');
  console.log('   ✅ Security logging');
});