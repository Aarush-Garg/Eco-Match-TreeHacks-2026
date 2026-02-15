require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for file uploads
app.use(express.static(__dirname));

// File upload middleware
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX allowed.'));
    }
  }
});

// Load climate jobs database - with graceful fallback
let enhancedTaxonomy = null;
let climateKnowledge = null;
let categoryTaxonomy = {}; // Initialize as empty object instead of null
let climateCategoriesData = null;

try {
  // Load new v6 jobs database
  const jobsPath = path.join(__dirname, 'climate_jobs_v6.json');
  const jobsData = fs.readFileSync(jobsPath, 'utf8');
  const jobsDatabase = JSON.parse(jobsData);

  // Create enhanced taxonomy structure from v6 data
  enhancedTaxonomy = {
    jobs: jobsDatabase.jobs,
    sectors: [],
    keyword_taxonomy: {},
    metadata: {
      total_jobs: jobsDatabase.metadata.total_jobs,
      total_sectors: jobsDatabase.metadata.sectors.length,
      total_keywords: 0,
      coverage_percent: 100
    }
  };

  // Build sectors from jobs data
  const sectorsMap = {};
  jobsDatabase.metadata.sectors.forEach(sectorName => {
    const key = sectorName.toLowerCase().replace(/[, &]+/g, '_');
    sectorsMap[key] = {
      name: sectorName,
      description: `Climate-tech opportunities in ${sectorName}`,
      emissions_at_stake: 0,
      impact_score: 5
    };
  });

  // Create backward-compatible climateKnowledge structure
  climateKnowledge = {
    sectors: sectorsMap,
    keywords: {},
    imperatives: [],
    moonshots: []
  };

  console.log(`✅ Climate jobs v6 loaded: ${enhancedTaxonomy.metadata.total_sectors} sectors, ${enhancedTaxonomy.metadata.total_jobs} jobs`);
  console.log(`✅ Sectors: ${jobsDatabase.metadata.sectors.join(', ')}`);
} catch (error) {
  console.warn('⚠️  Warning: Could not load climate jobs v6:', error.message);
  console.warn('⚠️  Server will run with limited functionality');
  console.warn('📁 Directory:', __dirname);

  // Create minimal fallback data so server can still function
  enhancedTaxonomy = {
    sectors: [],
    jobs: [],
    keyword_taxonomy: {},
    metadata: {
      total_sectors: 0,
      total_jobs: 0,
      total_keywords: 0,
      coverage_percent: 0
    }
  };

  climateKnowledge = {
    sectors: {},
    keywords: {},
    imperatives: [],
    moonshots: []
  };
}

// Try to load category taxonomy (optional)
try {
  const categoryPath = path.join(__dirname, 'climate-category-taxonomy.json');
  const categoryData = fs.readFileSync(categoryPath, 'utf8');
  categoryTaxonomy = JSON.parse(categoryData);
  console.log(`✅ Category taxonomy loaded: ${Object.keys(categoryTaxonomy).length} categories`);
} catch (error) {
  console.warn('⚠️  Category taxonomy not available:', error.message);
  categoryTaxonomy = {}; // Empty object fallback
}

// Use v6 jobs data for climate categories
try {
  const jobsPath = path.join(__dirname, 'climate_jobs_v6.json');
  const jobsData = fs.readFileSync(jobsPath, 'utf8');
  climateCategoriesData = JSON.parse(jobsData);
  console.log(`✅ Climate categories data loaded from v6: ${climateCategoriesData.jobs?.length || 0} jobs`);
} catch (error) {
  console.warn('⚠️  Climate categories data not available:', error.message);
}

// Jobs are in enhanced taxonomy (if loaded)
const jobsKnowledge = enhancedTaxonomy ? {
  totalJobs: enhancedTaxonomy.metadata?.total_jobs || 0,
  jobs: enhancedTaxonomy.jobs || [],
  metadata: {
    skills: enhancedTaxonomy.skills_summary || [],
    workAreas: enhancedTaxonomy.work_areas_summary || [],
    companies: enhancedTaxonomy.companies || [],
    locations: enhancedTaxonomy.locations || []
  }
} : {
  totalJobs: 0,
  jobs: [],
  metadata: {
    skills: [],
    workAreas: [],
    companies: [],
    locations: []
  }
};

/**
 * Extract climate-tech keywords from user query using enhanced taxonomy
 * @param {string} query - User's input query
 * @returns {Array} - Array of matched keyword categories
 */
function extractKeywords(query) {
  const lowercaseQuery = query.toLowerCase();
  const matches = new Set();

  // Check keywords from enhanced taxonomy
  if (enhancedTaxonomy && enhancedTaxonomy.keyword_taxonomy) {
    Object.entries(enhancedTaxonomy.keyword_taxonomy).forEach(([keyword, data]) => {
      if (lowercaseQuery.includes(keyword)) {
        // Add matched sectors
        if (data.sectors) {
          data.sectors.forEach(sector => matches.add(sector));
        }
      }
    });
  }

  // Check sector names
  for (const [sectorKey, sector] of Object.entries(climateKnowledge.sectors)) {
    if (lowercaseQuery.includes(sector.name.toLowerCase())) {
      matches.add(sector.name);
    }
  }

  return Array.from(matches);
}

/**
 * Retrieve relevant climate-tech context based on keywords
 * @param {Array} keywords - Extracted keyword categories
 * @returns {Object} - Relevant context from knowledge base
 */
function retrieveContext(keywords) {
  const context = {
    sectors: [],
    technologies: [],
    imperatives: [],
    moonshots: []
  };

  // If no keywords matched, return general climate-tech overview
  if (keywords.length === 0) {
    context.sectors = Object.values(climateKnowledge.sectors).map(s => ({
      name: s.name,
      description: s.description
    }));
    return context;
  }

  // Retrieve relevant sectors
  for (const keyword of keywords) {
    if (climateKnowledge.sectors[keyword]) {
      context.sectors.push(climateKnowledge.sectors[keyword]);
    }
  }

  // Retrieve related imperatives and moonshots (top 5 relevant ones)
  const relevantImperatives = climateKnowledge.imperatives.filter(imp =>
    keywords.some(kw => imp.toLowerCase().includes(kw.toLowerCase()))
  ).slice(0, 5);

  const relevantMoonshots = climateKnowledge.moonshots.filter(ms =>
    keywords.some(kw => ms.toLowerCase().includes(kw.toLowerCase()))
  ).slice(0, 3);

  context.imperatives = relevantImperatives;
  context.moonshots = relevantMoonshots;

  return context;
}

