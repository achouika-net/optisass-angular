
import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';

async function diagnose() {
  const prisma = new PrismaClient();
  try {
    const config = await prisma.marketingConfig.findFirst();
    if (!config) {
      console.log('❌ Aucune configuration trouvée dans la base de données.');
      return;
    }

    console.log('--- Diagnostic SMTP ---');
    console.log(`Host: ${config.smtpHost}`);
    console.log(`Port: ${config.smtpPort}`);
    console.log(`User: ${config.smtpUser}`);
    console.log(`Has Password: ${config.smtpPass ? 'Oui' : 'Non'}`);
    console.log(`From: ${config.smtpFrom}`);

    const transporter = nodemailer.createTransport({
      host: config.smtpHost as string,
      port: Number(config.smtpPort),
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser as string,
        pass: config.smtpPass as string,
      },
      tls: { rejectUnauthorized: false }
    } as any);

    console.log('\nTentative de connexion...');
    try {
      await transporter.verify();
      console.log('✅ Connexion SMTP RÉUSSIE !');
    } catch (err) {
      console.log('❌ ÉCHEC de la connexion SMTP :');
      console.log(err.message);
      
      if (err.message.includes('535-5.7.8')) {
        console.log('\n💡 Conseil : C\'est une erreur d\'IDENTIFIANTS.');
        console.log('1. Vérifiez que l\'utilisateur est bien votre adresse Gmail complète.');
        console.log('2. Le mot de passe DOIT être le code de 16 caractères de Google (App Password).');
      } else if (err.message.includes('ETIMEDOUT') || err.message.includes('ENOTFOUND')) {
        console.log('\n💡 Conseil : C\'est une erreur de RÉSEAU.');
        console.log('Vérifiez le Host (smtp.gmail.com) et le Port (587 ou 465).');
      }
    }
  } catch (error) {
    console.error('Erreur lors du diagnostic :', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
