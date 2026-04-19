import { generateCharacterImage } from './generate-character-image.mjs';

const suspects = [
  {
    name: 'Marcus Deline',
    role: 'Hospital Procurement Director',
    profile:
      'Raised in Cleveland by a single mother who worked as a surgical nurse, Marcus worked his way through a state MBA program and spent fifteen years climbing the administrative ladder. Known for being precise, soft-spoken, and relentlessly organized. Colleagues describe him as "the man who reads every footnote." Mid-forties, neat professional appearance.',
    outPath: 'assets/characters/marcus-deline.png',
  },
  {
    name: 'Marcus Delvecchio',
    role: 'Restaurant Owner / Food Service Operator',
    profile:
      'Italian-American man in his late forties. Warm and charismatic in front of guests, controlling and exacting behind the line. Grew up in Newark, son of a deli worker. Twelve years running his own trattoria — worn apron, callused hands, tired but proud eyes.',
    outPath: 'assets/characters/marcus-delvecchio.png',
  },
  {
    name: 'Ozan',
    role: 'Senior Software Developer',
    profile:
      'Smart, analytical thinker who panics quickly under pressure. Mid-thirties Turkish man, slight build, disheveled tech-worker look — hoodie, tired eyes behind glasses. Has researched polygraph tests online and rehearsed his story.',
    outPath: 'assets/characters/ozan.png',
  },
];

for (const s of suspects) {
  console.log(`Generating image for ${s.name}...`);
  await generateCharacterImage(s, s.outPath);
}
console.log('Done.');