/**
 * Search jobs by specific climate category path
 * @param {string} categoryPath - Full category path (e.g., "Electricity > Energy Storage > Chemical")
 * @returns {Array} - Jobs that match this specific category
 */
function searchJobsByCategory(categoryPath) {
  if (!climateCategoriesData || !climateCategoriesData.jobs) return [];

  const matchedJobs = [];

  climateCategoriesData.jobs.forEach(job => {
    if (!job.climate_categories) return;

    let matchScore = 0;

    // Exact category match (highest priority)
    if (job.climate_categories.includes(categoryPath)) {
      matchScore += 10;
    }

    // Partial category match (e.g., query is "Electricity > Energy Storage", job has "Electricity > Energy Storage > Chemical")
    const categoryParts = categoryPath.split(' > ');
    const partialMatch = job.climate_categories.some(cat => {
      const catParts = cat.split(' > ');
      return categoryParts.every((part, idx) => catParts[idx] === part);
    });

    if (partialMatch && matchScore === 0) {
      matchScore += 5;
    }

    // Parent category match (e.g., query is "Electricity", job has "Electricity > ...")
    const sector = categoryPath.split(' > ')[0];
    if (matchScore === 0 && job.climate_categories.some(cat => cat.startsWith(sector))) {
      matchScore += 2;
    }

    if (matchScore > 0) {
      matchedJobs.push({
        ...job,
        match_score: matchScore,
        matched_categories: job.climate_categories.filter(cat =>
          cat === categoryPath ||
          cat.startsWith(categoryPath) ||
          categoryParts.every((part, idx) => cat.split(' > ')[idx] === part)
        )
      });
    }
  });

  // Sort by match score (highest first)
  matchedJobs.sort((a, b) => b.match_score - a.match_score);

  // Return top 15 most relevant jobs
  return matchedJobs.slice(0, 15);
}

/**
 * Search jobs by academic major
 * @param {string} major - Academic major name
 * @returns {Array} - Jobs that list this major in applicable_majors
 */
function searchJobsByMajor(major) {
  if (!climateCategoriesData || !climateCategoriesData.jobs) return [];

  const matchedJobs = [];

  climateCategoriesData.jobs.forEach(job => {
    if (!job.applicable_majors || !Array.isArray(job.applicable_majors)) return;

    // Check if this major is in the job's applicable majors list
    const isMatch = job.applicable_majors.some(applicableMajor =>
      applicableMajor.toLowerCase() === major.toLowerCase()
    );

    if (isMatch) {
      matchedJobs.push({
        ...job,
        matched_major: major
      });
    }
  });

  // Sort by experience level (entry-level first, then by company)
  const levelOrder = {
    'Internship': 1,
    'Entry-Level': 2,
    'Associate': 3,
    'Senior': 4,
    'Lead/Principal': 5,
    'Executive': 6
  };

  matchedJobs.sort((a, b) => {
    const levelA = levelOrder[a.experience_level] || 999;
    const levelB = levelOrder[b.experience_level] || 999;
    if (levelA !== levelB) return levelA - levelB;
    return (a.company || '').localeCompare(b.company || '');
  });

  // Return all matched jobs (no limit for majors since users want to see all opportunities)
  return matchedJobs;
}

/**
 * Search jobs based on query keywords with taxonomy-enhanced matching
 */
function searchJobs(query) {
  if (!jobsKnowledge) return [];

  // Check if this is a category-specific query
  const categoryPattern = /(?:show me jobs in|jobs in|find jobs in|list jobs in)\s+(.+)/i;
  const categoryMatch = query.match(categoryPattern);

  if (categoryMatch) {
    const categoryPath = categoryMatch[1].trim();
    // Try category-based search first
    const categoryJobs = searchJobsByCategory(categoryPath);
    if (categoryJobs.length > 0) {
      console.log(`Found ${categoryJobs.length} jobs via category search for: ${categoryPath}`);
      return categoryJobs;
    }
  }

  // Fall back to general search
  const lowerQuery = query.toLowerCase();
  const matchedJobs = [];

  jobsKnowledge.jobs.forEach(job => {
    let matchScore = 0;
    const jobText = `${job.title} ${job.skills_keywords} ${job.work_areas} ${job.company}`.toLowerCase();

    // Taxonomy-based matching
    if (job.taxonomy) {
      // Check if query matches sectors
      if (job.taxonomy.sectors.some(sector => lowerQuery.includes(sector.toLowerCase()))) {
        matchScore += 3;
      }

      // Check if query matches innovation imperatives
      if (job.taxonomy.innovation_imperatives.some(imp => lowerQuery.includes(imp.toLowerCase()))) {
        matchScore += 2;
      }

      // Check if query matches opportunity areas
      if (job.taxonomy.opportunity_areas.some(area => lowerQuery.includes(area.toLowerCase()))) {
        matchScore += 2;
      }

      // Check if query matches keywords
      if (job.taxonomy.matched_keywords.some(kw => lowerQuery.includes(kw))) {
        matchScore += 1;
      }
    }

    // Traditional keyword matching (more strict)
    const queryKeywords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
    const hasKeywordMatch = queryKeywords.some(keyword =>
      jobText.includes(keyword) ||
      (job.skills_keywords && job.skills_keywords.toLowerCase().includes(keyword)) ||
      (job.work_areas && job.work_areas.toLowerCase().includes(keyword))
    );

    if (hasKeywordMatch) {
      matchScore += 1;
    }

    if (matchScore > 0) {
      matchedJobs.push({
        ...job,
        match_score: matchScore
      });
    }
  });

  // Sort by combination of match score and impact score
  matchedJobs.sort((a, b) => {
    const scoreA = a.match_score * 10 + (a.taxonomy?.impact_score || 0);
    const scoreB = b.match_score * 10 + (b.taxonomy?.impact_score || 0);
    return scoreB - scoreA;
  });

  return matchedJobs.slice(0, 10);
}

/**
 * Format jobs as clean table with taxonomy information
 */
