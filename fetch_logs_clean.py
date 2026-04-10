import paramiko

def run():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('151.80.146.74', username='ubuntu', password='OptiSaas_Secure_!2026', timeout=10)

    cmd = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 logs --lines 200 --nostream > /tmp/pm2_logs_dump.txt 2>&1 && cat /tmp/pm2_logs_dump.txt'
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode())
    ssh.close()

if __name__ == '__main__':
    run()
