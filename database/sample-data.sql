-- Add sample article data to two databases
USE blog_insecure;
INSERT INTO posts (title, content, author_id) VALUES 
('SQL Injection Demo', 'Try entering: '' OR ''1''=''1 in the login form!', 1),
('XSS Attack Example', '<script>window.location="http://malicious.com/steal-cookies"</script> This is dangerous!', 2);

USE blog_secure;
INSERT INTO posts (title, content, author_id) VALUES 
('Welcome to Secure Blog', 'This is a secure blog application with proper input validation.', 1),
('Security Best Practices', 'Always use parameterized queries and validate user inputs!', 2);