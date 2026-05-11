const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

async function main() {
  try {
    const employeeId = 'fe318ac2-c67e-4b20-8689-4d85e949fd93';
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36'; // Rabat
    const amount = 100;
    const mode = 'ESPECES';
    const userId = '1354972e-3363-455a-8b83-9b6264669894'; // Admin user ID from logs potentially

    console.log('Testing recordAdvance via Prisma directly...');
    
    // Simulate what ExpensesService.create does
    const result = await prisma.$transaction(async (tx) => {
        const expense = await tx.depense.create({
            data: {
                date: new Date(),
                montant: amount,
                categorie: 'AVANCE_SALAIRE',
                description: 'Test Avance',
                modePaiement: mode,
                statut: 'VALIDEE',
                centreId: centreId,
                creePar: 'System',
                employeeId: employeeId
            }
        });
        
        // Find open session
        const openSession = await tx.journeeCaisse.findFirst({
            where: {
                caisse: {
                    centreId: centreId,
                    type: { in: ['DEPENSES', 'MIXTE', 'PRINCIPALE'] },
                    statut: 'ACTIVE'
                },
                statut: 'OUVERTE'
            },
            include: { caisse: true },
            orderBy: { createdAt: 'desc' }
        });

        if (openSession) {
            const availableCash = (openSession.fondInitial || 0) + (openSession.totalInterne || 0) + (openSession.totalVentesEspeces || 0) - (openSession.totalDepenses || 0);
            
            if (availableCash < amount && mode === 'ESPECES') {
                console.log('Creating DemandeAlimentation...');
                await tx.demandeAlimentation.create({
                    data: {
                        montant: amount,
                        depenseId: expense.id,
                        journeeCaisseId: openSession.id,
                        statut: 'EN_ATTENTE'
                    }
                });
                
                await tx.depense.update({
                    where: { id: expense.id },
                    data: { statut: 'EN_ATTENTE_ALIMENTATION' }
                });
            } else {
                 await tx.operationCaisse.create({
                    data: {
                        type: 'DECAISSEMENT',
                        typeOperation: 'INTERNE',
                        montant: amount,
                        moyenPaiement: mode,
                        motif: `Dépense: AVANCE_SALAIRE`,
                        reference: expense.id,
                        utilisateur: 'System',
                        journeeCaisseId: openSession.id
                    }
                });
            }
        }
        return expense;
    });

    console.log('Success!', result);
  } catch (e) {
    console.error('Error during test:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
