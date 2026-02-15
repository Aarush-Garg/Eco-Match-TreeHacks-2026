const fs = require('fs');
const path = require('path');

// Simple CSV parser
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');
  const jobs = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Handle quoted fields properly
    const values = [];
    let currentValue = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Push last value

    if (values.length >= headers.length) {
      const job = {};
      headers.forEach((header, index) => {
        job[header.trim()] = values[index] || '';
      });
      jobs.push(job);
    }
  }

  return jobs;
}

// Read CSV
const csvPath = path.join(__dirname, 'climate_jobs_gold_set_v4.csv');
const csvData = fs.readFileSync(csvPath, 'utf8');
const jobs = parseCSV(csvData);

console.log(`Parsed ${jobs.length} jobs`);

// Analyze the data
const skillsSet = new Set();
const workAreasSet = new Set();
const companiesSet = new Set();
const locationsSet = new Set();
const experienceLevels = new Set();

jobs.forEach(job => {
  // Extract skills
  if (job.skills_keywords) {
    job.skills_keywords.split(',').forEach(skill => {
      skillsSet.add(skill.trim());
    });
  }

  // Extract work areas
  if (job.work_areas) {
    job.work_areas.split(',').forEach(area => {
      workAreasSet.add(area.trim());
    });
  }

  // Extract companies, locations, experience levels
  if (job.company) companiesSet.add(job.company.trim());
  if (job.location) locationsSet.add(job.location.trim());
  if (job.experience_level) experienceLevels.add(job.experience_level.trim());
});

// Create structured knowledge base
const jobsKnowledge = {
  totalJobs: jobs.length,
  jobs: jobs,
  metadata: {
    skills: Array.from(skillsSet).sort(),
    workAreas: Array.from(workAreasSet).sort(),
    companies: Array.from(companiesSet).sort(),
    locations: Array.from(locationsSet).sort(),
    experienceLevels: Array.from(experienceLevels).sort()
  }
};

// Save to JSON
const outputPath = path.join(__dirname, 'climate-jobs-knowledge.json');
fs.writeFileSync(outputPath, JSON.stringify(jobsKnowledge, null, 2));

console.log('\n✅ Jobs knowledge base created!');
console.log(`📊 Stats:`);
console.log(`  - ${jobsKnowledge.totalJobs} total jobs`);
console.log(`  - ${jobsKnowledge.metadata.skills.length} unique skills`);
console.log(`  - ${jobsKnowledge.metadata.workAreas.length} work areas`);
console.log(`  - ${jobsKnowledge.metadata.companies.length} companies`);
console.log(`  - ${jobsKnowledge.metadata.locations.length} locations`);
console.log(`  - ${jobsKnowledge.metadata.experienceLevels.length} experience levels`);
console.log(`\n💾 Saved to: climate-jobs-knowledge.json`);
