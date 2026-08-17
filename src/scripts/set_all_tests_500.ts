import { PrismaClient } from '@prisma/client';

const URLS = [
  'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@aws-0-eu-west-2.pooler.supabase.com:5432/postgres',
  'postgresql://postgres.zgcfacamuapspxcayutf:hw5XjGXwNE8w7BpA@db.zgcfacamuapspxcayutf.supabase.co:5432/postgres',
];

async function tryUpdate() {
  for (const url of URLS) {
    console.log(`Trying database connection: ${url.split('@')[1]}...`);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const result = await prisma.test.updateMany({
        data: { price: 500 },
      });
      console.log(`\n✅ SUCCESS! Updated ${result.count} test packages to ₦500 access fee on ${url.split('@')[1]}!\n`);
      await prisma.$disconnect();
      return;
    } catch (e: any) {
      console.log(`Failed on ${url.split('@')[1]}: ${e.message?.slice(0, 100)}`);
      await prisma.$disconnect();
    }
  }
}

tryUpdate();
