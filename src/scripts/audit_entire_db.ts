import prisma from '../lib/prisma.js';

async function auditAll() {
  console.log('🧐 Starting exhaustive audit of all subjects in DB...\n');

  const dbSubjects = await prisma.subject.findMany();
  const subjectMap = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectMap.set(s.name.toLowerCase(), s.id);
  }

  // Exact domain keyword indicators for each target subject
  const DOMAIN_INDICATORS: Record<string, RegExp[]> = {
    Government: [
      /\b(constitution|president|executive|legislature|judiciary|democracy|federation|electorate|sovereignty|monarchy|dictatorship|fascism|ecowas|senate|governor|referendum|indirect rule|authority|elections|pressure group)\b/i
    ],
    English: [
      /\b(passage|author|synonym|antonym|underlined|stress|syllable|vowel sound|consonant sound|grammatically|fill the gap|nearest in meaning|opposite in meaning|comprehension|figure of speech|metaphor|simile|personification|irony|oxymoron)\b/i
    ],
    Chemistry: [
      /\b(acid|base|salt|mole|reaction|compound|catalyst|oxidation|hydrogen|oxygen|nitrogen|copper|sulphate|sulfate|chloride|solution|hydrocarbon|alkanol|alkene|alkyne|alkane|ph |iupac|cuso4|h2so4|hcl|naoh|co2|periodic table|molar|precipitate|titration)\b/i
    ],
    Physics: [
      /(?<!pressure\s)(?<!wave\ssof\s)\b(velocity|acceleration|force|momentum|current|voltage|resistance|ohm|capacitor|refraction|reflection|lens|mirror|frequency|wavelength|watt|newton|gravity|density|pressure|gamma|alpha|beta|circuit|resonance|pendulum|friction|scalar|vector|electroscope|dielectric|solenoid|galvanometer|focal length)\b/i
    ],
    Mathematics: [
      /\b(evaluate|simplify|bearing|l\.c\.m|h\.c\.f|gradient|polygon|variance|mean deviation|inequality|factorize|logarithm|dx\/dy|simultaneous|geometric progression|arithmetic progression|sine|cosine|tangent|matrix|venn)\b/i
    ],
    Biology: [
      /\b(cell|tissue|organ|organism|blood|heart|leaf|root|stem|flower|species|gene|dna|rna|chromosome|meiosis|mitosis|photosynthesis|respiration|excretory|kidney|liver|digestion|trophic|food web|heredity|parasite|bacteria|virus|fungi|insect|mammal|amphibian|reptile|neuron|brain|hormone|pancreas|enzyme|chloroplast|mitochondria|xylem|phloem)\b/i
    ],
    CRS: [
      /\b(jesus|christ|bible|disciples|peter|paul|gospel|prophet|elijah|elisha|moses|joshua|david|solomon|israel|beatitudes|siloam|pentecost|apostle|resurrection|salvation|herod|ananias|sapphira|gideon|jerusalem council)\b/i
    ],
    Literature: [
      /\b(novel|playwright|soliloquy|lullaby|sonnet|quatrain|couplet|shakespeare|prospero|caliban|femi osofisan|women of owu|blinkards|arms and the man|lord of the flies|importance of being earnest|oscar wilde|jack worthing|lenrie peters)\b/i
    ],
    Commerce: [
      /\b(warehouse|insurance|bill of lading|shares|shareholder|partnership|sole proprietor|limited liability|naccima|freight|retailing|wholesaling|stock exchange|debit note|invoice|bonded warehouse|vertical integration|horizontal integration)\b/i
    ],
    Economics: [
      /\b(inflation|opportunity cost|scale of preference|elasticity|laissez-faire|microeconomics|macroeconomics|scarcity|utility|marginal utility|planned economy|market economy)\b/i
    ],
  };

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  let reclassified = 0;

  for (const q of allQuestions) {
    const text = q.text;
    const currentSubject = q.subject?.name || '';

    // Check if another subject has a stronger match
    for (const [targetSubject, patterns] of Object.entries(DOMAIN_INDICATORS)) {
      if (targetSubject === currentSubject) continue;

      const isMatch = patterns.some(p => p.test(text));
      if (isMatch) {
        // Double check it doesn't match current subject
        const currentPatterns = DOMAIN_INDICATORS[currentSubject] || [];
        const currentMatch = currentPatterns.some(p => p.test(text));

        if (!currentMatch) {
          const targetId = subjectMap.get(targetSubject.toLowerCase());
          if (targetId) {
            console.log(`📌 RECLASSIFYING: "${text.slice(0, 60)}..."`);
            console.log(`   From: ${currentSubject}  ➔  To: ${targetSubject}`);
            await prisma.question.update({
              where: { id: q.id },
              data: { subjectId: targetId },
            });
            reclassified++;
            break;
          }
        }
      }
    }
  }

  console.log(`\n🎉 Audit finished. Reclassified ${reclassified} misplaced questions.`);

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- VERIFIED CLEAN QUESTION COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

auditAll().catch(console.error).finally(() => prisma.$disconnect());
