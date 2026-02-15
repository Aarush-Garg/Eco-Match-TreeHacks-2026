#!/usr/bin/env node
/**
 * Resume parser using an LLM (OpenAI or Gemini).
 * Extracts structured JSON from PDF and TXT resumes.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Schema & constants
// ---------------------------------------------------------------------------

const CLIMATE_KEYWORDS = new Set([
  "climate", "sustainability", "sustainable", "energy", "renewable", "clean tech",
  "clean energy", "environmental", "environment", "carbon", "green", "esg",
  "cleantech", "decarbon", "solar", "wind", "battery", "ev", "electric vehicle",
]);

function getEnvKey() {
  return process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY;
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

async function extractTextFromPdf(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return (data.text || "").trim();
  } catch (e) {
    throw new Error(`PDF support requires 'pdf-parse'. Install with: npm install pdf-parse. ${e.message}`);
  }
}

function extractTextFromTxt(filePath) {
  return fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").trim();
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return extractTextFromPdf(filePath);
  if (ext === ".txt") return extractTextFromTxt(filePath);
  throw new Error(`Unsupported file type: ${ext}`);
}

// ---------------------------------------------------------------------------
// Normalization & computation
// ---------------------------------------------------------------------------

function deduplicateSkills(skills) {
  const seen = new Set();
  const out = [];
  for (const s of skills || []) {
    if (typeof s !== "string" || !s.trim()) continue;
    const key = s.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s.trim());
    }
  }
  return out;
}

function normalizeIndustry(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim();
}

function normalizeIndustries(industries) {
  const seen = new Set();
  const out = [];
  for (const ind of industries || []) {
    if (typeof ind !== "string") continue;
    const n = normalizeIndustry(ind);
    if (!n) continue;
    const key = n.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

function isClimateRelated(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [...CLIMATE_KEYWORDS].some((kw) => t.includes(kw));
}

function parseDurationYears(start, end, durationYears) {
  if (durationYears && durationYears > 0) return Number(durationYears);
  const yearFrom = (s) => {
    if (!s || typeof s !== "string") return null;
    const m = s.trim().match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  };
  const y1 = yearFrom(start);
  const y2 = yearFrom(end);
  if (y1 != null && y2 != null) return Math.max(0, y2 - y1);
  if (y1 != null && !end) return Math.max(0, new Date().getFullYear() - y1);
  return 0;
}

function computeTotalWorkforceYears(workExperience) {
  if (!workExperience || !workExperience.length) return 0;
  let total = 0;
  for (const job of workExperience) {
    total += parseDurationYears(
      job.start_date || "",
      job.end_date || "",
      job.duration_years || 0
    );
  }
  return Math.round(total * 10) / 10;
}

function computeClimateYears(workExperience) {
  if (!workExperience || !workExperience.length) return 0;
  let total = 0;
  for (const job of workExperience) {
    const industry = (job.industry || "").trim();
    const company = (job.company || "").trim();
    const title = (job.title || "").trim();
    if (isClimateRelated(industry) || isClimateRelated(company) || isClimateRelated(title)) {
      total += parseDurationYears(
        job.start_date || "",
        job.end_date || "",
        job.duration_years || 0
      );
    }
  }
  return Math.round(total * 10) / 10;
}

function engineerLevelFromYears(years) {
  if (years < 0) return "unknown";
  if (years < 2) return "junior";
  if (years <= 5) return "mid";
  return "senior";
}

function applyPostProcessing(data) {
  data.skills = deduplicateSkills(data.skills || []);
  data.industries_worked_in = normalizeIndustries(data.industries_worked_in || []);

  const work = data.work_experience || [];
  for (const job of work) {
    job.industry = normalizeIndustry(job.industry || "");
  }

  const totalYears = computeTotalWorkforceYears(work);
  const climateYears = computeClimateYears(work);

  data.total_years_in_workforce = totalYears;
  data.total_years_in_this_workforce = climateYears;
  data.engineer_level = engineerLevelFromYears(totalYears);

  data.name = data.name ?? "";
  data.email = data.email ?? "";
  data.areas_of_interest = data.areas_of_interest ?? [];
  data.is_student = data.is_student ?? false;
  data.is_pivoting_into_climate_tech = data.is_pivoting_into_climate_tech ?? false;
  data.work_experience = data.work_experience ?? [];

  return data;
}

// ---------------------------------------------------------------------------
// LLM calls
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `You are a resume parser. Extract information from the resume text and return a single JSON object with exactly these keys (no extra keys, no markdown, no code fence):
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
- work_experience (array of objects, each with: title, company, industry, start_date, end_date, duration_years number, and skills: array of strings — for each role, list only the skills explicitly used or implied in that role's description/bullets, e.g. "skills": ["Python", "React"])

Return only valid JSON. No explanation, no markdown.`;
}

async function parseWithOpenAI(text, apiKey, model = "gpt-4o-mini") {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: `Parse this resume and return only the JSON object.\n\n---\n${text.slice(0, 120000)}` },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const raw = (json.choices?.[0]?.message?.content || "").trim();
  return parseJsonFromLlm(raw);
}

async function parseWithGemini(text, apiKey, model = "gemini-2.0-flash") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildSystemPrompt() + "\n\n---\nResume text:\n\n" + text.slice(0, 120000);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const out = await res.json();
  let raw = "";
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
  if (!raw) throw new Error("No text in Gemini response: " + JSON.stringify(out).slice(0, 500));
  return parseJsonFromLlm(raw);
}

function parseJsonFromLlm(raw) {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const lines = s.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === "```") lines.pop();
    s = lines.join("\n");
  }
  return JSON.parse(s);
}

async function parseResumeWithLlm(text, provider, apiKey, retryOnce = true) {
  const maxAttempts = retryOnce ? 2 : 1;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (provider === "openai") {
        return await parseWithOpenAI(text, apiKey);
      }
      if (provider === "gemini") {
        return await parseWithGemini(text, apiKey);
      }
      throw new Error(`Unknown provider: ${provider}`);
    } catch (e) {
      lastError = e;
      if (e.name === "SyntaxError" || e.message.includes("JSON")) {
        continue;
      }
      if (attempt === 0 && retryOnce) continue;
      throw e;
    }
  }
  throw lastError || new Error("Failed to parse JSON from LLM");
}

// ---------------------------------------------------------------------------
// Main flow & output
// ---------------------------------------------------------------------------

function ensureWorkExperienceShape(data) {
  const work = data.work_experience || [];
  const out = [];
  for (const job of work) {
    if (typeof job !== "object" || job === null) continue;
    let rawSkills = job.skills;
    if (!Array.isArray(rawSkills)) rawSkills = [];
    const skills = deduplicateSkills(rawSkills.filter((s) => typeof s === "string"));
    out.push({
      title: String(job.title ?? ""),
      company: String(job.company ?? ""),
      industry: String(job.industry ?? ""),
      start_date: String(job.start_date ?? ""),
      end_date: String(job.end_date ?? ""),
      duration_years: Number(job.duration_years ?? 0) || 0,
      skills,
    });
  }
  data.work_experience = out;
}

async function processOneResume(filePath, provider, apiKey, outputDir) {
  let text;
  try {
    text = await extractTextFromFile(filePath);
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return null;
  }
  if (!text.trim()) {
    console.error(`Empty text from ${filePath}, skipping.`);
    return null;
  }

  let data;
  try {
    data = await parseResumeWithLlm(text, provider, apiKey, true);
  } catch (e) {
    console.error(`LLM parse failed for ${filePath}:`, e.message);
    return null;
  }

  ensureWorkExperienceShape(data);
  applyPostProcessing(data);

  const stem = path.basename(filePath, path.extname(filePath));
  const outName = `${stem}_parsed.json`;
  const outPath = path.join(outputDir, outName);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`Wrote ${outPath}`);

  return data;
}

function writeSummaryCsv(rows, outputPath) {
  if (!rows.length) return;
  const fieldnames = [
    "name", "email", "engineer_level", "total_years_in_workforce", "total_years_in_this_workforce",
    "is_student", "is_pivoting_into_climate_tech",
    "skills", "areas_of_interest", "industries_worked_in", "work_experience_count",
  ];
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [fieldnames.map(escape).join(",")];
  for (const r of rows) {
    const row = {
      name: r.name ?? "",
      email: r.email ?? "",
      engineer_level: r.engineer_level ?? "",
      total_years_in_workforce: r.total_years_in_workforce ?? "",
      total_years_in_this_workforce: r.total_years_in_this_workforce ?? "",
      is_student: r.is_student ?? false,
      is_pivoting_into_climate_tech: r.is_pivoting_into_climate_tech ?? false,
      skills: (r.skills || []).join("; "),
      areas_of_interest: (r.areas_of_interest || []).join("; "),
      industries_worked_in: (r.industries_worked_in || []).join("; "),
      work_experience_count: (r.work_experience || []).length,
    };
    lines.push(fieldnames.map((k) => escape(row[k])).join(","));
  }
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`Wrote summary: ${outputPath}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { resumesDir: null, file: null, provider: "gemini", outputDir: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" || args[i] === "-f") {
      out.file = args[++i];
    } else if (args[i] === "--provider") {
      out.provider = args[++i];
    } else if (args[i] === "--output-dir" || args[i] === "-o") {
      out.outputDir = args[++i];
    } else if (!args[i].startsWith("-")) {
      out.resumesDir = args[i];
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const apiKey = getEnvKey();
  if (!apiKey) {
    console.error("Set LLM_API_KEY (or OPENAI_API_KEY / GOOGLE_API_KEY) in the environment.");
    process.exit(1);
  }

  let resumesDir;
  let paths = [];

  if (args.file) {
    const resolved = path.resolve(args.file);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      console.error("File not found:", resolved);
      process.exit(1);
    }
    const ext = path.extname(resolved).toLowerCase();
    if (ext !== ".pdf" && ext !== ".txt") {
      console.error("Unsupported file type:", ext, ". Use .pdf or .txt.");
      process.exit(1);
    }
    resumesDir = path.dirname(resolved);
    paths = [resolved];
  } else {
    resumesDir = path.resolve(args.resumesDir || __dirname);
    if (!fs.existsSync(resumesDir) || !fs.statSync(resumesDir).isDirectory()) {
      console.error("Not a directory:", resumesDir);
      process.exit(1);
    }
    const names = fs.readdirSync(resumesDir);
    paths = names
      .filter((n) => {
        const e = path.extname(n).toLowerCase();
        return e === ".pdf" || e === ".txt";
      })
      .map((n) => path.join(resumesDir, n))
      .sort();
    if (!paths.length) {
      console.error("No PDF or TXT files found in", resumesDir);
      process.exit(1);
    }
  }

  const outputDir = args.outputDir || path.join(resumesDir, "parsed_output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];
  for (const filePath of paths) {
    const data = await processOneResume(filePath, args.provider, apiKey, outputDir);
    if (data) results.push(data);
  }

  writeSummaryCsv(results, path.join(outputDir, "summary.csv"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