function formatJobsTable(jobs) {
  if (!jobs || jobs.length === 0) return '';

  // Check if we should show categories column
  const hasCategoryMatches = jobs.some(job => job.matched_categories && job.matched_categories.length > 0);

  let table = hasCategoryMatches
    ? '\nPOSITION | COMPANY | LOCATION | CLIMATE CATEGORIES | LEVEL | APPLY\n'
    : '\nPOSITION | COMPANY | LOCATION | SECTOR | IMPACT | LEVEL | DEADLINE | APPLY\n';
  table += '--- | --- | --- | --- | --- | --- | --- | ---\n';

  jobs.forEach(job => {
    const title = job.title.replace(/[^\w\s-]/g, '');
    const company = job.company.replace(/[^\w\s-]/g, '');
    const location = (job.location || 'Not specified').replace(/[^\w\s,-]/g, '');
    const level = (job.experience_level || 'Various').replace(/[^\w\s-]/g, '');
    const url = job.url || '';

    if (hasCategoryMatches) {
      // Show matched climate categories instead of sector
      const categories = job.matched_categories
        ? job.matched_categories.slice(0, 2).map(c => c.split(' > ').pop()).join(', ')
        : 'Various';
      table += `${title} | ${company} | ${location} | ${categories} | ${level} | ${url}\n`;
    } else {
      // Show traditional sector and impact columns
      const sector = job.taxonomy?.emissions_category || 'General Climate Tech';
      const impactScore = job.taxonomy?.impact_score ? `${job.taxonomy.impact_score}%` : 'N/A';
      const deadline = 'Rolling';
      table += `${title} | ${company} | ${location} | ${sector} | ${impactScore} | ${level} | ${deadline} | ${url}\n`;
    }
  });

  // Add context footer
  if (jobs.length > 0) {
    if (hasCategoryMatches) {
      table += '\nCLIMATE CATEGORIES: Specific technology/solution areas within climate-tech sectors (e.g., Energy Storage, Carbon Capture, etc.)\n';
      table += 'All jobs shown have been specifically tagged with categories matching your search.\n';
    } else {
      table += '\nIMPACT SCORE: Relative emissions reduction potential based on sector (Manufacturing: 46.4%, Electricity: 23.1%, Transportation: 16.3%, Food/Ag: 7.8%, Buildings: 6.4%)\n';
      table += 'DEADLINE: Check job posting for specific application deadlines.\n';
    }
  }

  return table;
}

/**
 * Build system prompt with climate-tech expertise and taxonomy
 * @param {Object} context - Retrieved context from knowledge base
 * @param {string} userQuery - Original user query
 * @param {Array} matchedJobs - Matched jobs from search
 * @returns {string} - Complete prompt for Gemini
 */
