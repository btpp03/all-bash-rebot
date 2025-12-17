import os
import subprocess
import time
import sys
import shlex
import logging

# ==================== CONFIGURATION ====================
# Set up a dummy logger to suppress output if needed, but the primary method
# is removing print statements.
# logging.basicConfig(level=logging.CRITICAL) 

# ==================== VARIABLES ====================
UUID = os.getenv('UUID', 'faacf142-dee8-48c2-8558-641123eb939c')
NEZHA_SERVER = os.getenv('NEZHA_SERVER', 'nezha.mingfei1981.eu.org')
NEZHA_PORT = os.getenv('NEZHA_PORT', '443')
NEZHA_KEY = os.getenv('NEZHA_KEY', '')
ARGO_DOMAIN = os.getenv('ARGO_DOMAIN', '')
ARGO_AUTH = os.getenv('ARGO_AUTH', '')
CFIP = os.getenv('CFIP', 'jd.bp.cloudns.ch')
CFPORT = os.getenv('CFPORT', '443')
NAME = os.getenv('NAME', 'MJJ')
ARGO_PORT = os.getenv('ARGO_PORT', '8001')

ARGO_PORT = str(ARGO_PORT)

XRAY_BIN = "./iccv2"
CLOUDFLARE_TUNNEL_BIN = "./icc2go"
NEZHA_AGENT_BIN = "./iccagent"

# ==================== PERMISSIONS ====================
def set_permissions():
    for bin_file in [XRAY_BIN, NEZHA_AGENT_BIN, CLOUDFLARE_TUNNEL_BIN]:
        try:
            os.chmod(bin_file, 0o755)
        except FileNotFoundError:
            pass # Suppress output
        except Exception:
            pass # Suppress output

# ==================== START SERVICES ====================

def run_background_command(command_parts, service_name):
    try:
        if isinstance(command_parts, str):
            command_parts = shlex.split(command_parts)
            
        process = subprocess.Popen(
            command_parts,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True
        )
        return process
    except FileNotFoundError:
        return None # Return None on failure to start
    except Exception:
        return None # Return None on failure to start

def start_xray():
    command = [XRAY_BIN, "-c", "v2_config.json"]
    return run_background_command(command, "XRAY")

def start_cloudflare_tunnel():
    base_command = [
        CLOUDFLARE_TUNNEL_BIN,
        "tunnel",
        "--edge-ip-version", "auto",
        "--no-autoupdate",
        "--protocol", "http2",
    ]
    
    command = base_command[:]
    
    if ARGO_AUTH:
        if 120 <= len(ARGO_AUTH) <= 250 and all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=" for c in ARGO_AUTH):
            command.extend(["run", "--token", ARGO_AUTH])
        
        elif "TunnelSecret" in ARGO_AUTH:
            command.extend(["--url", f"http://localhost:{ARGO_PORT}"])
        else:
            command.extend(["--url", f"http://localhost:{ARGO_PORT}"])
    else:
        command.extend(["--url", f"http://localhost:{ARGO_PORT}"])
        
    return run_background_command(command, "Cloudflare Tunnel")

def start_nezha_agent():
    if not (NEZHA_SERVER and NEZHA_KEY):
        return None

    tlsPorts = ["443", "8443", "2096", "2087", "2083", "2053"]
    nezha_tls = "--tls" if NEZHA_PORT in tlsPorts else ""

    if NEZHA_PORT:
        command = [
            NEZHA_AGENT_BIN,
            "-s", f"{NEZHA_SERVER}:{NEZHA_PORT}",
            "-p", NEZHA_KEY
        ]
        if nezha_tls:
            command.append(nezha_tls)
            
        return run_background_command(command, "Nezha Agent")
    else:
        return None

# ==================== KEEP ALIVE ====================

def keep_alive():
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    except Exception:
        pass
    finally:
        pass

# ==================== MAIN EXECUTION ====================

def main():
    
    set_permissions()
    
    processes = []
    processes.append(start_xray())
    processes.append(start_cloudflare_tunnel())
    processes.append(start_nezha_agent())
    
    active_processes = [p for p in processes if p is not None]

    keep_alive()

    for p in active_processes:
        try:
            p.terminate()
            p.wait(timeout=5)
        except Exception:
            pass

if __name__ == "__main__":
    main()