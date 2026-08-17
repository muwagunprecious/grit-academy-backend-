import { PrismaClient } from '@prisma/client';

const URL = 'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

async function wipePurchases() {
  console.log('⚡ Wiping ALL purchase records from Supabase Cloud DB...\n');

  const deleted = await prisma.purchase.deleteMany({});
  console.log(`✅ Completely deleted ${deleted.count} purchase records from grit_purchases.`);
  console.log('🔒 Every student account now strictly starts at 0 purchases and requires ₦500 Paystack payment!');

  await prisma.$disconnect();
}

wipePurchases();
