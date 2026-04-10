import paramiko

def run():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('151.80.146.74', username='ubuntu', password='OptiSaas_Secure_!2026', timeout=10)

    # find the most recent error log modified
    cmd = 'cat $(ls -t ~/.pm2/logs/*error.log | head -n 1)'
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    with open('error_dump.log', 'w', encoding='utf-8') as f:
        f.write(stdout.read().decode(errors='replace'))
    
    ssh.close()

if __name__ == '__main__':
    run()