function buildPrompt(context, userQuery, matchedJobs = [], isAskingForJobs = false, categoryContext = '') {
  let systemPrompt = `You are a climate-tech expert career counselor with deep knowledge of the climate technology landscape, emissions reduction opportunities, and career pathways.

**CRITICAL: Keep ALL responses SHORT and CONCISE. Maximum 4-5 sentences ${isAskingForJobs ? '(excluding job tables)' : ''}.**

${!isAskingForJobs ? '**WHEN PROVIDING ADVICE:** Use numbered action lists (1. Do this, 2. Do that) to give clear, actionable steps.' : ''}

**EMISSIONS IMPACT BY SECTOR (2050 projections):**
1. **Manufacturing** (26.7 Gt, 46.4%) - Steel, cement, chemicals
2. **Electricity** (13.3 Gt, 23.1%) - Solar, wind, storage, grid
3. **Transportation** (9.4 Gt, 16.3%) - EVs, sustainable aviation fuel
4. **Food, Agriculture & Nature** (4.5 Gt, 7.8%) - Methane reduction, regenerative farming
5. **Buildings** (3.7 Gt, 6.4%) - Heat pumps, retrofits
6. **GHG Removal** (0 Gt direct, but HIGH IMPACT) - Direct air capture, nature-based solutions, CCUS

**IMPORTANT: GHG Removal Sector Context:**
- While GHG Removal shows 0 GT in emissions reduction (because it removes rather than prevents emissions), it is a HIGH IMPACT sector
- CCUS (Carbon Capture, Utilization & Storage) has widespread applicability across ALL other sectors (Manufacturing, Electricity, Transportation, etc.)
- Essential for reaching net-zero targets and addressing hard-to-abate emissions
- Technologies like direct air capture (DAC), bioenergy with carbon capture (BECCS), and industrial carbon capture are critical for climate goals
- When discussing GHG Removal jobs, ALWAYS emphasize the high impact and cross-sector applicability despite the 0 GT metric

**YOUR ROLE:**
- Provide BRIEF career guidance tailored to climate-tech
- Explain IMPACT SCORES (emissions reduction potential)
- Connect jobs to Innovation Imperatives (near-term) and Moonshots (breakthrough tech)
- Always end with a helpful question

**CLIMATE-TECH OPPORTUNITY TYPES (Risk vs. Impact Framework):**

1. **🚀 MOONSHOT OPPORTUNITIES** (High Risk, Radical Impact)
   - **Definition:** Early-stage, breakthrough technologies with potential to transform entire industries
   - **Risk Profile:** High technical/market risk, 5-15 year timeline to commercial viability
   - **Company Stage:** Seed to Series A, often pre-revenue or pilot projects
   - **Technologies:** Direct air capture (Climeworks, Carbon Engineering), nuclear fusion (Commonwealth Fusion, Helion), green hydrogen production (Electric Hydrogen), advanced geothermal (Fervo Energy), ocean-based carbon removal, next-gen battery chemistry, synthetic biology for materials
   - **Who Should Join:** Risk-tolerant individuals energized by R&D, willing to accept equity over high salaries, passionate about working on cutting-edge science/engineering, comfortable with pivots and failure
   - **Example Jobs:** Research Scientist at fusion startup, DAC Systems Engineer, Protein Engineering Lead at alt-protein company, Electrochemistry Researcher for novel batteries
   - **Career Advice:** Expect steep learning curves, potential for significant equity upside, high mission alignment, but also higher job insecurity and longer hours

2. **⚡ ESSENTIAL TECHNOLOGIES** (Medium Risk, High Impact)
   - **Definition:** Proven technologies scaling rapidly to meet decarbonization targets; not radical innovation but critical deployment
   - **Risk Profile:** Moderate commercial risk, clear path to profitability, 2-7 year deployment timelines
   - **Company Stage:** Series B to Series D, scaling revenue and operations
   - **Technologies:** Utility-scale solar/wind farms, EV charging infrastructure, battery storage systems (grid-scale), heat pumps for buildings, carbon accounting software (Watershed, Persefoni), EV fleets, industrial electrification, smart grid solutions, regenerative agriculture platforms
   - **Who Should Join:** Growth-oriented professionals seeking balance between impact and stability, those with scaling/operations expertise, individuals who want proven technology with room for optimization
   - **Example Jobs:** Senior Software Engineer at EV charging network, Operations Manager for solar installation company, Product Lead at carbon accounting SaaS, Supply Chain Director at heat pump manufacturer
   - **Career Advice:** Offers competitive salaries, equity upside potential, faster career progression as companies scale, and high job security with clear business models

3. **🏢 ESTABLISHED TECHNOLOGIES** (Low Risk, Proven Impact)
   - **Definition:** Mature, commercially viable technologies with established markets and clear ROI
   - **Risk Profile:** Low risk, profitable business models, immediate deployment
   - **Company Stage:** Series D+, Public companies, or established divisions of large corporations
   - **Technologies:** Onshore wind (Vestas, Ørsted), rooftop solar (SunPower, Enphase), LED lighting, energy efficiency consulting, electric buses (Proterra, BYD), building retrofits, wastewater treatment, recycling/circular economy, organic agriculture, LEED-certified construction
   - **Who Should Join:** Stability-focused professionals, those transitioning from traditional industries, individuals prioritizing work-life balance and benefits, people seeking predictable career paths in climate
   - **Example Jobs:** Project Manager at established solar developer, Sustainability Consultant at Big 4 firm, Energy Efficiency Analyst at utility company, Supply Chain Manager at mature EV manufacturer
   - **Career Advice:** Offers highest job security, competitive 401k/benefits, slower equity growth but steady salary increases, well-defined career ladders, and better work-life balance

**KEY DISTINCTIONS FOR CANDIDATES:**
- **Moonshot:** Choose if you're energized by uncertainty, R&D, and potential to invent the future (higher risk, higher potential reward)
- **Essential:** Choose if you want to scale proven solutions, build operations, and see immediate climate impact (balanced risk/reward)
- **Established:** Choose if you prioritize stability, predictable growth, and working with mature technologies (lower risk, steady income)

**WHEN USERS ASK ABOUT RISK APPETITE:**
- Explain these three categories clearly with specific examples
- Ask about their risk tolerance, career stage, and financial situation
- Recommend job types based on their preferences (e.g., seed-stage DAC startup vs. public solar company)
- Note that impact exists across all three—it's about personal fit, not superiority

`;

  // Add climate category context if detected
  if (categoryContext) {
    systemPrompt += categoryContext;
    systemPrompt += '\n**IMPORTANT:** The user mentioned keywords from the categories above. Provide information about these specific climate categories, related technologies, and career opportunities in these areas.\n\n';
  }

  // Add specific context if available
  if (context.sectors && context.sectors.length > 0) {
    systemPrompt += '\n**Relevant Context for this Query:**\n\n';

    context.sectors.forEach(sector => {
      systemPrompt += `**${sector.name} Sector:**\n`;
      systemPrompt += `${sector.description}\n`;
      if (sector.technologies) {
        systemPrompt += `Key technologies: ${sector.technologies.slice(0, 5).join(', ')}\n`;
      }
      if (sector.imperatives) {
        systemPrompt += `Critical imperatives: ${sector.imperatives.slice(0, 3).join('; ')}\n`;
      }
      systemPrompt += '\n';
    });
  }

  if (context.imperatives && context.imperatives.length > 0) {
    systemPrompt += `**Relevant Innovation Imperatives:**\n`;
    systemPrompt += context.imperatives.map(imp => `- ${imp}`).join('\n');
    systemPrompt += '\n\n';
  }

  if (context.moonshots && context.moonshots.length > 0) {
    systemPrompt += `**Relevant Moonshot Technologies:**\n`;
    systemPrompt += context.moonshots.map(ms => `- ${ms}`).join('\n');
    systemPrompt += '\n\n';
  }

  // Add job table if jobs are available
  if (matchedJobs && matchedJobs.length > 0) {
    // Check if jobs have matched_categories (from category-specific search)
    const hasCategoryMatches = matchedJobs.some(job => job.matched_categories);

    if (hasCategoryMatches) {
      systemPrompt += `\n**CATEGORY-SPECIFIC JOB MATCHES:**\n`;
      systemPrompt += `These jobs were matched based on their specific climate category tags. Each job below is directly tagged with categories matching "${userQuery.replace(/show me jobs in|jobs in|find jobs in|list jobs in/i, '').trim()}".\n\n`;
    } else {
      systemPrompt += `\nRELEVANT CLIMATE-TECH JOB OPPORTUNITIES:\n`;
    }

    systemPrompt += formatJobsTable(matchedJobs);

    // Add matched categories information
    if (hasCategoryMatches) {
      systemPrompt += `\n**CATEGORY MATCH DETAILS:**\n`;
      matchedJobs.slice(0, 5).forEach(job => {
        if (job.matched_categories && job.matched_categories.length > 0) {
          systemPrompt += `- ${job.title} at ${job.company}: ${job.matched_categories.join(', ')}\n`;
        }
      });
      systemPrompt += '\n';
    }

    // Add taxonomy context for matched jobs
    const uniqueSectors = new Set();
    const uniqueImperatives = new Set();
    const uniqueMoonshots = new Set();
    const uniqueCategories = new Set();

    matchedJobs.forEach(job => {
      if (job.taxonomy) {
        job.taxonomy.sectors.forEach(s => uniqueSectors.add(s));
        job.taxonomy.innovation_imperatives.forEach(i => uniqueImperatives.add(i));
        job.taxonomy.moonshots.forEach(m => uniqueMoonshots.add(m));
      }
      if (job.matched_categories) {
        job.matched_categories.forEach(c => uniqueCategories.add(c));
      }
    });

    if (uniqueImperatives.size > 0) {
      systemPrompt += `\nINNOVATION IMPERATIVES (Critical Near-Term Needs):\n`;
      Array.from(uniqueImperatives).slice(0, 5).forEach(imp => {
        systemPrompt += `- ${imp}\n`;
      });
    }

    if (uniqueMoonshots.size > 0) {
      systemPrompt += `\nRELATED MOONSHOTS (High-Risk, High-Reward Technologies):\n`;
      Array.from(uniqueMoonshots).slice(0, 3).forEach(ms => {
        systemPrompt += `- ${ms}\n`;
      });
    }

  }

  systemPrompt += `\nUser Question: ${userQuery}\n\n`;

  if (matchedJobs && matchedJobs.length > 0) {
    systemPrompt += `**MANDATORY RESPONSE FORMAT:**

STEP 1: Copy the EXACT job table from above. Start with the line "POSITION | COMPANY | LOCATION..." and include ALL rows exactly as provided. Do NOT modify, summarize, or recreate the table.

STEP 2: After the table, add a brief paragraph (3-4 sentences) explaining:
- Why these specific jobs match the requested category/sector
- Key skills or technologies relevant to these roles
- Impact scores and emissions categories
- One actionable career tip for breaking into this specific area

STEP 3: End with: "How can I help you further with your climate-tech career search?"

⚠️ CRITICAL REQUIREMENTS:
- Your response MUST start with the job table. Do NOT start with explanatory text.
- ONLY show jobs that are truly relevant to the specific category/subcategory requested.
- If jobs have matched_categories information, reference those specific climate categories in your explanation.
- Be SELECTIVE - it's better to show 5 highly relevant jobs than 15 loosely related ones.`;
  } else {
    systemPrompt += `Provide a CONCISE, focused answer with ACTIONABLE STEPS.

**FORMAT:**
1. Brief intro (1-2 sentences)
2. Numbered action list (3-5 specific steps)
3. One key insight about emissions impact or innovation opportunities

**EXAMPLE RESPONSE STRUCTURE:**
"Breaking into climate tech requires strategic preparation. Here's how:

1. Build relevant skills (Python, data analysis, or domain expertise in energy/materials)
2. Network with climate professionals on LinkedIn and at conferences
3. Contribute to open-source climate projects or volunteer with climate organizations
4. Target high-impact sectors (Manufacturing: 46.4%, Electricity: 23.1%)
5. Apply to roles in Innovation Imperatives for maximum career momentum

The Electricity sector offers the fastest growth opportunities right now.

How can I help you with your climate-tech career exploration?"

IMPORTANT: End your response with: "How can I help you with your climate-tech career exploration?"`;
  }

  return systemPrompt;
}

