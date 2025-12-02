const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.testResults = [];
        this.startTime = null;
        this.testDir = __dirname;
    }

    async runTest(testFile, description) {
        console.log(`\n=== Running: ${description} ===`);
        
        const fullPath = path.join(this.testDir, testFile);
        
        return new Promise((resolve) => {
            exec(`node "${fullPath}"`, (error, stdout, stderr) => {
                const result = {
                    test: description,
                    passed: !error,
                    output: stdout,
                    error: stderr,
                    file: testFile
                };
                
                this.testResults.push(result);
                
                if (error) {
                    console.log(`❌ ${description} - FAILED`);
                    console.log(`   File: ${testFile}`);
                    if (error.code) {
                        console.log(`   Error Code: ${error.code}`);
                    }
                } else {
                    console.log(`✅ ${description} - PASSED`);
                }
                
                if (stdout) console.log(stdout);
                if (stderr) console.error(stderr);
                
                resolve(result);
            });
        });
    }

    async checkServersRunning() {
        console.log('Checking if servers are running...');
        
        const servers = [
            { port: 3001, name: 'Insecure Server' },
            { port: 3002, name: 'Secure Server' }
        ];
        
        const http = require('http');
        
        for (const server of servers) {
            try {
                await new Promise((resolve, reject) => {
                    const req = http.request({
                        hostname: 'localhost',
                        port: server.port,
                        path: '/',
                        method: 'GET',
                        timeout: 3000
                    }, (res) => {
                        res.on('data', () => {});
                        res.on('end', () => {
                            console.log(`✅ ${server.name} (Port ${server.port}) - RUNNING`);
                            resolve();
                        });
                    });
                    
                    req.on('error', () => {
                        console.log(`❌ ${server.name} (Port ${server.port}) - NOT RUNNING`);
                        resolve();
                    });
                    
                    req.on('timeout', () => {
                        req.destroy();
                        console.log(`⚠️ ${server.name} (Port ${server.port}) - TIMEOUT`);
                        resolve();
                    });
                    
                    req.end();
                });
            } catch (error) {
                console.log(`⚠️ ${server.name} check error: ${error.message}`);
            }
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY REPORT');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const duration = Date.now() - this.startTime;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
        
        if (total - passed > 0) {
            console.log('\nFailed Tests:');
            this.testResults.filter(r => !r.passed).forEach(result => {
                console.log(`  ❌ ${result.test}`);
                console.log(`     File: ${result.file}`);
                if (result.error) {
                    const errorMsg = result.error.toString();
                    console.log(`     Error: ${errorMsg.substring(0, 200)}${errorMsg.length > 200 ? '...' : ''}`);
                }
            });
        }
        
        // Save report
        const reportPath = path.join(this.testDir, 'test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total,
                passed,
                failed: total - passed,
                duration
            },
            results: this.testResults.map(r => ({
                test: r.test,
                file: r.file,
                passed: r.passed,
                timestamp: new Date().toISOString()
            }))
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
    }

    async runAllTests() {
        this.startTime = Date.now();
        
        console.log('='.repeat(60));
        console.log('SECURITY TEST SUITE');
        console.log('='.repeat(60));
        
        await this.checkServersRunning();
        
        await this.runTest('test-api.js', 'API Security Tests');
        await this.runTest('test-selenium.js', 'UI/Functional Tests');
        await this.runTest('zap-test.js', 'DAST Security Scan');
        
        this.generateReport();
        
        const failedCount = this.testResults.filter(r => !r.passed).length;
        if (failedCount > 0) {
            process.exit(1);
        }
    }
}

// run test
const runner = new TestRunner();
runner.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
});