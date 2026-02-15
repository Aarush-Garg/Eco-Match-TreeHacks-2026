require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function testAPIKey() {
  console.log('API Key (first 20 chars):', API_KEY?.substring(0, 20) + '...');
  console.log('API Key length:', API_KEY?.length);

  // Test different endpoints and models
  const tests = [
    { endpoint: 'v1beta', model: 'gemini-pro' },
    { endpoint: 'v1beta', model: 'gemini-1.5-pro' },
    { endpoint: 'v1beta', model: 'gemini-1.5-flash' },
    { endpoint: 'v1beta', model: 'gemini-1.5-flash-latest' },
    { endpoint: 'v1beta', model: 'gemini-1.5-pro-latest' },
    { endpoint: 'v1', model: 'gemini-pro' },
    { endpoint: 'v1', model: 'gemini-1.5-flash' },
    { endpoint: 'v1', model: 'gemini-1.5-pro' },
    { endpoint: 'v1', model: 'gemini-1.5-flash-latest' },
    { endpoint: 'v1', model: 'gemini-1.5-pro-latest' },
  ];

  for (const test of tests) {
    try {
      const url = `https://generativelanguage.googleapis.com/${test.endpoint}/models/${test.model}:generateContent?key=${API_KEY}`;
      console.log(`\nTesting ${test.endpoint}/${test.model}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }]
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ SUCCESS!');
        console.log('Response:', data.candidates[0].content.parts[0].text.substring(0, 50));
      } else {
        console.log('❌ FAILED:', data.error?.message || 'Unknown error');
      }
    } catch (error) {
      console.log('❌ ERROR:', error.message);
    }
  }
}

testAPIKey();
