import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
await mkdir('public', { recursive: true });
await copyFile(
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  'public/pdf.worker.min.mjs',
);
const pdf = await PDFDocument.create();
const serif = await pdf.embedFont(StandardFonts.TimesRoman),
  italic = await pdf.embedFont(StandardFonts.TimesRomanItalic),
  sans = await pdf.embedFont(StandardFonts.Helvetica),
  bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const ink = rgb(0.18, 0.21, 0.28),
  gray = rgb(0.49, 0.53, 0.6),
  blue = rgb(0.35, 0.42, 0.75);
const chapters = [
  {
    kicker: 'A FIELD GUIDE TO SLOWER THINKING',
    title: ['The art of', 'paying attention.'],
    lead: 'Good ideas begin with a little more noticing.',
    heading: '01   Make room for what matters',
    body: [
      'We read to discover something new. But the most useful part of',
      'reading often happens in the margins: a question, a connection,',
      'a small thought that asks us to pause.',
      '',
      'Attention is not simply the absence of distraction. It is a choice',
      'to spend a little more time with an idea before moving on.',
      'When we notice what surprises us, we begin to make it our own.',
    ],
    quote: [
      '“The page is only the beginning.',
      'What you notice is the story.”',
    ],
    bottom: 'A small practice',
    lines: [
      'Underline one idea that stays with you. Write a question beside it.',
      'Come back tomorrow and see what you think.',
    ],
  },
  {
    kicker: 'CHAPTER TWO',
    title: ['Read with', 'a pencil in hand.'],
    lead: 'A conversation between the page and your mind.',
    heading: '02   Leave a trace of your thinking',
    body: [
      'A note does not need to be polished to be useful. A few words',
      'can capture the exact moment an idea starts to make sense.',
      'Try writing what a paragraph means in your own words.',
      '',
      'Ask questions. Draw arrows between related ideas. Circle a',
      'word that feels important. These small marks make a document',
      'into a record of your own understanding.',
    ],
    quote: ['“A good question can open', 'more doors than a perfect answer.”'],
    bottom: 'Try it on this page',
    lines: [
      'Highlight a sentence above. Add your own interpretation in the',
      'notes panel, then return to it after you finish reading.',
    ],
  },
  {
    kicker: 'CHAPTER THREE',
    title: ['Connect the dots.', 'Keep the questions.'],
    lead: 'Let one idea lead to another.',
    heading: '03   Return, reflect, and remember',
    body: [
      'A collection of notes is a collection of beginnings. Revisit the',
      'things you marked and look for patterns between them.',
      'What keeps coming up? What has changed since you first read?',
      '',
      'Learning is rarely a straight line. A thought from one page may',
      'find its answer in a completely different place. Keep your notes',
      'close, and give those connections time to appear.',
    ],
    quote: ['“Understanding grows', 'each time we return.”'],
    bottom: 'Before you go',
    lines: [
      'Choose one idea to put into practice this week. Export your PDF',
      'to take your highlights and thoughts with you.',
    ],
  },
];
for (let i = 0; i < chapters.length; i++) {
  const d = chapters[i],
    p = pdf.addPage([595, 842]);
  const text = (t, x, y, size, font = sans, color = ink) =>
    p.drawText(t, { x, y, size, font, color });
  text('MARGIN  /  READING ROOM', 56, 795, 8, bold, gray);
  text('FIELD NOTES     /     0' + (i + 1), 421, 795, 8, sans, gray);
  p.drawLine({
    start: { x: 56, y: 781 },
    end: { x: 539, y: 781 },
    thickness: 0.6,
    color: rgb(0.87, 0.89, 0.92),
  });
  text(d.kicker, 56, 733, 8, bold, blue);
  text(d.title[0], 54, 674, 43, serif);
  text(d.title[1], 54, 626, 43, serif);
  text(d.lead, 56, 589, 12, italic, gray);
  p.drawLine({
    start: { x: 56, y: 563 },
    end: { x: 85, y: 563 },
    thickness: 2,
    color: blue,
  });
  text(d.heading, 56, 528, 13, bold);
  d.body.forEach((line, j) =>
    text(line, 56, 499 - j * 20, 11.5, sans, rgb(0.36, 0.39, 0.44)),
  );
  p.drawRectangle({
    x: 56,
    y: 230,
    width: 483,
    height: 89,
    color: rgb(0.95, 0.96, 0.985),
  });
  p.drawRectangle({
    x: 56,
    y: 230,
    width: 2,
    height: 89,
    color: rgb(0.66, 0.7, 0.88),
  });
  text(d.quote[0], 78, 285, 19, italic, blue);
  text(d.quote[1], 78, 259, 19, italic, blue);
  text(d.bottom, 56, 193, 12, bold);
  d.lines.forEach((line, j) => text(line, 56, 168 - j * 20, 10.5, sans, gray));
  p.drawLine({
    start: { x: 56, y: 82 },
    end: { x: 539, y: 82 },
    thickness: 0.6,
    color: rgb(0.87, 0.89, 0.92),
  });
  text('A LITTLE SPACE FOR BIG IDEAS.', 56, 59, 7, sans, gray);
  text('0' + (i + 1), 523, 57, 10, sans, gray);
}
await writeFile('public/sample.pdf', await pdf.save());
console.log('Same-origin PDF worker and three-page sample prepared.');
