import prisma from '../lib/prisma.js';

interface SubjectKeywordRule {
  name: string;
  keywords: string[];
}

const RULES: SubjectKeywordRule[] = [
  {
    name: 'Chemistry',
    keywords: [
      'acid', 'base', 'salt', 'mole', 'reaction', 'compound', 'element', 'catalyst',
      'oxidation', 'hydrogen', 'oxygen', 'nitrogen', 'copper', 'sulphate', 'sulfate',
      'chloride', 'solution', 'atomic', 'hydrocarbon', 'alkanol', 'alkene', 'alkyne',
      'alkane', 'ph ', 'electron configuration', 'iupac', 'cuso4', 'h2so4', 'hcl', 'naoh',
      'co2', 'zn', 'fe', 'orbitals', 'electronegativity', 'periodic table', 'gasification',
      'saponification', 'esterification', 'valency', 'molar', 'precipitate', 'titration',
      'potassium', 'carbonate', 'calcium', 'magnesium', 'distillation', 'crystallization',
      'amphoteric', 'isomer', 'isomerism', 'halogen', 'paraffin', 'paraffins'
    ],
  },
  {
    name: 'Physics',
    keywords: [
      'velocity', 'acceleration', 'mass', 'force', 'momentum', 'current', 'voltage',
      'resistance', 'ohm', 'capacitor', 'wave', 'light', 'refraction', 'reflection',
      'lens', 'mirror', 'frequency', 'wavelength', 'power', 'work', 'joule', 'watt',
      'newton', 'gravity', 'density', 'pressure', 'temperature', 'heat', 'spectrum',
      'magnetic', 'radiation', 'gamma', 'alpha', 'beta', 'circuit', 'resonance',
      'pendulum', 'friction', 'scalar', 'vector', 'upthrust', 'electroscope', 'dielectric',
      'solenoid', 'galvanometer', 'telescope', 'astronomical', 'upright image', 'focal length',
      'distance of', 'speed of light', 'kinetic energy', 'potential energy', 'evacuation', 'pascal'
    ],
  },
  {
    name: 'Mathematics',
    keywords: [
      'evaluate', 'simplify', 'equation', 'triangle', 'angle', 'bearing', 'l.c.m', 'h.c.f',
      'gradient', 'polygon', 'ratio', 'percentage', 'variance', 'median', 'mean deviation',
      'inequality', 'fraction', 'factorize', 'logx', 'logarithm', 'dx/dy', 'simultaneous',
      'progression', 'geometric', 'arithmetic', 'sine', 'cosine', 'tangent', 'matrix',
      'venn', 'quadratic', 'polynomial', 'calculus', 'significant figures', 'base six',
      'base two', 'pythagoras', 'hypotenuse', 'perimeter', 'volume of'
    ],
  },
  {
    name: 'Biology',
    keywords: [
      'cell', 'tissue', 'organ', 'organism', 'plant', 'animal', 'blood', 'heart',
      'leaf', 'root', 'stem', 'flower', 'species', 'gene', 'dna', 'rna', 'chromosome',
      'meiosis', 'mitosis', 'photosynthesis', 'respiration', 'excretory', 'kidney',
      'liver', 'digestion', 'ecosystem', 'trophic', 'food web', 'variation', 'heredity',
      'parasite', 'bacteria', 'virus', 'fungi', 'insect', 'fish', 'mammal', 'amphibian',
      'reptile', 'habitat', 'neuron', 'brain', 'hormone', 'pancreas', 'enzyme',
      'chloroplast', 'mitochondria', 'xylem', 'phloem', 'clitellum', 'poikilothermic',
      'turgid', 'plasmolysis', 'endosmosis', 'exosmosis', 'nephridium', 'malpighian',
      'rhizomes', 'gamete', 'zygote', 'stomata', 'ecosystem', 'hereditary'
    ],
  },
  {
    name: 'English',
    keywords: [
      'passage', 'author', 'writer', 'synonym', 'antonym', 'underlined', 'stress',
      'syllable', 'vowel sound', 'consonant sound', 'word(s)', 'phrase', 'grammatically',
      'fill the gap', 'nearest in meaning', 'opposite in meaning', 'comprehension',
      'idiom', 'figure of speech', 'metaphor', 'simile', 'personification', 'irony',
      'oxymoron', 'preposition', 'noun', 'verb', 'adjective', 'adverb', 'pronoun',
      'white man', 'unachukwu', 'ludo', 'demeaning', 'pleasantries', 'respite', 'nebulous',
      'impassioned', 'apogee', 'euphoria', 'inflammatory', 'jaundiced', 'renegade', 'debilitating',
      'rescinded', 'wilful', 'obstinate', 'story', 'moral of the story'
    ],
  },
  {
    name: 'Literature',
    keywords: [
      'novel', 'play', 'drama', 'playwright', 'act', 'scene', 'stanza', 'rhyme',
      'poem', 'poet', 'character', 'plot', 'theme', 'protagonist', 'tragedy', 'comedy',
      'soliloquy', 'lullaby', 'sonnet', 'quatrain', 'couplet', 'shakespeare', 'tempest',
      'prospero', 'miranda', 'caliban', 'femi osofisan', 'women of owu', 'blinkards',
      'arms and the man', 'lord of the flies', 'importance of being earnest', 'oscar wilde',
      'jack worthing', 'myopia', 'lenrie peters', 'the fence'
    ],
  },
  {
    name: 'Government',
    keywords: [
      'constitution', 'executive', 'legislature', 'judiciary', 'democracy',
      'federation', 'election', 'electorate', 'sovereignty', 'monarchy',
      'dictatorship', 'fascism', 'socialism', 'capitalism', 'feudalism', 'colonial',
      'protectorate', 'ecowas', 'uno', 'united nations', 'senate', 'governor',
      'franchise', 'referendum', 'indirect rule', 'lord lugard', 'aba women', 'civic',
      'separation of powers', 'montesquieu', 'oligarchy', 'totalitarianism', 'ecomog'
    ],
  },
  {
    name: 'Economics',
    keywords: [
      'inflation', 'supply', 'demand', 'opportunity cost', 'scale of preference',
      'elasticity', 'monopoly', 'oligopoly', 'laissez-faire', 'microeconomics',
      'macroeconomics', 'scarcity', 'normative', 'utility', 'marginal utility',
      'consumer behaviour', 'factors of production', 'planned economy', 'market economy'
    ],
  },
  {
    name: 'Commerce',
    keywords: [
      'trade', 'warehouse', 'insurance', 'transport', 'shipping', 'export', 'import',
      'bill of lading', 'shares', 'shareholder', 'company', 'partnership',
      'sole proprietor', 'limited liability', 'naccima', 'customs', 'freight',
      'retailing', 'wholesaling', 'stock exchange', 'debit note', 'invoice',
      'bonded warehouse', 'vertical integration', 'horizontal integration', 're-insurance'
    ],
  },
  {
    name: 'CRS',
    keywords: [
      'jesus', 'god', 'christ', 'bible', 'disciples', 'peter', 'paul', 'gospel',
      'prophet', 'elijah', 'elisha', 'moses', 'joshua', 'david', 'solomon', 'israel',
      'beatitudes', 'siloam', 'pentecost', 'apostle', 'resurrection', 'salvation',
      'herod', 'ananias', 'sapphira', 'gideon', 'jerusalem council', 'galatians', 'corinthians'
    ],
  },
];

