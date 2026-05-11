const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

async function setConfig(trigger, payment) {
  try {
    const config = await prisma.commissionConfig.findFirst();
    const id = config ? config.id : 'global';
    
    await prisma.commissionConfig.upsert({
      where: { id },
      update: { triggerType: trigger, paymentCondition: payment },
      create: { id, triggerType: trigger, paymentCondition: payment }
    });
    
    console.log(`✅ Configuration mise à jour :`);
    console.log(`- Déclencheur : ${trigger} (Mode BC ou FACTURE)`);
    console.log(`- Condition de paiement : ${payment} (Mode TOUT, PARTIEL ou SOLDE)`);
  } catch (e) {
    console.error('Erreur:', e);
  } finally {
    await prisma.$disconnect();
  }
}

// Récupérer les arguments
const trigger = process.argv[2] || 'FACTURE';
const payment = process.argv[3] || 'SOLDE';

setConfig(trigger, payment);