/**
 * Detect climate categories mentioned in user query
 * @param {string} query - User query
 * @returns {Array} - Matched categories with scores
 */
function detectClimateCategories(query) {
  const lowerQuery = query.toLowerCase();
  const matches = [];

  Object.entries(categoryTaxonomy).forEach(([categoryPath, categoryData]) => {
    let matchScore = 0;
    const matchedKeywords = [];

    // Check each keyword in the category
    categoryData.keywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) {
        matchScore += 1;
        matchedKeywords.push(keyword);
      }
    });

    if (matchScore > 0) {
      matches.push({
        path: categoryPath,
        score: matchScore,
        matchedKeywords: matchedKeywords,
        data: categoryData
      });
    }
  });

  // Sort by match score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, 3); // Return top 3 matches
}

/**
 * Get related categories in the same sector
 * @param {string} categoryPath - Full category path
 * @returns {Array} - Related categories
 */
function getRelatedCategories(categoryPath) {
  const sector = categoryPath.split(' > ')[0];
  const related = [];

  Object.entries(categoryTaxonomy).forEach(([path, data]) => {
    if (path !== categoryPath && path.startsWith(sector)) {
      related.push({
        path: path,
        jobCount: data.jobCount
      });
    }
  });

  return related;
}

/**
 * Format category information for the chatbot
 * @param {Array} matchedCategories - Matched categories
 * @returns {string} - Formatted context
 */
function formatCategoryContext(matchedCategories) {
  if (!matchedCategories || matchedCategories.length === 0) {
    return '';
  }

  let context = '\n**DETECTED CLIMATE CATEGORIES:**\n';

  matchedCategories.forEach(match => {
    const parts = match.path.split(' > ');
    const sector = parts[0];
    const subcategory = parts[1] || '';
    const technology = parts[2] || '';

    context += `\n📍 **${match.path}**\n`;
    context += `   - Sector: ${sector}\n`;
    if (subcategory) context += `   - Focus Area: ${subcategory}\n`;
    if (technology) context += `   - Technology: ${technology}\n`;
    context += `   - Available Jobs: ${match.data.jobCount}\n`;
    context += `   - Related Keywords: ${match.data.keywords.slice(0, 8).join(', ')}\n`;

    // Get related categories in same sector
    const related = getRelatedCategories(match.path);
    if (related.length > 0) {
      context += `   - Related Areas in ${sector}:\n`;
      related.slice(0, 3).forEach(rel => {
        context += `     • ${rel.path.split(' > ').slice(1).join(' > ')} (${rel.jobCount} jobs)\n`;
      });
    }
  });

  return context;
}

/**
 * Detect if user is asking for job listings
 * @param {string} query - User query
 * @returns {boolean} - True if asking for jobs
 */
function detectJobQuery(query) {
  const lowercaseQuery = query.toLowerCase();

  // Advice/guidance keywords (definitely NOT job queries)
  const adviceKeywords = [
    'how do i', 'how can i', 'how to', 'what should i', 'what can i do',
    'advice', 'help me', 'guide', 'tips', 'suggestions',
    'transition', 'break into', 'get started', 'learn',
    'what is', 'explain', 'tell me about', 'describe',
    'why', 'when', 'where should', 'which skills'
  ];

  // If it's clearly an advice query, return false
  const isAdviceQuery = adviceKeywords.some(keyword => lowercaseQuery.includes(keyword));
  if (isAdviceQuery) {
    return false;
  }

  // STRICT job request patterns - only explicit job searches
  const explicitJobPhrases = [
    'show me jobs', 'find jobs', 'list jobs', 'search jobs',
    'show me positions', 'find positions', 'list positions',
    'show me roles', 'find roles', 'list roles',
    'job openings', 'job opportunities', 'job listings',
    'available jobs', 'available positions', 'available roles',
    'looking for a job', 'looking for jobs', 'looking for positions',
    'searching for jobs', 'searching for positions',
    'find me a job', 'find me jobs', 'show me a job',
    'what jobs', 'which jobs', 'any jobs',
    // Additional user-specified phrases
    'find a job', 'look for a job', 'search for a job',
    'open positions', 'who is hiring', 'companies hiring',
    'hiring near me', 'apply for a job', 'any jobs for',
    // List/table request phrases
    'a list of jobs', 'list of jobs', 'a table of jobs', 'table of jobs',
    'give me a list', 'show me a list', 'give me a table', 'show me a table',
    // "Can you give me" phrases for jobs
    'can you give me a job', 'can you give me jobs',
    'can you give me an excel of jobs', 'give me a job', 'give me jobs',
    'give me an excel of jobs',
    // Internship-specific phrases
    'show me internships', 'find internships', 'list internships', 'search internships',
    'internship openings', 'internship opportunities', 'internship listings',
    'available internships', 'looking for an internship', 'looking for internships',
    'searching for internships', 'find me an internship', 'find me internships',
    'show me an internship', 'what internships', 'which internships', 'any internships',
    'can you give me an internship', 'can you give me internships',
    'can you give me an excel of internships', 'give me an internship', 'give me internships',
    'give me an excel of internships',
    'a list of internships', 'list of internships', 'a table of internships', 'table of internships',
    // Executive/senior level job searches
    'executive jobs', 'executive-level jobs', 'executive level jobs', 'senior jobs', 'senior-level jobs',
    'leadership jobs', 'leadership positions', 'c-suite jobs', 'director jobs', 'vp jobs',
    'what executive jobs', 'what senior jobs', 'what leadership jobs',
    'jobs can i look at', 'positions can i look at', 'roles can i look at',
    'what jobs can i', 'what positions can i', 'what roles can i',
    // Category-specific job searches
    'jobs among these categories', 'jobs in these categories', 'positions in these categories',
    'jobs among', 'positions among', 'roles among',
    'give me some jobs', 'show me some jobs', 'find me some jobs',
    'jobs in advanced materials', 'jobs in fusion', 'jobs in direct air capture',
    'jobs in battery', 'jobs in novel battery', 'jobs in carbon capture'
  ];

  // Check for explicit job request phrases
  return explicitJobPhrases.some(phrase => lowercaseQuery.includes(phrase));
}

