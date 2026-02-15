#!/usr/bin/env node
/**
 * Convert climate_jobs_v6.csv to JSON format for the application
 */

const fs = require('fs');
const path = require('path');

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function convertCSVtoJSON(csvPath, jsonPath) {
    console.log('Reading CSV file:', csvPath);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Parse header
    const headers = parseCSVLine(lines[0]);
    console.log('Headers:', headers);
    console.log('Total lines:', lines.length);

    const jobs = [];

    // Parse each job
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length !== headers.length) {
            console.warn(`Line ${i + 1}: Column count mismatch. Expected ${headers.length}, got ${values.length}`);
            continue;
        }

        const job = {};
        headers.forEach((header, index) => {
            let value = values[index];

            // Convert empty strings to appropriate defaults
            if (value === '' || value === 'null' || value === 'None') {
                value = null;
            }

            // Parse specific fields
            if (header === 'salary_min' || header === 'salary_max') {
                value = value ? parseFloat(value) : null;
            } else if (header === 'climate_sectors' || header === 'climate_opportunity_areas' ||
                       header === 'climate_innovation_imperatives' || header === 'applicable_majors' ||
                       header === 'skills') {
                // Parse comma-separated strings into arrays
                value = value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
            }

            job[header] = value;
        });

        // Add climate_categories field for compatibility (combining sectors and areas)
        const categories = [];
        if (job.climate_sectors && Array.isArray(job.climate_sectors)) {
            job.climate_sectors.forEach(sector => {
                if (job.climate_opportunity_areas && Array.isArray(job.climate_opportunity_areas)) {
                    job.climate_opportunity_areas.forEach(area => {
                        categories.push(`${sector} > ${area}`);
                    });
                } else {
                    categories.push(sector);
                }
            });
        }
        job.climate_categories = categories;

        // Add fields for backward compatibility
        job.skills_keywords = Array.isArray(job.skills) ? job.skills.join(', ') : '';
        job.work_areas = Array.isArray(job.climate_opportunity_areas) ? job.climate_opportunity_areas.join(', ') : '';

        jobs.push(job);
    }

    console.log(`Parsed ${jobs.length} jobs`);

    // Create output object
    const output = {
        jobs: jobs,
        metadata: {
            total_jobs: jobs.length,
            source: 'climate_jobs_v6.csv',
            converted_at: new Date().toISOString(),
            sectors: [...new Set(jobs.flatMap(j => j.climate_sectors || []))],
            locations: [...new Set(jobs.map(j => j.location).filter(Boolean))].slice(0, 50)
        }
    };

    console.log('Writing JSON file:', jsonPath);
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log('✅ Conversion complete!');
    console.log(`Total jobs: ${output.metadata.total_jobs}`);
    console.log(`Sectors: ${output.metadata.sectors.length}`);
}

// Run conversion
const csvPath = path.join(__dirname, 'climate_jobs_v6.csv');
const jsonPath = path.join(__dirname, 'climate_jobs_v6.json');

convertCSVtoJSON(csvPath, jsonPath);
