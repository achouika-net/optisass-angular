import paramiko

def run():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('151.80.146.74', username='ubuntu', password='OptiSaas_Secure_!2026', timeout=10)

    cmd = 'tail -n 200 ~/.pm2/logs/*error.log'
    
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("STDOUT:")
    print(stdout.read().decode())
    print("STDERR:")
    print(stderr.read().decode())
    ssh.close()

if __name__ == '__main__':
    run()
