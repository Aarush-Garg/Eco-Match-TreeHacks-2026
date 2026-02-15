const data = require('./climate_categories_only.json');

// Extract all categories and organize by sector
const categoriesBySector = {};

data.jobs.forEach(job => {
  if (job.climate_categories) {
    job.climate_categories.forEach(cat => {
      const parts = cat.split(' > ');
      const sector = parts[0];

      if (!categoriesBySector[sector]) {
        categoriesBySector[sector] = new Set();
      }
      categoriesBySector[sector].add(cat);
    });
  }
});

// Convert sets to sorted arrays and count jobs per category
const result = {};
Object.keys(categoriesBySector).sort().forEach(sector => {
  result[sector] = Array.from(categoriesBySector[sector]).sort();
});

console.log(JSON.stringify(result, null, 2));
