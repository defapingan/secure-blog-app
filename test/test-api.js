const http = require('http');

class APITests {
    constructor() {
        // localhost
        this.insecureBase = '127.0.0.1';
        this.secureBase = '127.0.0.1';
    }

    async makeRequest(hostname, port, path, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname,
                port,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: responseData,
                        headers: res.headers
                    });
                });
            });

            req.on('error', (error) => {
                // Provide more detailed error information
                reject(new Error(`Request failed: ${error.message} (hostname: ${hostname}, port: ${port}, path: ${path})`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout: ${hostname}:${port}${path}`));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async testSQLInjection() {
        console.log('\n=== Testing SQL Injection Protection ===');
        
        // Test SQL injection protection of the insecure version
        console.log('1. Testing insecure version (should be vulnerable)...');
        try {
            const payload = {
                username: "' OR '1'='1 -- ",
                password: ""
            };
            
            const insecureResult = await this.makeRequest(
                this.insecureBase, 
                3001, 
                '/api/login', 
                'POST', 
                payload
            );
            
            console.log(`Insecure version response: ${insecureResult.status}`);
            if (insecureResult.status === 200) {
                try {
                    const data = JSON.parse(insecureResult.data);
                    if (data.success) {
                        console.log('❌ INSECURE: SQL Injection vulnerability confirmed');
                    }
                } catch (e) {
                    console.log(`Response data: ${insecureResult.data}`);
                }
            }
        } catch (error) {
            console.log('Insecure test error:', error.message);
        }

        // Test SQL injection protection of the secure version
        console.log('2. Testing secure version (should be protected)...');
        try {
            const payload = {
                username: "' OR '1'='1 -- ",
                password: ""
            };
            
            const secureResult = await this.makeRequest(
                this.secureBase, 
                3002, 
                '/api/login', 
                'POST', 
                payload
            );
            
            console.log(`Secure version response: ${secureResult.status}`);
            if (secureResult.status !== 200) {
                console.log('✅ SECURE: SQL Injection protection working');
            } else {
                console.log('⚠️ Warning: Secure API returned 200 for SQL injection attempt');
            }
        } catch (error) {
            console.log('Secure test error:', error.message);
        }
    }

    async testEndpoints() {
        console.log('\n=== Testing API Endpoints ===');
        
        const endpoints = [
            { path: '/api/posts', method: 'GET', name: 'Get Posts' },
            { path: '/api/user', method: 'GET', name: 'Get User Info' },
            { path: '/api/csrf-token', method: 'GET', name: 'Get CSRF Token' }
        ];

        for (const endpoint of endpoints) {
            try {
                const result = await this.makeRequest(
                    this.secureBase,
                    3002,
                    endpoint.path,
                    endpoint.method
                );
                console.log(`${endpoint.name}: HTTP ${result.status}`);
            } catch (error) {
                console.log(`${endpoint.name}: ERROR - ${error.message}`);
            }
        }
    }

    async testInputValidation() {
        console.log('\n=== Testing Input Validation ===');
        
        const testCases = [
            { 
                username: 'validuser', 
                email: 'test@example.com', 
                password: 'password123',
                expected: 'valid'
            },
            { 
                username: '<script>alert("xss")</script>', 
                email: 'test@example.com', 
                password: 'password123',
                expected: 'invalid'
            },
            { 
                username: 'admin', 
                email: 'invalid-email', 
                password: 'password123',
                expected: 'invalid'
            }
        ];

        for (const testCase of testCases) {
            try {
                const result = await this.makeRequest(
                    this.secureBase,
                    3002,
                    '/api/register',
                    'POST',
                    testCase
                );
                
                try {
                    const data = JSON.parse(result.data);
                    if (testCase.expected === 'valid' && data.success) {
                        console.log(`✅ Test passed: ${testCase.username}`);
                    } else if (testCase.expected === 'invalid' && !data.success) {
                        console.log(`✅ Test passed: ${testCase.username} correctly rejected`);
                    } else {
                        console.log(`❌ Test failed: ${testCase.username} (status: ${result.status})`);
                    }
                } catch (parseError) {
                    console.log(`❌ Parse error for ${testCase.username}: ${result.data}`);
                }
            } catch (error) {
                console.log(`Test error for ${testCase.username}: ${error.message}`);
            }
        }
    }

    async runAllTests() {
        console.log('Starting API security tests...');
        await this.testSQLInjection();
        await this.testEndpoints();
        await this.testInputValidation();
        console.log('\n=== All API tests completed ===');
    }
}

// run api test
const apiTester = new APITests();
apiTester.runAllTests().catch(error => {
    console.error('API test runner failed:', error);
    process.exit(1);
});