/**
 * Filter and enhance user query to emphasize climate-tech focus
 * @param {string} query - Original user query
 * @param {Array} keywords - Extracted keywords
 * @returns {Object} - Filtered query and metadata
 */
function filterQuery(query, keywords) {
  const lowercaseQuery = query.toLowerCase();

  // Check if query is climate-tech related
  const climateTerms = ['climate', 'carbon', 'emission', 'renewable', 'clean energy',
                        'sustainability', 'decarbonization', 'net zero', 'greenhouse gas'];

  const hasClimateTerm = climateTerms.some(term => lowercaseQuery.includes(term)) || keywords.length > 0;

  // If query seems off-topic, redirect gently
  if (!hasClimateTerm && query.length > 10) {
    const offTopicTerms = ['weather', 'recipe', 'movie', 'game', 'sports'];
    if (offTopicTerms.some(term => lowercaseQuery.includes(term))) {
      return {
        isOffTopic: true,
        redirectMessage: `I'm a climate-tech specialist focused on decarbonization and clean energy solutions. While I can't help with that specific topic, I'd be happy to discuss climate technologies!

For example, I can help you understand:
- Clean energy technologies (solar, wind, batteries)
- Decarbonization strategies for different sectors
- Emerging climate innovations and moonshots
- Carbon removal technologies

Would you like to explore any climate-tech topics?`
      };
    }
  }

  return {
    isOffTopic: false,
    enhancedQuery: query
  };
}

/**
 * Main chat endpoint
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Extract keywords from query
    const keywords = extractKeywords(message);
    console.log('Extracted keywords:', keywords);

    // Detect climate categories mentioned
    const matchedCategories = detectClimateCategories(message);
    console.log('Matched categories:', matchedCategories.map(m => m.path));

    // Filter query for relevance
    const filtered = filterQuery(message, keywords);

    if (filtered.isOffTopic) {
      return res.json({ response: filtered.redirectMessage });
    }

    // Retrieve relevant context (RAG)
    const context = retrieveContext(keywords);
    console.log('Retrieved context for sectors:', context.sectors.map(s => s.name));

    // Format category context if categories were detected
    const categoryContext = formatCategoryContext(matchedCategories);

    // Detect if user is asking for jobs
    const isAskingForJobs = detectJobQuery(message);
    console.log('Is asking for jobs:', isAskingForJobs);

    // Only search for jobs if user is explicitly asking
    let matchedJobs = [];
    if (isAskingForJobs) {
      matchedJobs = searchJobs(message);
      console.log(`Found ${matchedJobs.length} matching jobs`);

      // Return structured job data instead of text response
      return res.json({
        type: 'jobs',
        jobs: matchedJobs,
        count: matchedJobs.length,
        query: message,
        metadata: {
          keywords: keywords,
          sectorsReferenced: context.sectors.map(s => s.name)
        }
      });
    }

    // Build enhanced prompt with jobs (only if asking for jobs)
    const prompt = buildPrompt(context, message, matchedJobs, isAskingForJobs, categoryContext);

    // Call Gemini API v1 directly
    const apiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }

    const data = await apiResponse.json();
    const text = data.candidates[0].content.parts[0].text;

    res.json({
      type: 'text',
      response: text,
      metadata: {
        keywords: keywords,
        sectorsReferenced: context.sectors.map(s => s.name)
      }
    });

  } catch (error) {
    console.error('Error in /api/chat:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);

    // Handle specific Gemini API errors
    if (error.message && error.message.includes('API key')) {
      return res.status(401).json({
        error: 'Invalid API key. Please check your GEMINI_API_KEY in .env file.',
        details: error.message
      });
    }

    if (error.message && error.message.includes('quota')) {
      return res.status(429).json({
        error: 'API quota exceeded. Please try again later.',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'An error occurred while processing your request. Please try again.',
      details: error.message,
      type: error.name
    });
  }
});

/**
 * Resume parsing functions (adapted from resume_parser.js)
 */
async function extractTextFromPdf(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  } catch (e) {
    throw new Error(`PDF parsing failed: ${e.message}`);
  }
}

