import { PrismaClient } from '@prisma/client';

const URL = 'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

async function resetPurchases() {
  console.log('⚡ Clearing all mock student purchase records in Supabase Cloud DB...\n');

  // Delete purchases belonging to STUDENT users so all students require the 500 NGN fee
  const deleted = await prisma.purchase.deleteMany({
    where: {
      user: {
        role: 'STUDENT',
      },
    },
  });

  console.log(`✅ Cleared ${deleted.count} mock/test purchase records for student accounts.`);
  console.log('🔒 All student accounts now strictly require ₦500 Paystack access fee payment!');

  await prisma.$disconnect();
}

resetPurchases();
