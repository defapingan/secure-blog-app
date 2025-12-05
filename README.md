do the "npm install" in "secure-blog-app/", "secure-blog-app/insecure-version" and "secure-blog-app/secure-version" first!

# Secure Blog Application

## Project Overview
This project contains two versions of a blog web application for educational purposes:
- **Insecure Version** (Port 3001): Contains intentional security vulnerabilities
- **Secure Version** (Port 3002): Implements security best practices with all vulnerabilities fixed

## Branches
- `main`: Documentation and project structure
- `insecure`: Vulnerable version codebase  
- `secure`: Secure version codebase

## Technical Specifications

### Technology Stack

### Database Setup

# Initialize insecure database
mysql -u root -p < database/init-insecure.sql

# Initialize secure database
mysql -u root -p < database/init-secure.sql

# Add sample data
mysql -u root -p < database/sample-data.sql

### Running the Applications
Insecure Version

cd insecure-version
npm install
npm start
Access at: http://localhost:3001
Secure Version

cd secure-version
npm install
npm start
Access at: http://localhost:3002

### Security Implementations
# Insecure Version Vulnerabilities (OWASP Top 10)
SQL Injection
Location: Login and search functionality
Payload: ' OR '1'='1 --
Impact: Unauthorized access, data extraction

Cross-Site Scripting (XSS)
Reflected XSS: Search parameter reflection
Stored XSS: Blog post content storage
DOM-based XSS: URL parameter injection
Payload: <script>alert('XSS')</script>

Sensitive Data Exposure
Plaintext password storage
User information exposure without authorization
No data encryption

# Secure Version Protections
SQL Injection Prevention
Parameterized queries using mysql2
Input validation with validator library
Prepared statements for all database operations

XSS Prevention
Input sanitization with validator.escape()
Output encoding in frontend with escapeHtml()
Content Security Policy via Helmet
Safe DOM manipulation using textContent

Additional Security Measures
CSRF Protection: CSRF tokens via csurf middleware
Password Security: bcrypt hashing with 12 rounds
Session Management: express-session with secure cookies
Security Headers: Helmet.js configuration
Rate Limiting: Request limiting middleware
Security Logging: Winston logger to security.log
Input Validation: Comprehensive validation on all endpoints

### Dependencies
Insecure Version
{
  "express": "^4.18.2",
  "mysql2": "^3.6.0", 
  "cors": "^2.8.5"
}

Secure Version
{
  "express": "^4.18.2",
  "mysql2": "^3.6.0",
  "bcryptjs": "^2.4.3",
  "express-session": "^1.17.3",
  "csurf": "^1.11.0",
  "helmet": "^7.0.0",
  "express-rate-limit": "^6.8.1",
  "validator": "^13.9.0",
  "winston": "^3.10.0"
}