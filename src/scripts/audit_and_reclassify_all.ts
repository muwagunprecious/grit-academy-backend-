import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';

const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Domain Keyword Dictionaries for Instant Rule Matching
const DOMAIN_RULES: Record<string, string[]> = {
  Physics: [
    'velocity', 'acceleration', 'mass', 'force', 'momentum', 'current', 'voltage',
    'resistance', 'ohm', 'capacitor', 'wave', 'light', 'refraction', 'reflection',
    'lens', 'mirror', 'frequency', 'wavelength', 'power', 'work', 'joule', 'watt',
    'newton', 'gravity', 'density', 'pressure', 'heat', 'spectrum', 'magnetic',
    'radiation', 'gamma', 'alpha', 'beta', 'circuit', 'resonance', 'pendulum',
    'friction', 'scalar', 'vector', 'upthrust', 'electroscope', 'dielectric',
    'solenoid', 'galvanometer', 'telescope', 'astronomical', 'focal length',
    'speed of light', 'kinetic energy', 'potential energy', 'pascal', 'microfarad',
    'convex', 'concave', 'echo', 'sound waves', 'isotherm', 'isobar', 'orographic',
    'h.e.p.', 'rectifiers', 'refrigeration', 'expansion of', 'thermodynamic'
  ],
  Chemistry: [
    'acid', 'base', 'salt', 'mole', 'reaction', 'compound', 'element', 'catalyst',
    'oxidation', 'hydrogen', 'oxygen', 'nitrogen', 'copper', 'sulphate', 'sulfate',
    'chloride', 'solution', 'atomic', 'hydrocarbon', 'alkanol', 'alkene', 'alkyne',
    'alkane', 'ph ', 'electron configuration', 'iupac', 'cuso4', 'h2so4', 'hcl', 'naoh',
    'co2', 'zn', 'fe', 'orbitals', 'electronegativity', 'periodic table', 'gasification',
    'saponification', 'esterification', 'valency', 'molar', 'precipitate', 'titration',
    'potassium', 'carbonate', 'calcium', 'magnesium', 'distillation', 'crystallization',
    'amphoteric', 'isomer', 'isomerism', 'halogen', 'paraffin', 'paraffins', 'paraffin oil',
    'bleaching agent', 'water of crystallization', 'brownian motion', 'lucas reagent',
    'trioxonitrate', 'trioxocarbonate', 'tetraoxosulphate', 'methane', 'ethane', 'propane',
    'benzene', 'cyclohexane', 'dinitrophenylhydrazine', 'tollen'
  ],
  Biology: [
    'cell', 'tissue', 'organ', 'organism', 'plant', 'animal', 'blood', 'heart',
    'leaf', 'root', 'stem', 'flower', 'species', 'gene', 'dna', 'rna', 'chromosome',
    'meiosis', 'mitosis', 'photosynthesis', 'respiration', 'excretory', 'kidney',
    'liver', 'digestion', 'ecosystem', 'trophic', 'food web', 'variation', 'heredity',
    'parasite', 'bacteria', 'virus', 'fungi', 'insect', 'fish', 'mammal', 'amphibian',
    'reptile', 'habitat', 'neuron', 'brain', 'hormone', 'pancreas', 'enzyme',
    'chloroplast', 'mitochondria', 'xylem', 'phloem', 'clitellum', 'poikilothermic',
    'turgid', 'plasmolysis', 'endosmosis', 'exosmosis', 'nephridium', 'malpighian',
    'rhizomes', 'gamete', 'zygote', 'stomata', 'ecosystem', 'hereditary', 'euglena',
    'amoeba', 'hydra', 'paramecium', 'spirogyra', 'chlamydomonas', 'arthropod', 'locust',
    'tapeworm', 'earthworm', 'centipede', 'ribosome', 'cytokinesis', 'karyokinesis',
    'zygomorphic', 'actinomorphic', 'drupes', 'pomes', 'berries', 'monocotyledon', 'dicotyledon'
  ],
  Mathematics: [
    'evaluate', 'simplify', 'equation', 'triangle', 'angle', 'bearing', 'l.c.m', 'h.c.f',
    'gradient', 'polygon', 'ratio', 'percentage', 'variance', 'median', 'mean deviation',
    'inequality', 'fraction', 'factorize', 'logx', 'logarithm', 'dx/dy', 'simultaneous',
    'progression', 'geometric', 'arithmetic', 'sine', 'cosine', 'tangent', 'matrix',
    'venn', 'quadratic', 'polynomial', 'calculus', 'significant figures', 'base six',
    'base two', 'pythagoras', 'hypotenuse', 'perimeter', 'volume of'
  ],
  English: [
    'passage', 'author', 'writer', 'synonym', 'antonym', 'underlined', 'stress',
    'syllable', 'vowel sound', 'consonant sound', 'word(s)', 'phrase', 'grammatically',
    'fill the gap', 'nearest in meaning', 'opposite in meaning', 'comprehension',
    'idiom', 'figure of speech', 'metaphor', 'simile', 'personification', 'irony',
    'oxymoron', 'preposition', 'noun', 'verb', 'adjective', 'adverb', 'pronoun',
    'white man', 'unachukwu', 'ludo', 'demeaning', 'pleasantries', 'respite', 'nebulous',
    'impassioned', 'apogee', 'euphoria', 'inflammatory', 'jaundiced', 'renegade', 'debilitating',
    'rescinded', 'wilful', 'obstinate', 'story', 'moral of the story'
  ],
  Literature: [
    'novel', 'play', 'drama', 'playwright', 'act', 'scene', 'stanza', 'rhyme',
    'poem', 'poet', 'character', 'plot', 'theme', 'protagonist', 'tragedy', 'comedy',
    'soliloquy', 'lullaby', 'sonnet', 'quatrain', 'couplet', 'shakespeare', 'tempest',
    'prospero', 'miranda', 'caliban', 'femi osofisan', 'women of owu', 'blinkards',
    'arms and the man', 'lord of the flies', 'importance of being earnest', 'oscar wilde',
    'jack worthing', 'myopia', 'lenrie peters', 'the fence'
  ],
  Government: [
    'constitution', 'executive', 'legislature', 'judiciary', 'democracy',
    'federation', 'election', 'electorate', 'sovereignty', 'monarchy',
    'dictatorship', 'fascism', 'socialism', 'capitalism', 'feudalism', 'colonial',
    'protectorate', 'ecowas', 'uno', 'united nations', 'senate', 'governor',
    'franchise', 'referendum', 'indirect rule', 'lord lugard', 'aba women', 'civic',
    'separation of powers', 'montesquieu', 'oligarchy', 'totalitarianism', 'ecomog'
  ],
  Economics: [
    'inflation', 'supply', 'demand', 'opportunity cost', 'scale of preference',
    'elasticity', 'monopoly', 'oligopoly', 'laissez-faire', 'microeconomics',
    'macroeconomics', 'scarcity', 'normative', 'utility', 'marginal utility',
    'consumer behaviour', 'factors of production', 'planned economy', 'market economy'
  ],
  Commerce: [
    'trade', 'warehouse', 'insurance', 'transport', 'shipping', 'export', 'import',
    'bill of lading', 'shares', 'shareholder', 'company', 'partnership',
    'sole proprietor', 'limited liability', 'naccima', 'customs', 'freight',
    'retailing', 'wholesaling', 'stock exchange', 'debit note', 'invoice',
    'bonded warehouse', 'vertical integration', 'horizontal integration', 're-insurance'
  ],
  CRS: [
    'jesus', 'god', 'christ', 'bible', 'disciples', 'peter', 'paul', 'gospel',
    'prophet', 'elijah', 'elisha', 'moses', 'joshua', 'david', 'solomon', 'israel',
    'beatitudes', 'siloam', 'pentecost', 'apostle', 'resurrection', 'salvation',
    'herod', 'ananias', 'sapphira', 'gideon', 'jerusalem council', 'galatians', 'corinthians'
  ],
};

