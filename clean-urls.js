const fs = require('fs');

// Load the data
const data = JSON.parse(fs.readFileSync('./climate-taxonomy-enhanced.json', 'utf8'));

let fixedCount = 0;

// Clean URLs in all jobs
data.jobs.forEach(job => {
  if (job.url) {
    const original = job.url;
    // Remove trailing punctuation, quotes, commas, whitespace
    const cleaned = job.url.trim().replace(/[,;'")\]}\s]+$/, '');
    if (original !== cleaned) {
      job.url = cleaned;
      fixedCount++;
      console.log('Fixed:', original, '->', cleaned);
    }
  }
});

// Save back to file
fs.writeFileSync('./climate-taxonomy-enhanced.json', JSON.stringify(data, null, 2));

console.log(`\nTotal URLs fixed: ${fixedCount}`);
console.log('File saved: climate-taxonomy-enhanced.json');
