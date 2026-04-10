import paramiko

def run():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('151.80.146.74', username='ubuntu', password='OptiSaas_Secure_!2026', timeout=10)

    # Get both logs
    _, stdout_err, _ = ssh.exec_command('tail -n 1000 ~/.pm2/logs/optisaas-backend-demo-error.log')
    _, stdout_out, _ = ssh.exec_command('tail -n 1000 ~/.pm2/logs/optisaas-backend-demo-out.log')
    
    with open('optisaas_error_tail.log', 'w', encoding='utf-8') as f:
        f.write(stdout_err.read().decode(errors='replace'))
        
    with open('optisaas_out_tail.log', 'w', encoding='utf-8') as f:
        f.write(stdout_out.read().decode(errors='replace'))
    
    ssh.close()

if __name__ == '__main__':
    run()
