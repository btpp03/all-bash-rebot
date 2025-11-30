const { spawn, exec } = require('child_process');
const SERVICE_URL = "https://raw.githubusercontent.com/rannan1999/all-bash/refs/heads/main/workes/testking.sh";

/**
 * 运行远程服务脚本的函数。
 * 它模拟了 shell 脚本中的 `curl ... | bash` 管道操作。
 */
function runService() {
    console.log('[NODE] Running service command...');

    // 使用 'exec' 来执行一个完整的 shell 命令，包括管道
    const serviceCommand = `curl -s ${SERVICE_URL} | bash`;

    exec(serviceCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`[NODE] Service execution failed: ${error.message}`);
            // 注意：如果远程脚本内部失败，通常会在这里捕获
            return;
        }
        if (stderr) {
            // 某些脚本会将日志输出到 stderr
            console.error(`[NODE] Service reported stderr: ${stderr.trim()}`);
        }
        
        console.log(`[NODE] Service output: \n${stdout.trim()}`);
        console.log('[NODE] Service exited.');
    });
}

/**
 * 保持容器进程存活的函数。
 * 替代了 shell 脚本中的 `tail -f /dev/null`。
 */
function keepAlive() {
    console.log('[SYSTEM] Keeping container alive...');
    
    // 一个简单的方法是创建一个永不退出的计时器或等待用户输入，
    // 但在容器环境中，我们只需确保主进程不退出即可。
    // 我们可以使用一个无操作的 setInterval 来确保 Node.js 运行时保持活动状态。
    // 当然，更符合 Docker 实践的做法是，
    // 将实际的服务（例如一个 HTTP 服务器）作为主进程运行。
    
    setInterval(() => {
        // No-op interval to keep the process running indefinitely
    }, 1000 * 60 * 60); // Check every hour to make sure
    
    // 或者，我们可以直接监听进程信号，让它保持打开
    process.on('SIGINT', () => {
        console.log('[SYSTEM] Received SIGINT. Exiting...');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('[SYSTEM] Received SIGTERM. Exiting...');
        process.exit(0);
    });
    
    console.log('[SYSTEM] Process is now running indefinitely...');
}

/**
 * 主函数，调用服务并保持存活。
 */
function main() {
    runService();
    keepAlive();
}

// 运行主函数
main();