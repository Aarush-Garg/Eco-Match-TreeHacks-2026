const fs = require('fs');
const { execSync } = require('child_process');

console.log('🌍 Integrating Climate Taxonomy...\n');

// Step 1: Extract full taxonomy from Python file
console.log('📊 Extracting taxonomy from FULL_TAXONOMY.py...');
const taxonomyJson = execSync('python3 -c "import sys; sys.path.append(\'.\'); from FULL_TAXONOMY import CLIMATE_TAXONOMY; import json; print(json.dumps(CLIMATE_TAXONOMY, indent=2))"', {
  encoding: 'utf-8',
  maxBuffer: 50 * 1024 * 1024 // 50MB buffer
});

const fullTaxonomy = JSON.parse(taxonomyJson);
console.log(`✅ Loaded ${fullTaxonomy.length} sectors`);

// Step 2: Parse Excel file for additional metadata
console.log('\n📑 Parsing Structural Changelog.xlsx...');
const excelData = {};

try {
  // Read Innovation Imperatives
  const imperativesData = execSync(`python3 -c "import pandas as pd; import json; df = pd.read_excel('Structural Changelog.xlsx', sheet_name='Final Innovation Imperatives'); df = df.fillna(''); print(json.dumps(df.to_dict('records'), indent=2))"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
  excelData.imperatives = JSON.parse(imperativesData);
  console.log(`  ✅ Loaded ${excelData.imperatives.length} innovation imperatives`);

  // Read Moonshots
  const moonshotsData = execSync(`python3 -c "import pandas as pd; import json; df = pd.read_excel('Structural Changelog.xlsx', sheet_name='Final Moonshots'); df = df.fillna(''); print(json.dumps(df.to_dict('records'), indent=2))"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
  excelData.moonshots = JSON.parse(moonshotsData);
  console.log(`  ✅ Loaded ${excelData.moonshots.length} moonshots`);

  // Read Tech Categories
  const techCatsData = execSync(`python3 -c "import pandas as pd; import json; df = pd.read_excel('Structural Changelog.xlsx', sheet_name='Final Tech Categories'); df = df.fillna(''); print(json.dumps(df.to_dict('records'), indent=2))"`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
  excelData.techCategories = JSON.parse(techCatsData);
  console.log(`  ✅ Loaded ${excelData.techCategories.length} tech categories`);
} catch (error) {
  console.warn('  ⚠️  Could not parse all Excel sheets:', error.message);
}

// Step 3: Load existing jobs data
console.log('\n💼 Loading jobs data...');
const jobsData = JSON.parse(fs.readFileSync('climate-jobs-knowledge.json', 'utf-8'));
console.log(`✅ Loaded ${jobsData.totalJobs} jobs`);

// Step 4: Calculate emissions impact scores for sectors
const sectorImpactScores = {};
const totalEmissions = fullTaxonomy.reduce((sum, sector) => {
  const emissions = parseFloat(sector.emissions_at_stake_2050?.replace(' Gt', '')) || 0;
  return sum + emissions;
}, 0);

fullTaxonomy.forEach(sector => {
  const emissions = parseFloat(sector.emissions_at_stake_2050?.replace(' Gt', '')) || 0;
  sectorImpactScores[sector.sector_name] = {
    emissions_gt: emissions,
    impact_score: emissions > 0 ? (emissions / totalEmissions * 100).toFixed(1) : 0,
    opportunity_areas: sector.opportunity_areas?.length || 0
  };
});

console.log('\n📈 Sector Impact Scores (by 2050 emissions):');
Object.entries(sectorImpactScores)
  .sort((a, b) => b[1].emissions_gt - a[1].emissions_gt)
  .forEach(([sector, data]) => {
    console.log(`  ${sector}: ${data.emissions_gt} Gt (${data.impact_score}% of total)`);
  });

// Step 5: Build comprehensive keyword mapping
console.log('\n🔑 Building keyword taxonomy...');
const keywordMap = {};
const skillsMap = {};

fullTaxonomy.forEach(sector => {
  sector.opportunity_areas?.forEach(area => {
    // Map Innovation Imperatives keywords
    area.innovation_imperatives?.forEach(imperative => {
      imperative.keywords?.forEach(keyword => {
        if (!keywordMap[keyword.toLowerCase()]) {
          keywordMap[keyword.toLowerCase()] = {
            sectors: [],
            opportunity_areas: [],
            imperatives: [],
            moonshots: [],
            tech_categories: [],
            type: 'innovation_imperative'
          };
        }
        if (!keywordMap[keyword.toLowerCase()].sectors.includes(sector.sector_name)) {
          keywordMap[keyword.toLowerCase()].sectors.push(sector.sector_name);
        }
        if (!keywordMap[keyword.toLowerCase()].opportunity_areas.includes(area.area_name)) {
          keywordMap[keyword.toLowerCase()].opportunity_areas.push(area.area_name);
        }
        if (!keywordMap[keyword.toLowerCase()].imperatives.includes(imperative.subject_name)) {
          keywordMap[keyword.toLowerCase()].imperatives.push(imperative.subject_name);
        }
      });
    });

    // Map Moonshot keywords
    area.moonshots?.forEach(moonshot => {
      moonshot.keywords?.forEach(keyword => {
        if (!keywordMap[keyword.toLowerCase()]) {
          keywordMap[keyword.toLowerCase()] = {
            sectors: [],
            opportunity_areas: [],
            imperatives: [],
            moonshots: [],
            tech_categories: [],
            type: 'moonshot'
          };
        }
        if (!keywordMap[keyword.toLowerCase()].sectors.includes(sector.sector_name)) {
          keywordMap[keyword.toLowerCase()].sectors.push(sector.sector_name);
        }
        if (!keywordMap[keyword.toLowerCase()].opportunity_areas.includes(area.area_name)) {
          keywordMap[keyword.toLowerCase()].opportunity_areas.push(area.area_name);
        }
        if (!keywordMap[keyword.toLowerCase()].moonshots.includes(moonshot.name)) {
          keywordMap[keyword.toLowerCase()].moonshots.push(moonshot.name);
        }
      });
    });

    // Map Tech Category keywords
    area.tech_categories?.forEach(techCat => {
      techCat.keywords?.forEach(keyword => {
        if (!keywordMap[keyword.toLowerCase()]) {
          keywordMap[keyword.toLowerCase()] = {
            sectors: [],
            opportunity_areas: [],
            imperatives: [],
            moonshots: [],
            tech_categories: [],
            type: 'tech_category',
            readiness: techCat.readiness
          };
        }
        if (!keywordMap[keyword.toLowerCase()].sectors.includes(sector.sector_name)) {
          keywordMap[keyword.toLowerCase()].sectors.push(sector.sector_name);
        }
        if (!keywordMap[keyword.toLowerCase()].tech_categories.includes(techCat.cluster_name)) {
          keywordMap[keyword.toLowerCase()].tech_categories.push(techCat.cluster_name);
        }
      });
    });
  });
});

console.log(`✅ Mapped ${Object.keys(keywordMap).length} keywords to taxonomy`);

// Step 6: Enrich jobs with taxonomy mapping
console.log('\n🎯 Enriching jobs with taxonomy data...');
let jobsEnriched = 0;

jobsData.jobs = jobsData.jobs.map(job => {
  const enrichedJob = { ...job };
  const matchedKeywords = new Set();
  const matchedSectors = new Set();
  const matchedOpportunityAreas = new Set();
  const matchedImperatives = new Set();
  const matchedMoonshots = new Set();
  const matchedTechCategories = new Set();

  // Combine job text for matching
  const jobText = `${job.title} ${job.skills_keywords} ${job.work_areas} ${job.company}`.toLowerCase();

  // Match keywords
  Object.entries(keywordMap).forEach(([keyword, data]) => {
    if (jobText.includes(keyword)) {
      matchedKeywords.add(keyword);
      data.sectors.forEach(s => matchedSectors.add(s));
      data.opportunity_areas.forEach(a => matchedOpportunityAreas.add(a));
      data.imperatives?.forEach(i => matchedImperatives.add(i));
      data.moonshots?.forEach(m => matchedMoonshots.add(m));
      data.tech_categories?.forEach(tc => matchedTechCategories.add(tc));
    }
  });

  // Calculate impact score
  let impactScore = 0;
  if (matchedSectors.size > 0) {
    // Average impact across matched sectors
    matchedSectors.forEach(sector => {
      impactScore += parseFloat(sectorImpactScores[sector]?.impact_score || 0);
    });
    impactScore = (impactScore / matchedSectors.size).toFixed(1);
  }

  // Boost score for innovation imperatives (more immediate impact)
  if (matchedImperatives.size > 0) {
    impactScore = (parseFloat(impactScore) * 1.2).toFixed(1);
  }

  // Moderate boost for tech categories (established technologies)
  if (matchedTechCategories.size > 0) {
    impactScore = (parseFloat(impactScore) * 1.1).toFixed(1);
  }

  enrichedJob.taxonomy = {
    matched_keywords: Array.from(matchedKeywords),
    sectors: Array.from(matchedSectors),
    opportunity_areas: Array.from(matchedOpportunityAreas),
    innovation_imperatives: Array.from(matchedImperatives),
    moonshots: Array.from(matchedMoonshots),
    tech_categories: Array.from(matchedTechCategories),
    impact_score: parseFloat(impactScore),
    emissions_category: matchedSectors.length > 0 ? Array.from(matchedSectors)[0] : null
  };

  if (matchedSectors.size > 0) {
    jobsEnriched++;
  }

  return enrichedJob;
});

console.log(`✅ Enriched ${jobsEnriched} jobs with taxonomy data (${((jobsEnriched/jobsData.totalJobs)*100).toFixed(1)}%)`);

// Step 7: Create enhanced knowledge base
console.log('\n📚 Creating enhanced knowledge base...');

const enhancedKnowledge = {
  metadata: {
    generated_at: new Date().toISOString(),
    total_sectors: fullTaxonomy.length,
    total_jobs: jobsData.totalJobs,
    jobs_with_taxonomy: jobsEnriched,
    coverage_percent: ((jobsEnriched/jobsData.totalJobs)*100).toFixed(1),
    total_keywords: Object.keys(keywordMap).length
  },

  sectors: fullTaxonomy.map(sector => ({
    name: sector.sector_name,
    emissions_at_stake_2050: sector.emissions_at_stake_2050,
    impact_score: parseFloat(sectorImpactScores[sector.sector_name]?.impact_score || 0),
    description: sector.area_description,
    opportunity_areas: sector.opportunity_areas?.map(area => ({
      name: area.area_name,
      description: area.area_description,
      innovation_imperatives: area.innovation_imperatives?.map(imp => ({
        name: imp.subject_name,
        description: imp.description,
        keywords: imp.keywords,
        related_resources: imp.related_resources
      })) || [],
      moonshots: area.moonshots?.map(ms => ({
        name: ms.name,
        description: ms.description,
        keywords: ms.keywords
      })) || [],
      tech_categories: area.tech_categories?.map(tc => ({
        name: tc.cluster_name,
        readiness: tc.readiness,
        keywords: tc.keywords
      })) || [],
      viable_solutions: area.viable_solutions || []
    })) || []
  })),

  keyword_taxonomy: keywordMap,

  sector_impact_scores: sectorImpactScores,

  jobs: jobsData.jobs,

  skills_summary: jobsData.metadata?.skills || [],
  work_areas_summary: jobsData.metadata?.workAreas || [],
  companies: jobsData.metadata?.companies || [],
  locations: jobsData.metadata?.locations || []
};

// Save enhanced knowledge base
fs.writeFileSync('climate-taxonomy-enhanced.json', JSON.stringify(enhancedKnowledge, null, 2));
console.log('✅ Saved to climate-taxonomy-enhanced.json');

// Generate summary report
console.log('\n' + '='.repeat(60));
console.log('📊 TAXONOMY INTEGRATION SUMMARY');
console.log('='.repeat(60));

console.log(`\n📈 Coverage Statistics:`);
console.log(`  Total Jobs: ${jobsData.totalJobs}`);
console.log(`  Jobs Matched to Taxonomy: ${jobsEnriched} (${((jobsEnriched/jobsData.totalJobs)*100).toFixed(1)}%)`);
console.log(`  Total Keywords Mapped: ${Object.keys(keywordMap).length}`);

console.log(`\n🎯 Top 10 Highest Impact Jobs:`);
const topJobs = jobsData.jobs
  .filter(j => j.taxonomy?.impact_score > 0)
  .sort((a, b) => (b.taxonomy?.impact_score || 0) - (a.taxonomy?.impact_score || 0))
  .slice(0, 10);

topJobs.forEach((job, i) => {
  console.log(`  ${i+1}. ${job.title} @ ${job.company}`);
  console.log(`     Impact Score: ${job.taxonomy.impact_score} | Sectors: ${job.taxonomy.sectors.join(', ')}`);
  console.log(`     Imperatives: ${job.taxonomy.innovation_imperatives.slice(0,2).join(', ')}${job.taxonomy.innovation_imperatives.length > 2 ? '...' : ''}`);
});

console.log(`\n🔍 Keyword Distribution:`);
const keywordTypes = {};
Object.values(keywordMap).forEach(data => {
  keywordTypes[data.type] = (keywordTypes[data.type] || 0) + 1;
});
Object.entries(keywordTypes).forEach(([type, count]) => {
  console.log(`  ${type}: ${count} keywords`);
});

console.log('\n✅ Integration complete!');
console.log('💡 Next: Update server.js to use climate-taxonomy-enhanced.json\n');
