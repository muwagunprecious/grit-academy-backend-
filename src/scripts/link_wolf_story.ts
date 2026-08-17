import prisma from '../lib/prisma.js';

async function main() {
  const wolfStory = `A wolf, seeing a lamb drinking from a river, wanted to find a pretext for devouring him. He stood higher up the stream and the lamb of muddying the water so that he could not drink. The lamb said that he drink only with the tip of his tongue, and that in any case he was standing lower down the river, and could not possibly disturb the water higher up: when this excuse failed him, the wolf said: well, last year you insulted my father I was not even born then, replied the lamb.

You are good at finding answers, said the wolf, "but what do you mean by taking up so much of the path where I am walking?" The lamb, frightened at the wolf's angry tone and terrible aspect, told him with all die submission, that he could not conceive how his walking on such a wide could occasion him any convenience. What! exclaimed the wolf, seemingly in great anger and indignation. 'You are as imprudent as your father who seized me by the throat last year, and caused me to be kept in cage for three months'.

If you will believe me, 'said the lamb my parents are poor simple creatures who lived entirely by green stuffs, we are none of us hunters of your species, ' 'Ah I see its no use talking to you' said the wolf, drawing up closed to him. 'it runs in the blood of your family to hate us wolf and therefore we have come conveniently together, I'll just pay off a few of your fore fathers' scores before we part.' So, saying, he leapt at the lamb from behind and garrotted him.`;

  // Find English subject
  const englishSub = await prisma.subject.findFirst({ where: { name: 'English' } });
  if (!englishSub) return;

  const result = await prisma.question.updateMany({
    where: {
      subjectId: englishSub.id,
      OR: [
        { text: { contains: 'moral of the story' } },
        { text: { contains: 'excuse failed' } },
        { text: { contains: 'angry tone' } },
        { text: { contains: 'charges levelled' } },
        { text: { contains: 'story ended' } },
      ],
    },
    data: {
      passage: wolfStory,
      topic: 'Reading Passage & Story',
    },
  });

  console.log(`Updated ${result.count} questions with the Wolf & Lamb story passage!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
