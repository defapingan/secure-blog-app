import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 🚨 insecure:Allow all CORS requests
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🚨 insecure:Database connection information hardcoded
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Wroley2004',
  database: 'blog_insecure'
});

// connect to database
db.connect((err) => {
  if (err) {
    console.log('🚨 Database connection failed:', err);
    return;
  }
  console.log('🚨 Connected to MySQL database (insecure version)');
});

// 🚨 insecure:Simple session storage (for demonstration only)
const userSessions = new Map();

// 🚨 insecure:Certification Middleware (Simple Implementation)
const requireAuth = (req, res, next) => {
  const sessionId = req.headers.authorization;
  if (!sessionId || !userSessions.has(sessionId)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = userSessions.get(sessionId);
  next();
};

// 🚨 insecure:Registration interface - SQL injection vulnerability
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  
  const query = `INSERT INTO users (username, email, password) VALUES ('${username}', '${email}', '${password}')`;
  
  console.log('🚨 Executing unsafe query:', query);
  
  db.query(query, (err, result) => {
    if (err) {
      res.status(500).json({ 
        error: `Database error: ${err.message}`,
        sqlMessage: err.sqlMessage,
        sql: err.sql
      });
      return;
    }
    res.json({ success: true, userId: result.insertId });
  });
});

// 🚨 insecure:Login interface - SQL injection vulnerability
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('🚨 Tring login - username:', username, 'password:', password);
  
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  console.log('🚨 Executing unsafe login query:', query);
  
  db.query(query, (err, results) => {
    if (err) {
      console.log('🚨 database wrong:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    console.log('🚨 query results count:', results.length);
    
    if (results.length > 0) {
      const user = results[0];
      console.log('🚨 Login Successed, user:', user.username);
      
      // 🚨 insecure: Simple session creation
      const sessionId = Math.random().toString(36).substring(2);
      userSessions.set(sessionId, {
        id: user.id,
        username: user.username,
        role: user.role
      });
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          password: user.password,
          role: user.role
        },
        sessionId: sessionId
      });
    } else {
      console.log('🚨 Login failed, no matching user');
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});


app.post('/api/logout', (req, res) => {
  const sessionId = req.headers.authorization;
  if (sessionId) {
    userSessions.delete(sessionId);
  }
  res.json({ success: true });
});

app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    user: req.user
  });
});

// 🚨 不安全：Get all posts - Without permission to check
app.get('/api/posts', (req, res) => {
  const query = `
    SELECT p.*, u.username 
    FROM posts p 
    JOIN users u ON p.author_id = u.id 
    ORDER BY p.created_at DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// 🚨 insecure: Creat posts - Store XSS
app.post('/api/posts', requireAuth, (req, res) => {
  const { title, content } = req.body;
  
  const query = `INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)`;
  
  db.query(query, [title, content, req.user.id], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, postId: result.insertId });
  });
});

// 🚨 insecure: Search function - SQL injection
app.get('/api/search', (req, res) => {
  const searchTerm = req.query.q;
  
  if (!searchTerm) {
    return res.json([]);
  }
  
  const query = `SELECT * FROM posts WHERE title LIKE '%${searchTerm}%' OR content LIKE '%${searchTerm}%'`;
  
  console.log('🚨 Executing unsafe search query:', query);
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// 🚨 insecure:Reflective XSS
app.get('/api/reflect-xss', (req, res) => {
  const userInput = req.query.input;
  
  if (!userInput) {
    return res.json({ 
      message: `No input provided.`,
      userInput: userInput
    });
  }
  
  try {
    res.json({ 
      message: `Search results for: ${userInput}`,
      userInput: userInput
    });
  } catch (error) {
    console.error('Error in reflect-xss endpoint:', error);
    res.status(500).json({ error: 'Internal server error in reflect-xss handler' });
  }
});

// 🚨 insecure:Get user list - Sensitive data exposure
app.get('/api/users', (req, res) => {
  const query = 'SELECT * FROM users';
  
  db.query(query, (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// 🚨 insecure:Delete posts - No permission to verify
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const postId = req.params.id;
  const query = 'DELETE FROM posts WHERE id = ?';
  
  db.query(query, [postId], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚨 Insecure server running on http://localhost:${PORT}`);
  console.log('🚨 Vulnerabilities enabled: SQL Injection, XSS, Sensitive Data Exposure');
  console.log('🚨 Try SQL Injection: Enter "\' OR \'1\'=\'1" in login form');
});