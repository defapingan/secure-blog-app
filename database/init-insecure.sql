-- Create an insecure version of the database
CREATE DATABASE IF NOT EXISTS blog_insecure;
USE blog_insecure;

-- User table (insecure: plaintext passwords)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table of blog posts
CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert example data
INSERT INTO users (username, email, password, role) VALUES 
('admin', 'admin@blog.com', 'admin123', 'admin'),
('john_doe', 'john@example.com', 'password123', 'user'),
('jane_smith', 'jane@example.com', 'pass123', 'user');

INSERT INTO posts (title, content, author_id) VALUES 
('Welcome to our Blog!', 'This is the first post on our insecure blog application.', 1),
('Web Security Tips', 'Always validate your inputs and use parameterized queries!', 2),
('XSS Example', '<script>alert("This is XSS!")</script> This post contains malicious script.', 3);