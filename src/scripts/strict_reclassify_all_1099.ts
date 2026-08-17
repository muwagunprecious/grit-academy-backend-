import prisma from '../lib/prisma.js';

async function strictReclassify() {
  console.log('🚨 Starting Strict Domain Reclassification Across All 1,099 Database Questions...\n');

  const dbSubjects = await prisma.subject.findMany();
  const subjectMap = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectMap.set(s.name.toLowerCase(), s.id);
  }

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  console.log(`Loaded ${allQuestions.length} total questions.`);

  let reclassifiedCount = 0;

  for (const q of allQuestions) {
    const textLower = (q.text + ' ' + JSON.stringify(q.options)).toLowerCase();
    let targetSubject = '';

    // 1. BIOLOGY INDICATORS
    if (
      /\b(termites|cellulose|protozoans|guts|saprophytism|mutualism|parasitism|commensalism|cell|tissue|organism|blood|leaf|root|stem|flower|species|gene|dna|rna|meiosis|mitosis|photosynthesis|respiration|excretory|kidney|liver|digestion|heredity|parasite|bacteria|virus|fungi|insect|mammal|amphibian|reptile|neuron|brain|hormone|pancreas|enzyme|chloroplast|mitochondria|xylem|phloem)\b/i.test(textLower)
    ) {
      targetSubject = 'Biology';
    }
    // 2. CHEMISTRY INDICATORS
    else if (
      /\b(cycloalkane|alkane|alkene|alkyne|orbital|fluorine|p-orbital|mol dm-3|percentage by weight|hydrocarbon|alkanol|esterification|saponification|cassiterite|vulcanization|electrovalent|covalent|paraffin|dinitrophenylhydrazine|lucas reagent|trioxocarbonate|tetraoxosulphate|trioxonitrate|water of crystallization|bleaching agent|acid|base|salt|mole|reaction|compound|catalyst|oxidation|hydrogen|oxygen|nitrogen|copper|sulphate|sulfate|chloride|solution|ph |iupac|cuso4|h2so4|hcl|naoh|co2|periodic table|molar|precipitate|titration)\b/i.test(textLower)
    ) {
      targetSubject = 'Chemistry';
    }
    // 3. PHYSICS INDICATORS
    else if (
      /\b(radioactive|half-life|half-live|work done|joule|sound wave|frequency|hz|velocity|ms-1|antinode|cross-sectional area|resistivity|Ωm|expansivity|linear expansivity|momentum|kgms-1|force acting|force|acceleration|voltage|resistance|ohm|capacitor|refraction|reflection|lens|mirror|wavelength|watt|newton|gravity|density|pressure|gamma|alpha|beta|circuit|resonance|pendulum|friction|scalar|vector|electroscope|dielectric|solenoid|galvanometer|focal length)\b/i.test(textLower)
    ) {
      targetSubject = 'Physics';
    }
    // 4. GOVERNMENT INDICATORS
    else if (
      /\b(inter-communal|conflict|litigation|dialogue|mediation|constitution|president|executive|legislature|judiciary|democracy|federation|electorate|sovereignty|monarchy|dictatorship|fascism|ecowas|senate|governor|referendum|indirect rule|authority|elections|pressure group|hausa-fulani|emirate)\b/i.test(textLower)
    ) {
      targetSubject = 'Government';
    }
    // 5. LITERATURE INDICATORS
    else if (
      /\b(novel|playwright|soliloquy|lullaby|sonnet|quatrain|couplet|shakespeare|prospero|caliban|femi osofisan|women of owu|blinkards|arms and the man|lord of the flies|importance of being earnest|oscar wilde|jack worthing|lenrie peters)\b/i.test(textLower)
    ) {
      targetSubject = 'Literature';
    }
    // 6. CRS INDICATORS
    else if (
      /\b(jesus|christ|bible|disciples|peter|paul|gospel|prophet|elijah|elisha|moses|joshua|david|solomon|israel|beatitudes|siloam|pentecost|apostle|resurrection|salvation|herod|ananias|sapphira|gideon|jerusalem council)\b/i.test(textLower)
    ) {
      targetSubject = 'CRS';
    }
    // 7. ECONOMICS INDICATORS
    else if (
      /\b(inflation|opportunity cost|scale of preference|elasticity|laissez-faire|microeconomics|macroeconomics|scarcity|utility|marginal utility|planned economy|market economy)\b/i.test(textLower)
    ) {
      targetSubject = 'Economics';
    }
    // 8. COMMERCE INDICATORS
    else if (
      /\b(warehouse|insurance|bill of lading|shares|shareholder|partnership|sole proprietor|limited liability|naccima|freight|retailing|wholesaling|stock exchange|debit note|invoice|bonded warehouse)\b/i.test(textLower)
    ) {
      targetSubject = 'Commerce';
    }
    // 9. ENGLISH INDICATORS
    else if (
      /\b(passage|author|synonym|antonym|underlined|stress|syllable|vowel sound|consonant sound|grammatically|fill the gap|nearest in meaning|opposite in meaning|comprehension|figure of speech|metaphor|simile|personification|irony|oxymoron)\b/i.test(textLower)
    ) {
      targetSubject = 'English';
    }
    // 10. MATHEMATICS INDICATORS
    else if (
      /\b(evaluate|simplify|bearing|l\.c\.m|h\.c\.f|gradient|polygon|variance|mean deviation|inequality|factorize|logarithm|dx\/dy|dy\/dx|simultaneous|geometric progression|arithmetic progression|sine|cosine|tangent|matrix|venn|probability|quadratic|perimeter|hypotenuse)\b/i.test(textLower)
    ) {
      targetSubject = 'Mathematics';
    }

    if (targetSubject && targetSubject !== q.subject?.name) {
      const targetId = subjectMap.get(targetSubject.toLowerCase());
      if (targetId) {
        console.log(`✨ RECLASSIFIED [${q.subject?.name} ➔ ${targetSubject}]: "${q.text.slice(0, 65)}..."`);
        await prisma.question.update({
          where: { id: q.id },
          data: {
            subjectId: targetId,
            topic: `${targetSubject} Past Questions`,
          },
        });
        reclassifiedCount++;
      }
    }
  }

  console.log(`\n🎉 STRICT RECLASSIFICATION COMPLETE!`);
  console.log(`- Reclassified ${reclassifiedCount} misplaced questions.`);

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL VERIFIED SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

strictReclassify().catch(console.error).finally(() => prisma.$disconnect());
