require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  console.log('Fetching available models...\n');

  const endpoints = ['v1', 'v1beta'];

  for (const endpoint of endpoints) {
    try {
      const url = `https://generativelanguage.googleapis.com/${endpoint}/models?key=${API_KEY}`;
      console.log(`Checking ${endpoint} endpoint...`);

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.models) {
        console.log(`✅ Found ${data.models.length} models on ${endpoint}:\n`);
        data.models.forEach(model => {
          const methods = model.supportedGenerationMethods || [];
          if (methods.includes('generateContent')) {
            console.log(`  ✅ ${model.name} - SUPPORTS generateContent`);
          } else {
            console.log(`  ⚠️  ${model.name} - methods: ${methods.join(', ')}`);
          }
        });
        console.log('');
      } else {
        console.log(`❌ Error: ${data.error?.message || 'Unknown error'}\n`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
}

listModels();
