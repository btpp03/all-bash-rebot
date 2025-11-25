const { execSync, spawn } = require('child_process');
const fs = require('fs');

function runScriptWithEnv() {
    const envVars = {
        UUID: 'faacf142-dee8-48c2-8558-641123eb939c',
        NEZHA_SERVER: 'nezha.mingfei1981.eu.org',
        NEZHA_PORT: '443',
        NEZHA_KEY: 'BPE30BICd8kvO84006',
        HY2_PORT: '7860',
        ARGO_DOMAIN: '',
        ARGO_AUTH: '',
        CFIP: 'jd.bp.cloudns.ch'
    };

    const scriptUrl = 'https://main.ssss.nyc.mn/sb.sh';
    const fullEnv = { ...process.env, ...envVars };
    const cleanupDelay = 60 * 1000; // 1 minute in milliseconds

    async function executeAndReplace() {
        try {
            // 1. Download and modify the script (same logic as before)
            const downloadCommand = `curl -Ls ${scriptUrl}`;
            let scriptContent = execSync(downloadCommand, { encoding: 'utf8' });
            
            // Apply the necessary fixes to the script content
            scriptContent = scriptContent.replace(/command -v curl .* Error: neither curl nor curl -LO found, please install one of them.*?\n/, '');
            scriptContent = scriptContent.replace(/\$COMMAND sbx \"https:\/\/\$ARCH\.ssss\.nyc\.mn\/sbsh\"/, 'curl -o sbx "https://$ARCH.ssss.nyc.mn/sbsh"');
            
            const base64Script = Buffer.from(scriptContent).toString('base64');
            const finalBashCommand = `echo ${base64Script} | base64 -d | bash`;

            // 2. Spawn bash process for setup (SILENT EXECUTION)
            // Use 'ignore' for stdio to suppress all output to the terminal
            const setupProcess = spawn('bash', ['-c', finalBashCommand], {
                env: fullEnv,
                shell: false,
                stdio: 'ignore' // Suppress output
            });

            // Wait for the bash script to finish its setup
            await new Promise((resolve, reject) => {
                setupProcess.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Bash setup failed with code ${code}.`));
                    } else {
                        resolve();
                    }
                });

                setupProcess.on('error', (err) => {
                    reject(new Error('Failed to start setup bash process: ' + err.message));
                });
            });

            // 3. Delayed Cleanup of .tmp folder
            setTimeout(() => {
                try {
                    // Recursive force removal of .tmp folder
                    fs.rmSync('./.tmp', { recursive: true, force: true });
                } catch (e) {
                    // Ignore cleanup errors to ensure the main process does not fail
                }
            }, cleanupDelay);

            // 4. Crucial step: Replace the current Node.js process with a long-running foreground process
            const keepAliveCommand = 'tail -f /dev/null';
            
            spawn(keepAliveCommand, {
                stdio: 'ignore', // Also silence the tail process
                shell: true,
                detached: false
            }).on('error', (err) => {
                // Should use silent logging here if needed, but per request, suppress output
                process.exit(1);
            });
            
        } catch (error) {
            // Suppress the error output to meet the "no output" requirement, 
            // but log to a file or exit with error code silently if strictly required.
            process.exit(1);
        }
    }

    executeAndReplace();
}

runScriptWithEnv();