async function parseResumeWithGemini(text) {
  const systemPrompt = `You are a resume parser. Extract information from the resume text and return a single JSON object with exactly these keys (no extra keys, no markdown, no code fence):
- name (string)
- email (string)
- skills (array of strings: all skills mentioned anywhere on the resume)
- areas_of_interest (array of strings)
- industries_worked_in (array of strings)
- total_years_in_workforce (number, can be 0)
- total_years_in_this_workforce (number: years in climate/sustainability/energy-related roles)
- is_student (boolean: true if currently enrolled or has a future graduation date)
- is_pivoting_into_climate_tech (boolean: true if mostly non-climate background but clear climate interest)
- engineer_level (string: one of "junior" | "mid" | "senior" | "unknown"; infer from years and titles)
- work_experience (array of objects, each with: title, company, industry, start_date, end_date, duration_years number, and skills: array of strings)

Return ONLY the JSON object. No markdown code blocks, no explanations, no backticks.`;

  const prompt = systemPrompt + "\n\n---\nResume text:\n\n" + text.slice(0, 120000);

  // Use v1beta endpoint for JSON mode support
  const betaUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const response = await fetch(`${betaUrl}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            areas_of_interest: { type: 'array', items: { type: 'string' } },
            industries_worked_in: { type: 'array', items: { type: 'string' } },
            total_years_in_workforce: { type: 'number' },
            total_years_in_this_workforce: { type: 'number' },
            is_student: { type: 'boolean' },
            is_pivoting_into_climate_tech: { type: 'boolean' },
            engineer_level: { type: 'string' },
            work_experience: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  company: { type: 'string' },
                  industry: { type: 'string' },
                  start_date: { type: 'string' },
                  end_date: { type: 'string' },
                  duration_years: { type: 'number' },
                  skills: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },
          required: ['name', 'email', 'skills', 'areas_of_interest', 'industries_worked_in',
                     'total_years_in_workforce', 'total_years_in_this_workforce',
                     'is_student', 'is_pivoting_into_climate_tech', 'engineer_level', 'work_experience']
        }
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error response:', errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const out = await response.json();
  let raw = '';
  const candidates = out.candidates || [];
  for (const c of candidates) {
    const parts = c.content?.parts || [];
    for (const p of parts) {
      if (p.text) {
        raw = p.text.trim();
        break;
      }
    }
    if (raw) break;
  }

  if (!raw) {
    console.error('No text in Gemini response:', JSON.stringify(out).substring(0, 500));
    throw new Error('No text in Gemini response');
  }

  // Clean up the response - remove markdown code blocks and extra text
  let cleanedRaw = raw.trim();

  // Remove markdown code fences
  cleanedRaw = cleanedRaw.replace(/^```json\s*\n?/i, '').replace(/^```\s*\n?/, '');
  cleanedRaw = cleanedRaw.replace(/\n?```\s*$/, '');

  // Try to extract JSON object if there's surrounding text
  const jsonMatch = cleanedRaw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedRaw = jsonMatch[0];
  }

  // Remove any trailing commas before closing braces/brackets
  cleanedRaw = cleanedRaw.replace(/,(\s*[}\]])/g, '$1');

  console.log('Cleaned JSON response (first 500 chars):', cleanedRaw.substring(0, 500));

  // Parse JSON with better error handling
  let data;
  try {
    data = JSON.parse(cleanedRaw);
  } catch (parseError) {
    console.error('JSON parse error:', parseError.message);
    console.error('Raw text (first 1000 chars):', cleanedRaw.substring(0, 1000));

    // Try one more time with even more aggressive cleaning
    try {
      // Remove any non-printable characters
      const superCleaned = cleanedRaw.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      data = JSON.parse(superCleaned);
      console.log('Successfully parsed after aggressive cleaning');
    } catch (secondError) {
      throw new Error(`Failed to parse JSON from Gemini response. Please try uploading your resume again. Error: ${parseError.message}`);
    }
  }

  // Ensure all required fields exist with defaults
  data.name = data.name || '';
  data.email = data.email || '';
  data.skills = Array.isArray(data.skills) ? data.skills : [];
  data.areas_of_interest = Array.isArray(data.areas_of_interest) ? data.areas_of_interest : [];
  data.industries_worked_in = Array.isArray(data.industries_worked_in) ? data.industries_worked_in : [];
  data.total_years_in_workforce = Number(data.total_years_in_workforce) || 0;
  data.total_years_in_this_workforce = Number(data.total_years_in_this_workforce) || 0;
  data.is_student = Boolean(data.is_student);
  data.is_pivoting_into_climate_tech = Boolean(data.is_pivoting_into_climate_tech);
  data.engineer_level = data.engineer_level || 'unknown';
  data.work_experience = Array.isArray(data.work_experience) ? data.work_experience : [];

  return data;
}

/**
 * Match jobs based on resume skills and interests
 */
function matchJobsToResume(resumeData) {
  if (!jobsKnowledge || !jobsKnowledge.jobs) return [];

  const skills = (resumeData.skills || []).map(s => s.toLowerCase());
  const interests = (resumeData.areas_of_interest || []).map(i => i.toLowerCase());
  const industries = (resumeData.industries_worked_in || []).map(i => i.toLowerCase());

  const matchedJobs = [];

  jobsKnowledge.jobs.forEach(job => {
    let matchScore = 0;
    const matchedSkills = [];

    const jobText = `${job.title} ${job.skills_keywords} ${job.work_areas} ${job.company}`.toLowerCase();

    // Skill matching (highest priority)
    skills.forEach(skill => {
      if (skill.length > 2 && jobText.includes(skill)) {
        matchScore += 5;
        matchedSkills.push(skill);
      }
    });

    // Interest matching
    interests.forEach(interest => {
      if (interest.length > 3 && jobText.includes(interest)) {
        matchScore += 3;
      }
    });

    // Industry matching
    industries.forEach(industry => {
      if (industry.length > 3 && jobText.includes(industry)) {
        matchScore += 2;
      }
    });

    // Experience level matching
    const experienceLevel = resumeData.engineer_level || 'unknown';
    const jobLevel = (job.experience_level || '').toLowerCase();
    if (experienceLevel !== 'unknown' && jobLevel.includes(experienceLevel)) {
      matchScore += 3;
    }

    if (matchScore > 0) {
      matchedJobs.push({
        ...job,
        match_score: matchScore,
        matched_skills: matchedSkills
      });
    }
  });

  // Sort by match score
  matchedJobs.sort((a, b) => b.match_score - a.match_score);

  // Return top 20 matches
  return matchedJobs.slice(0, 20);
}

/**
 * Match jobs to resume with user preferences
 * @param {Object} resumeData - Parsed resume data
 * @param {Object} preferences - User preferences (sectors, riskAppetite)
 * @returns {Array} - Filtered and matched jobs
 */
function matchJobsWithPreferences(resumeData, preferences) {
  // First get all matched jobs based on resume
  let matchedJobs = matchJobsToResume(resumeData);

  // Apply sector filter if specified
  if (preferences.sectors && preferences.sectors.length > 0) {
    const selectedSectors = preferences.sectors.map(s => s.toLowerCase());
    matchedJobs = matchedJobs.filter(job => {
      const jobSectors = (job.climate_categories || []).map(c => c.split(' > ')[0].toLowerCase());
      return selectedSectors.some(sector => jobSectors.includes(sector));
    });
  }

  // Apply risk appetite filter if specified
  if (preferences.riskAppetite) {
    matchedJobs = matchedJobs.map(job => {
      let riskBonus = 0;
      const companyStage = (job.company_stage || '').toLowerCase();
      const tags = (job.tags || []).map(t => t.toLowerCase());

      if (preferences.riskAppetite === 'moonshot') {
        // Prefer early-stage, innovative, high-risk companies
        if (companyStage.includes('seed') || companyStage.includes('series a') ||
            tags.includes('moonshot') || tags.includes('deep tech') ||
            tags.includes('r&d') || tags.includes('lab')) {
          riskBonus = 10;
        }
      } else if (preferences.riskAppetite === 'essential') {
        // Prefer growth-stage, scaling companies
        if (companyStage.includes('series b') || companyStage.includes('series c') ||
            companyStage.includes('growth') || tags.includes('scaling')) {
          riskBonus = 10;
        }
      } else if (preferences.riskAppetite === 'established') {
        // Prefer mature, established companies
        if (companyStage.includes('series d+') || companyStage.includes('public') ||
            companyStage.includes('established') || tags.includes('mature')) {
          riskBonus = 10;
        }
      }

      return {
        ...job,
        match_score: job.match_score + riskBonus
      };
    });

    // Re-sort by updated match scores
    matchedJobs.sort((a, b) => b.match_score - a.match_score);
  }

  // Return top 20 matches
  return matchedJobs.slice(0, 20);
}