async function main() {
  console.log('🔄 Starting Question Subject Reclassification & Cleanup...');

  const dbSubjects = await prisma.subject.findMany();
  const subjectIdByName = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectIdByName.set(s.name.toLowerCase(), s.id);
  }

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  console.log(`Total questions in database: ${allQuestions.length}`);

  let movedCount = 0;
  let explanationCleanedCount = 0;

  for (const q of allQuestions) {
    const fullSearchText = (q.text + ' ' + (q.topic || '') + ' ' + JSON.stringify(q.options)).toLowerCase();

    // Compute scores per subject rule
    let bestSubjectName: string | null = null;
    let maxScore = 0;

    for (const rule of RULES) {
      let score = 0;
      for (const kw of rule.keywords) {
        if (fullSearchText.includes(kw.toLowerCase())) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestSubjectName = rule.name;
      }
    }

    // Only reclassify if we have a strong match (maxScore >= 2) and subject exists
    let newSubjectId = q.subjectId;
    if (bestSubjectName && maxScore >= 2) {
      const targetId = subjectIdByName.get(bestSubjectName.toLowerCase());
      if (targetId && targetId !== q.subjectId) {
        newSubjectId = targetId;
        movedCount++;
      }
    }

    // Clean up generic placeholder explanations like "Past examination question for..."
    let updatedExplanation = q.explanation;
    if (q.explanation && q.explanation.toLowerCase().includes('past examination question')) {
      updatedExplanation = null; // Set to null so Step-by-Step AI Correction button is triggered
      explanationCleanedCount++;
    }

    if (newSubjectId !== q.subjectId || updatedExplanation !== q.explanation) {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          subjectId: newSubjectId,
          explanation: updatedExplanation,
        },
      });
    }
  }

  console.log(`\n✅ Reclassification complete!`);
  console.log(`- Questions moved to correct subjects: ${movedCount}`);
  console.log(`- Generic explanations cleaned: ${explanationCleanedCount}`);

  // Final subject tally
  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- Corrected Subject Counts ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