function classifyByRules(text: string, optionsText: string): { subject: string; score: number } {
  const fullText = (text + ' ' + optionsText).toLowerCase();

  let maxScore = 0;
  let bestSubject = '';

  for (const [subject, keywords] of Object.entries(DOMAIN_RULES)) {
    let score = 0;
    for (const kw of keywords) {
      if (fullText.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestSubject = subject;
    }
  }

  return { subject: bestSubject, score: maxScore };
}

async function classifyByAi(questionText: string, optionsText: string): Promise<string | null> {
  if (!groq) return null;
  try {
    const prompt = `Classify this Nigerian secondary school (JAMB/WAEC) examination question into EXACTLY ONE of these subjects:
- Physics
- Chemistry
- Biology
- Mathematics
- English
- Literature
- Government
- Economics
- Commerce
- CRS

Question: "${questionText}"
Options: ${optionsText}

Reply with ONLY the single subject name. Do not include extra text.`;

    const res = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.0,
      max_tokens: 10,
    });

    const reply = res.choices[0]?.message?.content?.trim();
    if (!reply) return null;

    for (const subj of Object.keys(DOMAIN_RULES)) {
      if (reply.toLowerCase().includes(subj.toLowerCase())) {
        return subj;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🔍 Starting DILIGENT full-database question audit & reclassification...');

  const dbSubjects = await prisma.subject.findMany();
  const subjectMap = new Map<string, string>();
  for (const s of dbSubjects) {
    subjectMap.set(s.name.toLowerCase(), s.id);
  }

  const allQuestions = await prisma.question.findMany({
    include: { subject: true },
  });

  console.log(`Auditing ALL ${allQuestions.length} questions in database...`);

  let movedCount = 0;
  const auditReport: { qId: string; text: string; oldSubject: string; newSubject: string; reason: string }[] = [];

  for (let i = 0; i < allQuestions.length; i++) {
    const q = allQuestions[i];
    const rawOptions = (q.options as any[]) || [];
    const optionsText = rawOptions.map(o => `${o.id}: ${o.text}`).join(', ');

    const currentSubjectName = q.subject?.name || '';
    const ruleRes = classifyByRules(q.text, optionsText);

    let targetSubjectName = currentSubjectName;
    let classificationReason = 'Rule match';

    if (ruleRes.score >= 2 && ruleRes.subject !== currentSubjectName) {
      targetSubjectName = ruleRes.subject;
      classificationReason = `Rule match (score ${ruleRes.score})`;
    } else if (ruleRes.score < 2) {
      // Use AI classifier for low-confidence or ambiguous questions
      const aiSubject = await classifyByAi(q.text, optionsText);
      if (aiSubject && aiSubject !== currentSubjectName) {
        targetSubjectName = aiSubject;
        classificationReason = 'AI classification';
      }
    }

    const targetSubjectId = subjectMap.get(targetSubjectName.toLowerCase());

    if (targetSubjectId && targetSubjectId !== q.subjectId) {
      movedCount++;
      auditReport.push({
        qId: q.id,
        text: q.text.slice(0, 70),
        oldSubject: currentSubjectName,
        newSubject: targetSubjectName,
        reason: classificationReason,
      });

      await prisma.question.update({
        where: { id: q.id },
        data: {
          subjectId: targetSubjectId,
        },
      });
    }

    if ((i + 1) % 100 === 0 || i === allQuestions.length - 1) {
      console.log(`Processed ${i + 1}/${allQuestions.length} questions... (Reclassified: ${movedCount})`);
    }
  }

  console.log('\n========================================');
  console.log(`🎉 AUDIT COMPLETE! Total questions moved: ${movedCount}`);
  console.log('========================================');

  console.log('\n--- SAMPLE RECLASSIFICATION AUDIT TRAIL ---');
  auditReport.slice(0, 30).forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.oldSubject} ➔ ${item.newSubject}] "${item.text}..." (${item.reason})`);
  });

  const finalSubjects = await prisma.subject.findMany({
    include: { _count: { select: { questions: true } } },
  });

  console.log('\n--- FINAL VERIFIED SUBJECT COUNTS ---');
  for (const s of finalSubjects) {
    console.log(`- ${s.name}: ${s._count.questions} questions`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
