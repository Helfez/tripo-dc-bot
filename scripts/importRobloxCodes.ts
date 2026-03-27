/**
 * Bulk-import Roblox redemption codes from a text file.
 *
 * Usage:
 *   npx ts-node scripts/importRobloxCodes.ts <path-to-codes.txt>
 *
 * The file should contain one code per line.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx ts-node scripts/importRobloxCodes.ts <path-to-codes.txt>');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const text = fs.readFileSync(resolved, 'utf-8');
  const codes = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  if (codes.length === 0) {
    console.error('No codes found in the file.');
    process.exit(1);
  }

  console.log(`Found ${codes.length} codes. Importing...`);

  const prisma = new PrismaClient();
  try {
    const result = await prisma.robloxCode.createMany({
      data: codes.map(code => ({ code })),
      skipDuplicates: true,
    });
    console.log(`Imported ${result.count} codes (skipped ${codes.length - result.count} duplicates).`);

    const available = await prisma.robloxCode.count({ where: { discordId: null } });
    console.log(`Total available codes: ${available}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
