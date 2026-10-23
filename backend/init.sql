-- AetherJudge Database Schema & Initial Data

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS problems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    time_limit INTEGER DEFAULT 5,
    memory_limit INTEGER DEFAULT 128000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_cases (
    id SERIAL PRIMARY KEY,
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_sample BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    problem_id INTEGER REFERENCES problems(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    verdict VARCHAR(50),
    passed_tests INTEGER DEFAULT 0,
    total_tests INTEGER DEFAULT 0,
    judge0_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS failed_jobs (
    id SERIAL PRIMARY KEY,
    original_submission_id INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    job_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Problems
INSERT INTO problems (id, title, description, difficulty, time_limit, memory_limit)
VALUES 
(1, 'Two Sum', 'Given an array of integers and a target sum, return indices of the two numbers that add to target.', 'easy', 5, 128000),
(2, 'Fibonacci Number', 'Given n, compute the nth Fibonacci number (0-indexed: F(0)=0, F(1)=1).', 'easy', 5, 128000),
(3, 'Reverse String', 'Given a string, print it in reverse order.', 'easy', 5, 128000),
(4, 'Palindrome Check', 'Given a string, print ''yes'' if it is a palindrome, otherwise ''no''.', 'easy', 5, 128000),
(5, 'Factorial', 'Given a non-negative integer n, print n! (factorial of n).', 'easy', 5, 128000),
(6, 'Prime Check', 'Given a positive integer n, print ''yes'' if it is prime, otherwise ''no''.', 'medium', 5, 128000),
(7, 'Array Maximum', 'Given n space-separated integers, print the maximum value.', 'easy', 5, 128000),
(8, 'Binary Search', 'Given a sorted array and a target value, print the index of the target if found, otherwise -1.', 'medium', 5, 128000)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Test Cases
INSERT INTO test_cases (problem_id, input, expected_output, is_sample)
VALUES
(1, E'2 7\n9', '0 1', true),
(1, E'3 3\n6', '0 1', false),
(1, E'1 5\n6', '0 1', false),
(2, '5', '5', true),
(2, '10', '55', false),
(2, '0', '0', false),
(3, 'hello', 'olleh', true),
(3, 'aether', 'rehtea', false),
(3, '12345', '54321', false),
(4, 'madam', 'yes', true),
(4, 'hello', 'no', false),
(4, 'racecar', 'yes', false),
(5, '5', '120', true),
(5, '0', '1', false),
(5, '10', '3628800', false),
(6, '7', 'yes', true),
(6, '15', 'no', false),
(6, '2', 'yes', false),
(7, E'5\n1 4 2 8 3', '8', true),
(7, E'3\n-5 -2 -9', '-2', false),
(7, E'1\n42', '42', false),
(8, E'1 3 5 7 9\n5', '2', true),
(8, E'1 3 5 7 9\n4', '-1', false),
(8, E'2 4 6 8 10\n10', '4', false)
ON CONFLICT DO NOTHING;

-- Adjust sequence values
SELECT setval('problems_id_seq', (SELECT COALESCE(MAX(id), 1) FROM problems));
SELECT setval('test_cases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM test_cases));
