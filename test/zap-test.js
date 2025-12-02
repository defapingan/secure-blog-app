const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ZAPTests {
    constructor() {
        // paths based on operating system
        this.platform = os.platform();
        this.targetUrl = 'http://127.0.0.1:3002';
        this.reportDir = './zap-reports';
        
        // ZAP path
        this.yourZapPath = 'E:\\useful\\nci_4\\ZAP\\ZAP_WEEKLY_D-2025-11-24\\ZAP_D-2025-11-24\\zap.bat';
        this.zapDir = path.dirname(this.yourZapPath);
        
        // ava path
        this.javaHome = 'E:\\useful\\nci_4\\jdk_v_17.0.17_10\\OpenJDK17U-jdk_x64_windows_hotspot_17.0.17_10\\jdk-17.0.17+10\\bin';
        
        console.log(`=== Java Configuration ===`);
        console.log(`Java home: ${this.javaHome}`);
        console.log(`Expected Java exe: ${this.javaHome}\\java.exe`);
        
        // Set ZAP paths
        if (this.platform === 'win32') {
            this.zapPath = `"${this.yourZapPath}"`;
            this.alternativePaths = [
                `"${this.yourZapPath}"`,
                '"C:\\Program Files\\OWASP\\Zed Attack Proxy\\zap.bat"',
                '"C:\\Program Files (x86)\\OWASP\\Zed Attack Proxy\\zap.bat"',
                'zap.bat'
            ];
        } else {
            this.zapPath = 'zap.sh';
            this.alternativePaths = ['zap.sh'];
        }
    }

    ensureReportDir() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    async checkJavaAvailable() {
        return new Promise((resolve) => {
            console.log(`\n=== Checking Java ===`);
            console.log(`Java path: ${this.javaHome}`);
            
            const javaExe = `${this.javaHome}\\java.exe`;
            console.log(`Looking for: ${javaExe}`);
            
            if (!fs.existsSync(javaExe)) {
                console.log(`❌ Java executable not found: ${javaExe}`);
                
                // List the contents of the catalog to help with debugging
                try {
                    const parentDir = path.dirname(this.javaHome);
                    console.log(`\nListing files in: ${parentDir}`);
                    const files = fs.readdirSync(parentDir);
                    files.forEach(file => {
                        console.log(`  - ${file}`);
                    });
                } catch (error) {
                    console.log(`Cannot list directory: ${error.message}`);
                }
                
                resolve(false);
                return;
            }
            
            console.log(`✅ Java executable found: ${javaExe}`);
            
            // Test Java with path
            exec(`"${javaExe}" -version`, (error, stdout, stderr) => {
                if (error) {
                    console.log(`❌ Java execution failed: ${error.message}`);
                    resolve(false);
                } else {
                    const output = stderr || stdout;
                    console.log('✅ Java is working!');
                    console.log(`Java version: ${output.toString().split('\n')[0]}`);
                    resolve(true);
                }
            });
        });
    }

    async checkZAPAvailable() {
        console.log('\n=== Checking ZAP Availability ===');
        console.log(`ZAP path: ${this.yourZapPath}`);
        
        if (fs.existsSync(this.yourZapPath)) {
            console.log(`✅ ZAP file exists: ${this.yourZapPath}`);
            
            const jarFile = path.join(this.zapDir, 'zap-D-2025-11-24.jar');
            if (fs.existsSync(jarFile)) {
                console.log(`✅ ZAP JAR file found: ${jarFile}`);
            } else {
                console.log(`❌ ZAP JAR file not found: ${jarFile}`);
                return false;
            }
            
            return true;
        }
        
        console.log('❌ ZAP file not found');
        return false;
    }

    async runQuickScan() {
        console.log('\n🚀 Starting ZAP Quick Scan...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.reportDir, `zap-report-${timestamp}.html`);
        const normalizedReportFile = reportFile.replace(/\//g, path.sep);
        const absoluteReportFile = path.resolve(normalizedReportFile);
        
        const javaExe = `${this.javaHome}\\java.exe`;
        const jarFile = 'zap-D-2025-11-24.jar';
        const jarPath = path.join(this.zapDir, jarFile);
        
        const command = `"${javaExe}" -Xmx512m -jar "${jarPath}" -cmd -quickurl ${this.targetUrl} -quickout "${absoluteReportFile}"`;
        
        console.log(`Using Java: ${javaExe}`);
        console.log(`Using JAR: ${jarPath}`);
        console.log(`Command: ${command}`);
        console.log(`Working directory: ${this.zapDir}`);
        console.log(`Report will be saved to: ${absoluteReportFile}`);
        
        return new Promise((resolve, reject) => {
            exec(command, { 
                timeout: 240000, // 4 minutes timeout
                cwd: this.zapDir
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error('\n❌ ZAP execution failed');
                    console.error(`Error: ${error.message}`);
                    
                    if (stdout && stdout.toString().trim().length > 0) {
                        console.log(`Output: ${stdout.toString().substring(0, 300)}`);
                    }
                    
                    if (stderr && stderr.toString().trim().length > 0) {
                        console.error(`Errors: ${stderr.toString().substring(0, 300)}`);
                    }
                    
                    reject(error);
                } else {
                    console.log('\n✅ ZAP scan completed successfully!');
                    console.log(`Report saved to: ${absoluteReportFile}`);
                    resolve(absoluteReportFile);
                }
            });
        });
    }

    async analyzeResults(reportFile) {
        console.log('\n📊 Analyzing scan results...');
        
        if (fs.existsSync(reportFile)) {
            try {
                const report = fs.readFileSync(reportFile, 'utf8');
                
                const vulnerabilities = [
                    { pattern: 'SQL Injection', count: (report.match(/SQL Injection/gi) || []).length },
                    { pattern: 'Cross Site Scripting', count: (report.match(/Cross Site Scripting/gi) || []).length },
                    { pattern: 'XSS', count: (report.match(/XSS/gi) || []).length },
                    { pattern: 'CSRF', count: (report.match(/CSRF/gi) || []).length },
                    { pattern: 'Information Disclosure', count: (report.match(/Information Disclosure/gi) || []).length }
                ];
                
                console.log('\n=== VULNERABILITY SUMMARY ===');
                let totalFindings = 0;
                
                vulnerabilities.forEach(vuln => {
                    if (vuln.count > 0) {
                        console.log(`${vuln.pattern}: ${vuln.count} findings`);
                        totalFindings += vuln.count;
                    }
                });
                
                console.log(`\nTotal vulnerabilities found: ${totalFindings}`);
                
                if (totalFindings > 0) {
                    console.log('\n⚠️ WARNING: Vulnerabilities detected!');
                    console.log('Please review the full report at:', reportFile);
                } else {
                    console.log('\n✅ No critical vulnerabilities found');
                }
                
            } catch (error) {
                console.log('❌ Error reading report:', error.message);
            }
        } else {
            console.log('❌ Report file not found:', reportFile);
        }
    }

    async run() {
        console.log('=== OWASP ZAP DAST Testing ===');
        console.log(`Platform: ${this.platform}`);
        console.log(`Target URL: ${this.targetUrl}`);
        
        this.ensureReportDir();
        
        try {
            // Check ZAP
            const zapAvailable = await this.checkZAPAvailable();
            
            if (!zapAvailable) {
                console.log('\n❌ ZAP not available');
                this.showManualInstructions();
                return;
            }
            
            // Check Java
            const javaAvailable = await this.checkJavaAvailable();
            
            if (!javaAvailable) {
                console.log('\n❌ Java not available');
                this.showManualInstructions();
                return;
            }
            
            // Run ZAP scan
            console.log('\n✅ All requirements met, starting ZAP scan...');
            const reportFile = await this.runQuickScan();
            await this.analyzeResults(reportFile);
            
        } catch (error) {
            console.log('\n=== ZAP TEST FAILED ===');
            console.log(`Error: ${error.message}`);
            this.showManualInstructions();
        }
        
        console.log('\n✅ ZAP testing completed');
    }

    showManualInstructions() {
        console.log('\n=== Manual Security Testing Instructions ===');
        console.log('Please perform these manual tests:');
        console.log('\n1. Test SQL Injection protection');
        console.log('2. Test XSS protection');
        console.log('3. Verify CSRF tokens are required');
        console.log('4. Check authentication mechanisms');
        console.log('5. Test input validation');
        console.log('\n✅ Manual testing checklist provided');
    }
}

// Run ZAP tests
const zapTester = new ZAPTests();
zapTester.run().catch(error => {
    console.error('ZAP test runner failed:', error);
    process.exit(1);
});