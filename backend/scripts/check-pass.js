
const { PrismaClient } = require('@prisma/client');
async function checkLength() {
  const prisma = new PrismaClient();
  try {
    const config = await prisma.marketingConfig.findFirst();
    if (config && config.smtpPass) {
      console.log(`Password length: ${config.smtpPass.length}`);
      console.log(`Contains spaces?: ${config.smtpPass.includes(' ')}`);
      // check if it looks like a regular password vs app password
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
checkLength();
