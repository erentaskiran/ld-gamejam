import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Flood-fill from corners to remove the known solid background (#0a0f1a).
// Using flood-fill instead of a flat threshold preserves dark pixels on the character.
async function removeBackground(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const ch = 4;
  const BG = [0, 0, 0]; // #000000
  const TOLERANCE = 40;

  const dist = (i) => {
    const r = data[i] - BG[0],
      g = data[i + 1] - BG[1],
      b = data[i + 2] - BG[2];
    return Math.sqrt(r * r + g * g + b * b);
  };

  const visited = new Uint8Array(width * height);
  const stack = [];

  const seed = (x, y) => {
    const idx = y * width + x;
    if (!visited[idx] && dist(idx * ch) < TOLERANCE) {
      visited[idx] = 1;
      stack.push(idx);
    }
  };

  // Seed from all four edges
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  while (stack.length > 0) {
    const idx = stack.pop();
    data[idx * ch + 3] = 0; // make transparent
    const x = idx % width,
      y = (idx / width) | 0;
    if (x > 0) {
      const n = idx - 1;
      if (!visited[n] && dist(n * ch) < TOLERANCE) {
        visited[n] = 1;
        stack.push(n);
      }
    }
    if (x < width - 1) {
      const n = idx + 1;
      if (!visited[n] && dist(n * ch) < TOLERANCE) {
        visited[n] = 1;
        stack.push(n);
      }
    }
    if (y > 0) {
      const n = idx - width;
      if (!visited[n] && dist(n * ch) < TOLERANCE) {
        visited[n] = 1;
        stack.push(n);
      }
    }
    if (y < height - 1) {
      const n = idx + width;
      if (!visited[n] && dist(n * ch) < TOLERANCE) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }

  return sharp(Buffer.from(data), { raw: { width, height, channels: ch } })
    .png()
    .toBuffer();
}

export async function generateCharacterImage(suspect, outPath) {
  const { name, role, profile } = suspect;
  const prompt =
    `Pixel art character portrait, 512x512 resolution, chest-up framing centered in frame, ` +
    `solid pure black background (#000000), detailed pixel art style with soft painterly ` +
    `shading and anti-aliasing, limited but rich color palette, clean pixel clusters with visible ` +
    `but refined pixelation, expressive facial features with detailed eyes and subtle skin tone ` +
    `variations, soft rim lighting from upper left, warm highlights on cheeks and nose, cool ` +
    `shadows on opposite side, hair rendered with flowing pixel strands and volumetric shading, ` +
    `clothing with fabric folds shown through pixel shading, subtle color dithering for smooth ` +
    `gradients, game character portrait style similar to modern indie RPG/visual novel aesthetic, ` +
    `high detail despite pixel constraints, no outline border, character looking slightly ` +
    `off-camera with emotional expression, consistent art style across all characters. ` +
    `Character description: ${name}, ${role}. ${profile}`;

  const result = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/png' },
  });

  const rawBuffer = Buffer.from(result.generatedImages[0].image.imageBytes, 'base64');
  const transparentBuffer = await removeBackground(rawBuffer);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, transparentBuffer);
  console.log(`[image] wrote ${outPath}`);
  return outPath;
}
