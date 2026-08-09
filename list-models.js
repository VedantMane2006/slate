import fs from 'fs';

async function run() {
  try {
    const envFile = fs.readFileSync('.env', 'utf8');
    const keyMatch = envFile.match(/VITE_GEMINI_API_KEY=(.*)/);
    const key = keyMatch ? keyMatch[1].trim() : '';

    const req = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await req.json();
    console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