/**
 * Resume upload endpoint
 */
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    console.log('=== Resume Upload Request Started ===');

    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', {
      name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Extract text from PDF
    let text;
    if (req.file.mimetype === 'application/pdf') {
      console.log('Extracting text from PDF...');
      try {
        text = await extractTextFromPdf(req.file.buffer);
        console.log('✅ PDF text extracted, length:', text.length);
      } catch (pdfError) {
        console.error('❌ PDF extraction failed:', pdfError);
        return res.status(500).json({
          error: 'Failed to extract text from PDF',
          details: pdfError.message
        });
      }
    } else {
      console.log('Non-PDF file type');
      return res.status(400).json({ error: 'Only PDF files are supported. Please upload a PDF resume.' });
    }

    if (!text || text.trim().length === 0) {
      console.error('❌ Empty text extracted from PDF');
      return res.status(400).json({ error: 'Could not extract text from resume. The PDF may be scanned or image-based.' });
    }

    console.log('Text sample (first 200 chars):', text.substring(0, 200));

    // Parse resume with Gemini
    console.log('Parsing resume with Gemini...');
    let resumeData;
    try {
      resumeData = await parseResumeWithGemini(text);
      console.log('✅ Resume parsed successfully:', {
        name: resumeData.name,
        email: resumeData.email,
        skills_count: resumeData.skills?.length || 0,
        interests_count: resumeData.areas_of_interest?.length || 0,
        experience_level: resumeData.engineer_level,
        total_years: resumeData.total_years_in_workforce
      });
    } catch (parseError) {
      console.error('❌ Gemini parsing failed:', parseError);
      return res.status(500).json({
        error: 'Failed to parse resume with AI',
        details: parseError.message
      });
    }

    // Check if we have job data
    if (!jobsKnowledge || !jobsKnowledge.jobs || jobsKnowledge.jobs.length === 0) {
      console.error('❌ No job data available');
      return res.status(500).json({
        error: 'Job database not available',
        details: 'The job matching system is temporarily unavailable'
      });
    }

    // Match jobs to resume
    console.log('Matching jobs to resume...');
    const matchedJobs = matchJobsToResume(resumeData);
    console.log(`✅ Matched ${matchedJobs.length} jobs to resume`);

    if (matchedJobs.length > 0) {
      console.log('Top 3 matches:', matchedJobs.slice(0, 3).map(j => ({
        title: j.title,
        company: j.company,
        score: j.match_score
      })));
    }

    // Return profile and matched jobs
    res.json({
      profile: resumeData,
      jobs: matchedJobs,
      debug: {
        text_length: text.length,
        skills_extracted: resumeData.skills?.length || 0,
        jobs_in_database: jobsKnowledge.totalJobs,
        matches_found: matchedJobs.length
      }
    });

    console.log('=== Resume Upload Request Completed Successfully ===');

  } catch (error) {
    console.error('❌ Unexpected error processing resume:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Failed to process resume',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Category jobs endpoint - returns JSON jobs for a specific category
app.post('/api/category-jobs', async (req, res) => {
  try {
    const { category } = req.body;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log('Searching jobs for category:', category);

    // Get jobs for this category
    const jobs = searchJobsByCategory(category);

    console.log(`Found ${jobs.length} jobs for category: ${category}`);

    // Return jobs as JSON
    res.json({
      category: category,
      count: jobs.length,
      jobs: jobs
    });

  } catch (error) {
    console.error('Error fetching category jobs:', error);
    res.status(500).json({
      error: 'Failed to fetch category jobs',
      details: error.message
    });
  }
});

// Get jobs by academic major endpoint
app.post('/api/major-jobs', async (req, res) => {
  try {
    const { major } = req.body;

    if (!major || typeof major !== 'string') {
      return res.status(400).json({ error: 'Major is required' });
    }

    console.log('Searching jobs for major:', major);

    // Get jobs for this major
    const jobs = searchJobsByMajor(major);

    console.log(`Found ${jobs.length} jobs for major: ${major}`);

    // Return jobs as JSON
    res.json({
      major: major,
      count: jobs.length,
      jobs: jobs
    });

  } catch (error) {
    console.error('Error fetching major jobs:', error);
    res.status(500).json({
      error: 'Failed to fetch major jobs',
      details: error.message
    });
  }
});

// Match jobs with user preferences endpoint
app.post('/api/match-jobs-with-preferences', async (req, res) => {
  try {
    const { profile, preferences } = req.body;

    if (!profile) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    console.log('Matching jobs with preferences:', {
      sectors: preferences?.sectors || [],
      riskAppetite: preferences?.riskAppetite || 'none'
    });

    // Match jobs with preferences
    const jobs = matchJobsWithPreferences(profile, preferences || {});

    console.log(`Found ${jobs.length} jobs matching profile and preferences`);

    res.json({
      count: jobs.length,
      jobs: jobs,
      preferences: preferences
    });

  } catch (error) {
    console.error('Error matching jobs with preferences:', error);
    res.status(500).json({
      error: 'Failed to match jobs with preferences',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Climate-Tech Chatbot API is running',
    sectorsLoaded: climateKnowledge ? Object.keys(climateKnowledge.sectors).length : 0,
    apiKeyConfigured: !!GEMINI_API_KEY,
    apiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    jobsLoaded: jobsKnowledge.totalJobs,
    taxonomyCoverage: enhancedTaxonomy?.metadata?.coverage_percent ? `${enhancedTaxonomy.metadata.coverage_percent}%` : 'N/A',
    categoryTaxonomyLoaded: categoryTaxonomy && Object.keys(categoryTaxonomy).length > 0,
    totalCategories: categoryTaxonomy ? Object.keys(categoryTaxonomy).length : 0,
    climateCategoriesDataLoaded: !!climateCategoriesData
  });
});

// REMOVED: /api/categories endpoint temporarily disabled due to routing issues
// Category job display now uses /api/chat endpoint instead
// The frontend sends queries like "Show me jobs in [category]" to the chatbot API

// Start server (for local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌍 Climate-Tech Chatbot server running on http://localhost:${PORT}`);
    console.log(`📚 Loaded ${Object.keys(climateKnowledge.sectors).length} climate-tech sectors`);
    console.log(`🔑 API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No (Please add to .env file)'}`);
  });
}

// Export for Vercel serverless
module.exports = app;
