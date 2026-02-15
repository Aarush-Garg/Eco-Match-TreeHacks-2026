// Ensure page loads at top - multiple approaches for reliability
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Immediately scroll to top before page loads
window.scrollTo(0, 0);

// Remove hash from URL immediately
if (window.location.hash) {
    history.replaceState(null, null, window.location.pathname + window.location.search);
}

// On DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.scrollTo(0, 0);
});

// On full page load
window.addEventListener('load', () => {
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 0);
});

// DOM Elements
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');
const buttonText = document.getElementById('button-text');
const buttonLoader = document.getElementById('button-loader');
const suggestionChips = document.querySelectorAll('.suggestion-chip');

// API endpoint
const API_URL = '/api/chat';

// Store current jobs for CSV export
let currentResumeJobs = [];
let currentCategoryJobs = [];

// Timer variables for response time
let responseStartTime = null;
let timerInterval = null;

/**
 * Export jobs to CSV and download
 * @param {Array} jobs - Array of job objects
 * @param {string} filename - Name of the file (default: Eco-Match-jobs.csv)
 */
function exportJobsToCSV(jobs, filename = 'Eco-Match-jobs.csv') {
    if (!jobs || jobs.length === 0) {
        alert('No jobs to export');
        return;
    }

    // Define CSV headers
    const headers = [
        'Position',
        'Company',
        'Location',
        'Experience Level',
        'Climate Sectors',
        'Skills',
        'Salary Range',
        'URL',
        'Applied (Y/N)'
    ];

    // Convert jobs to CSV rows
    const rows = jobs.map(job => {
        const sectors = Array.isArray(job.climate_sectors)
            ? job.climate_sectors.join('; ')
            : (job.climate_sectors || '');

        const skills = Array.isArray(job.skills)
            ? job.skills.join('; ')
            : (job.skills_keywords || '');

        const salaryRange = job.salary_min && job.salary_max
            ? `$${job.salary_min}-${job.salary_max} ${job.salary_type || ''}`
            : '';

        return [
            job.title || '',
            job.company || '',
            job.location || '',
            job.experience_level || '',
            sectors,
            skills,
            salaryRange,
            job.url || '',
            'N' // Default to "N" (not applied) - users can update manually
        ];
    });

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value) => {
        if (value == null) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    // Build CSV content
    const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`✅ Exported ${jobs.length} jobs to ${filename}`);
}

/**
 * Add a message to the chat
 * @param {string} content - Message content
 * @param {boolean} isUser - Whether the message is from user
 */
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (isUser) {
        contentDiv.textContent = content;
    } else {
        // Parse markdown-like formatting for bot messages
        contentDiv.innerHTML = formatBotMessage(content);
    }

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    scrollToBottom();
}

/**
 * Add jobs table message to chat (same format as resume parser)
 * @param {Array} jobs - Array of job objects
 * @param {number} count - Total number of jobs
 */
function addJobsTableMessage(jobs, count) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Create intro text with export button
    const introText = document.createElement('div');
    introText.style.display = 'flex';
    introText.style.justifyContent = 'space-between';
    introText.style.alignItems = 'center';
    introText.style.marginBottom = '1rem';
    introText.innerHTML = `
        <p style="margin: 0;"><strong>Found ${count} matching climate-tech jobs:</strong></p>
        <button class="export-csv-btn" style="background: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
            Export to CSV
        </button>
    `;
    contentDiv.appendChild(introText);

    // Add click handler for export button
    const exportBtn = introText.querySelector('.export-csv-btn');
    exportBtn.addEventListener('click', () => exportJobsToCSV(jobs));
    exportBtn.addEventListener('mouseover', () => {
        exportBtn.style.background = '#45a049';
    });
    exportBtn.addEventListener('mouseout', () => {
        exportBtn.style.background = '#4CAF50';
    });

    // Create table
    if (jobs.length > 0) {
        const tableHTML = `
            <div style="margin-top: 0.5rem; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr>
                            <th style="background: #2196F3; color: white; padding: 1rem; text-align: left; font-weight: 600;">Position</th>
                            <th style="background: #2196F3; color: white; padding: 1rem; text-align: left; font-weight: 600;">Company</th>
                            <th style="background: #2196F3; color: white; padding: 1rem; text-align: left; font-weight: 600;">Location</th>
                            <th style="background: #2196F3; color: white; padding: 1rem; text-align: left; font-weight: 600;">Match Rank</th>
                            <th style="background: #2196F3; color: white; padding: 1rem; text-align: left; font-weight: 600;">Sector</th>
                            <th style="background: #2196F3; color: white; padding: 1rem; text-align: left; font-weight: 600;">Apply</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${jobs.map((job, index) => `
                            <tr style="border-bottom: 1px solid #eee; transition: background 0.2s;"
                                onmouseover="this.style.background='#f8f9fa'"
                                onmouseout="this.style.background='white'">
                                <td style="padding: 1rem;"><strong>${job.title}</strong></td>
                                <td style="padding: 1rem;">${job.company}</td>
                                <td style="padding: 1rem;">${job.location || 'Remote'}</td>
                                <td style="padding: 1rem;">#${index + 1}</td>
                                <td style="padding: 1rem;">${job.climate_sectors ? job.climate_sectors.slice(0, 2).join(', ') : 'Climate Tech'}</td>
                                <td style="padding: 1rem;"><a href="${job.url}" target="_blank" style="color: #2196F3; text-decoration: none; font-weight: 500;">Apply →</a></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        contentDiv.innerHTML += tableHTML;
    } else {
        contentDiv.innerHTML += '<p>No jobs found matching your criteria. Try broadening your search.</p>';
    }

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    scrollToBottom();
}

/**
 * Format bot message with markdown support including tables
 * @param {string} text - Raw text from API
 * @returns {string} - Formatted HTML
 */
function formatBotMessage(text) {
    // Convert markdown tables to HTML
    text = convertMarkdownTables(text);

    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Convert bullet points
    text = text.replace(/^- (.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Convert numbered lists
    text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Convert URLs to clickable links (but skip if tables are present, as they handle their own URLs)
    if (!text.includes('<table>')) {
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    // Convert line breaks to paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    text = paragraphs.map(p => {
        if (p.includes('<table>') || p.includes('<li>') || p.includes('<ul>') || p.includes('<strong>')) {
            return p;
        }
        return `<p>${p}</p>`;
    }).join('');

    return text;
}

/**
 * Convert markdown tables to HTML tables
 * @param {string} text - Text containing markdown tables
 * @returns {string} - Text with HTML tables
 */
function convertMarkdownTables(text) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if line is a table row (contains pipes)
        if (line.includes('|') && line.split('|').filter(c => c.trim()).length > 1) {
            if (!inTable) {
                inTable = true;
                tableRows = [];
            }
            tableRows.push(line);
        } else {
            // End of table
            if (inTable && tableRows.length > 0) {
                result.push(buildHtmlTable(tableRows));
                tableRows = [];
                inTable = false;
            }
            result.push(line);
        }
    }

    // Handle table at end of text
    if (inTable && tableRows.length > 0) {
        result.push(buildHtmlTable(tableRows));
    }

    return result.join('\n');
}

/**
 * Build HTML table from markdown table rows
 * @param {Array<string>} rows - Array of markdown table rows
 * @returns {string} - HTML table
 */
function buildHtmlTable(rows) {
    if (rows.length < 2) return rows.join('\n');

    let html = '<div class="table-container"><table class="job-table">';

    // Process rows
    let headerRow = null;
    let dataRows = [];

    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].split('|').map(c => c.trim()).filter(c => c);

        // Skip separator row (--- | --- | ---)
        if (cells.every(c => /^-+$/.test(c))) {
            continue;
        }

        if (!headerRow) {
            // First row is header
            headerRow = cells;
        } else {
            dataRows.push(cells);
        }
    }

    // Build header
    if (headerRow) {
        html += '<thead><tr>';
        headerRow.forEach(cell => {
            html += `<th>${cell}</th>`;
        });
        html += '</tr></thead>';
    }

    // Build body
    if (dataRows.length > 0) {
        html += '<tbody>';
        dataRows.forEach(row => {
            html += '<tr>';
            row.forEach((cell, index) => {
                // Make the last column (APPLY) special if it contains a URL
                if (index === row.length - 1 && cell.trim().startsWith('http')) {
                    // Clean URL by removing trailing punctuation, quotes, and whitespace
                    const url = cell.trim().replace(/[,;'")\]}\s]+$/, '');
                    console.log('Creating apply link for URL:', url);
                    html += `<td class="apply-cell"><a href="${url}" target="_blank" rel="noopener noreferrer" onclick="window.open('${url}', '_blank'); return false;" class="apply-link">Apply →</a></td>`;
                } else {
                    html += `<td>${cell}</td>`;
                }
            });
            html += '</tr>';
        });
        html += '</tbody>';
    }

    html += '</table></div>';
    return html;
}

/**
 * Show typing indicator with timer
 */
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typing-indicator';

    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'typing-indicator';
    indicatorDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

    const timerDiv = document.createElement('div');
    timerDiv.id = 'response-timer';
    timerDiv.style.cssText = 'font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem; font-family: monospace;';
    timerDiv.textContent = 'Thinking... 0s';

    typingDiv.appendChild(indicatorDiv);
    typingDiv.appendChild(timerDiv);
    chatMessages.appendChild(typingDiv);
    scrollToBottom();

    // Start timer
    responseStartTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - responseStartTime) / 1000);
        const timerElement = document.getElementById('response-timer');
        if (timerElement) {
            timerElement.textContent = `Thinking... ${elapsed}s`;
        }
    }, 1000);
}

/**
 * Remove typing indicator and show final response time
 */
function removeTypingIndicator() {
    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Calculate final response time
    const responseTime = responseStartTime ? ((Date.now() - responseStartTime) / 1000).toFixed(2) : null;

    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }

    // Log response time
    if (responseTime) {
        console.log(`⏱️ Response time: ${responseTime}s`);
    }
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Set loading state
 * @param {boolean} isLoading - Whether to show loading state
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        sendButton.disabled = true;
        userInput.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');
    } else {
        sendButton.disabled = false;
        userInput.disabled = false;
        buttonText.classList.remove('hidden');
        buttonLoader.classList.add('hidden');
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `⚠️ ${message}`;
    chatMessages.appendChild(errorDiv);
    scrollToBottom();
}

/**
 * Send message to API
 * @param {string} message - User's message
 */
async function sendMessage(message) {
    // Add user message to chat
    addMessage(message, true);

    // Clear input
    userInput.value = '';

    // Show loading state
    setLoadingState(true);
    showTypingIndicator();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get response from server');
        }

        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator();

        // Check response type and display accordingly
        if (data.type === 'jobs') {
            // Display jobs in table format
            addJobsTableMessage(data.jobs, data.count);
        } else {
            // Display normal text response
            addMessage(data.response, false);
        }

        // Log metadata for debugging
        if (data.metadata) {
            console.log('Keywords detected:', data.metadata.keywords);
            console.log('Sectors referenced:', data.metadata.sectorsReferenced);
        }

    } catch (error) {
        console.error('Error sending message:', error);
        removeTypingIndicator();
        showError(error.message || 'Failed to connect to the server. Please try again.');
    } finally {
        setLoadingState(false);
        userInput.focus();
    }
}

/**
 * Handle form submission
 */
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const message = userInput.value.trim();

    if (message.length === 0) {
        return;
    }

    sendMessage(message);
});

/**
 * Handle suggestion chip clicks
 */
suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query) {
            userInput.value = query;
            sendMessage(query);
        }
    });
});

/**
 * Handle Enter key for sending (Shift+Enter for new line)
 */
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

/**
 * Initialize - Focus input on load
 */
window.addEventListener('load', () => {
    userInput.focus();
    console.log('🌍 Climate-Tech Chatbot initialized');
});

/**
 * Handle API health check on startup
 */
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('✅ Server health:', data);
    } catch (error) {
        console.error('❌ Server health check failed:', error);
        showError('Unable to connect to the server. Please ensure the server is running.');
    }
}

// Run health check
checkHealth();

/**
 * Smooth scroll for navigation links
 */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

/**
 * Handle major dropdown and explore button
 */
const majorDropdown = document.getElementById('major-dropdown');
const exploreMajorBtn = document.getElementById('explore-major-btn');

if (majorDropdown && exploreMajorBtn) {
    // Initially disable the button
    exploreMajorBtn.disabled = true;

    // Enable button when a major is selected
    majorDropdown.addEventListener('change', function() {
        if (this.value) {
            exploreMajorBtn.disabled = false;
            exploreMajorBtn.textContent = 'Explore Jobs →';
        } else {
            exploreMajorBtn.disabled = true;
            exploreMajorBtn.textContent = 'Select a Major First';
        }
    });

    // Fetch and display jobs for selected major
    exploreMajorBtn.addEventListener('click', async function() {
        const selectedOption = majorDropdown.options[majorDropdown.selectedIndex];
        if (!selectedOption || !selectedOption.value) return;

        // Extract major name from option text (remove emoji)
        const majorText = selectedOption.text.replace(/^[^\s]+\s/, '').trim();

        console.log('Fetching jobs for major:', majorText);

        // Show loading state
        exploreMajorBtn.disabled = true;
        exploreMajorBtn.textContent = 'Loading Jobs...';

        try {
            const response = await fetch('/api/major-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ major: majorText })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch jobs');
            }

            console.log(`Received ${data.count} jobs for major: ${data.major}`);

            // Display the jobs
            displayMajorJobs(data.major, data.jobs);

        } catch (error) {
            console.error('Error fetching major jobs:', error);
            alert('Failed to fetch jobs: ' + error.message);
        } finally {
            exploreMajorBtn.disabled = false;
            exploreMajorBtn.textContent = 'Explore Jobs →';
        }
    });

    // Also allow Enter key to fetch jobs
    majorDropdown.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value) {
            exploreMajorBtn.click();
        }
    });
}

/**
 * Handle climate category dropdown and job display
 */
const categoryDropdown = document.getElementById('category-dropdown');
const showCategoryJobsBtn = document.getElementById('show-category-jobs-btn');
const categoryJobsResults = document.getElementById('category-jobs-results');
const resultsTitle = document.getElementById('results-title');
const resultsCount = document.getElementById('results-count');
const jobsTableContainer = document.getElementById('jobs-table-container');

if (categoryDropdown && showCategoryJobsBtn) {
    // Initially disable the button
    showCategoryJobsBtn.disabled = true;

    // Enable button when a category is selected
    categoryDropdown.addEventListener('change', function() {
        if (this.value) {
            showCategoryJobsBtn.disabled = false;
            showCategoryJobsBtn.textContent = 'Show Jobs →';
        } else {
            showCategoryJobsBtn.disabled = true;
            showCategoryJobsBtn.textContent = 'Select a Category First';
            categoryJobsResults.style.display = 'none';
        }
    });

    // Show jobs for selected category
    showCategoryJobsBtn.addEventListener('click', async function() {
        const selectedCategory = categoryDropdown.value;
        if (!selectedCategory) return;

        // Show loading state
        showCategoryJobsBtn.disabled = true;
        showCategoryJobsBtn.textContent = 'Loading Jobs...';

        try {
            // Use the new category-jobs API endpoint
            const response = await fetch('/api/category-jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ category: selectedCategory }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch jobs');
            }

            const data = await response.json();
            console.log('Category jobs received:', data.count);

            // Display the jobs using the same table format as resume parser
            displayCategoryJobs(selectedCategory, data.jobs);
        } catch (error) {
            console.error('Error loading category jobs:', error);
            showError('Failed to load jobs. Please try again.');
        } finally {
            // Re-enable button
            showCategoryJobsBtn.disabled = false;
            showCategoryJobsBtn.textContent = 'Show Jobs →';
        }
    });
}

/**
 * Display jobs for selected category using table format (same as resume parser)
 */
function displayCategoryJobs(category, jobs) {
    // Extract category parts for display
    const parts = category.split(' > ');
    const sector = parts[0];
    const subcategory = parts.slice(1).join(' > ');

    // Update header
    currentCategoryJobs = jobs; // Store for CSV export

    resultsTitle.textContent = `${sector}: ${subcategory}`;
    resultsCount.innerHTML = `
        Found ${jobs.length} relevant positions in this category
        ${jobs.length > 0 ? `<button id="export-category-jobs-btn" style="background: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; margin-left: 1rem; transition: background 0.3s ease;">Export to CSV</button>` : ''}
    `;

    // Add export button event listener
    if (jobs.length > 0) {
        setTimeout(() => {
            const exportBtn = document.getElementById('export-category-jobs-btn');
            if (exportBtn) {
                exportBtn.addEventListener('mouseover', function() {
                    this.style.background = '#45a049';
                });
                exportBtn.addEventListener('mouseout', function() {
                    this.style.background = '#4CAF50';
                });
                exportBtn.addEventListener('click', function() {
                    exportJobsToCSV(currentCategoryJobs);
                });
            }
        }, 0);
    }

    // Display jobs in table format (same as resume parser)
    if (jobs.length > 0) {
        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Company</th>
                        <th>Location</th>
                        <th>Match Rank</th>
                        <th>Category Match</th>
                        <th>Apply</th>
                    </tr>
                </thead>
                <tbody>
                    ${jobs.map((job, index) => `
                        <tr>
                            <td><strong>${job.title}</strong></td>
                            <td>${job.company}</td>
                            <td>${job.location || 'Remote'}</td>
                            <td>#${index + 1}</td>
                            <td>${job.matched_categories ? job.matched_categories.slice(0, 2).join(', ') : category}</td>
                            <td><a href="${job.url}" target="_blank">Apply →</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        jobsTableContainer.innerHTML = tableHTML;
    } else {
        jobsTableContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">No jobs found for this category. Try selecting a different category.</p>';
    }

    // Show results section
    categoryJobsResults.style.display = 'block';

    // Scroll to results
    categoryJobsResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Display jobs for selected major using table format
 */
function displayMajorJobs(major, jobs) {
    // Get the results elements
    const majorJobsResults = document.getElementById('major-jobs-results');
    const majorResultsTitle = document.getElementById('major-results-title');
    const majorResultsCount = document.getElementById('major-results-count');
    const majorJobsTableContainer = document.getElementById('major-jobs-table-container');

    // Store ALL jobs for CSV export
    let currentMajorJobs = jobs;

    // Limit displayed jobs to 20
    const displayLimit = 20;
    const jobsToDisplay = jobs.slice(0, displayLimit);
    const hasMoreJobs = jobs.length > displayLimit;

    // Update header
    majorResultsTitle.textContent = `Jobs for ${major} Majors`;

    // Show count with info about displayed vs total
    const countText = hasMoreJobs
        ? `Showing ${displayLimit} of ${jobs.length} jobs for ${major}`
        : `Found ${jobs.length} relevant positions for ${major}`;

    majorResultsCount.innerHTML = `
        ${countText}
        ${jobs.length > 0 ? `<button id="export-major-jobs-btn" style="background: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; margin-left: 1rem; transition: background 0.3s ease;">Export ${hasMoreJobs ? 'All ' + jobs.length : ''} to CSV</button>` : ''}
        ${hasMoreJobs ? `<br/><small style="color: #666; font-size: 0.875rem;">Export to CSV to view all ${jobs.length} jobs</small>` : ''}
    `;

    // Add export button event listener (exports ALL jobs, not just displayed)
    if (jobs.length > 0) {
        setTimeout(() => {
            const exportBtn = document.getElementById('export-major-jobs-btn');
            if (exportBtn) {
                exportBtn.addEventListener('mouseover', function() {
                    this.style.background = '#45a049';
                });
                exportBtn.addEventListener('mouseout', function() {
                    this.style.background = '#4CAF50';
                });
                exportBtn.addEventListener('click', function() {
                    exportJobsToCSV(currentMajorJobs); // Export ALL jobs
                });
            }
        }, 0);
    }

    // Display jobs in table format (matching resume parser style) - LIMITED to 20
    if (jobsToDisplay.length > 0) {
        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Company</th>
                        <th>Location</th>
                        <th>Match Rank</th>
                        <th>Experience Level</th>
                        <th>Apply</th>
                    </tr>
                </thead>
                <tbody>
                    ${jobsToDisplay.map((job, index) => `
                        <tr>
                            <td><strong>${job.title}</strong></td>
                            <td>${job.company}</td>
                            <td>${job.location || 'Remote'}</td>
                            <td>#${index + 1}</td>
                            <td>${job.experience_level || 'Not specified'}</td>
                            <td><a href="${job.url}" target="_blank">Apply →</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        majorJobsTableContainer.innerHTML = tableHTML;
    } else {
        majorJobsTableContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">No jobs found for this major. Try selecting a different major or check back later for new opportunities.</p>';
    }

    // Show results section
    majorJobsResults.style.display = 'block';

    // Scroll to results
    majorJobsResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================================
// Resume Upload Functionality
// ============================================================================

const resumeFileInput = document.getElementById('resume-file-input');
const browseResumeBtn = document.getElementById('browse-resume-btn');
const fileNameDisplay = document.getElementById('file-name-display');
const selectedFileName = document.getElementById('selected-file-name');
const uploadResumeBtn = document.getElementById('upload-resume-btn');
const uploadProgress = document.getElementById('upload-progress');
const resumeResults = document.getElementById('resume-results');
const resumeProfile = document.getElementById('resume-profile');
const resumeJobsCount = document.getElementById('resume-jobs-count');
const resumeJobsTable = document.getElementById('resume-jobs-table');
const resumePreferences = document.getElementById('resume-preferences');
const applyPreferencesBtn = document.getElementById('apply-preferences-btn');
const resetResumeBtn = document.getElementById('reset-resume-btn');

// Store parsed resume data
let parsedResumeData = null;

// Open file browser when button clicked
browseResumeBtn.addEventListener('click', () => {
    resumeFileInput.click();
});

// Handle file selection
resumeFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Validate file type
        const validTypes = ['application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a PDF file');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        selectedFileName.textContent = file.name;
        fileNameDisplay.style.display = 'block';
        resumeResults.style.display = 'none';
    }
});

// Handle resume upload and analysis
uploadResumeBtn.addEventListener('click', async () => {
    const file = resumeFileInput.files[0];
    if (!file) return;

    // Show loading state
    fileNameDisplay.style.display = 'none';
    uploadProgress.style.display = 'block';
    resumeResults.style.display = 'none';

    try {
        // Create FormData and upload file
        const formData = new FormData();
        formData.append('resume', file);

        console.log('Uploading resume:', file.name);

        const response = await fetch('/api/upload-resume', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            // Show specific error message from server
            const errorMsg = data.error || response.statusText;
            const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
            throw new Error(errorMsg + errorDetails);
        }

        console.log('Resume analysis successful:', data);

        // Store parsed resume data (all jobs from initial match)
        parsedResumeData = data;

        // Hide loading, show results immediately
        uploadProgress.style.display = 'none';

        // Display initial job matches
        displayResumeResults(data);

        // Show preferences below results for filtering
        resumePreferences.style.display = 'block';

        // Scroll to results
        resumeResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('Error uploading resume:', error);
        uploadProgress.style.display = 'none';
        fileNameDisplay.style.display = 'block';

        // Show detailed error message
        const errorMessage = error.message || 'Failed to analyze resume. Please try again.';
        alert(`Resume Analysis Failed\n\n${errorMessage}\n\nPlease ensure your resume is a valid PDF with readable text (not a scanned image).`);
    }
});

// Handle preference application - filter existing jobs client-side
applyPreferencesBtn.addEventListener('click', () => {
    if (!parsedResumeData || !parsedResumeData.jobs) {
        alert('Please upload a resume first');
        return;
    }

    // Get selected sectors
    const sectorCheckboxes = document.querySelectorAll('input[name="sector-interest"]:checked');
    const selectedSectors = Array.from(sectorCheckboxes).map(cb => cb.value.toLowerCase());

    // Get risk appetite
    const riskAppetite = document.getElementById('risk-appetite').value;

    // Get years of experience
    const yearsExperience = document.getElementById('years-experience').value;

    console.log('Filtering jobs with preferences:', { selectedSectors, riskAppetite, yearsExperience });

    // Show loading state
    applyPreferencesBtn.disabled = true;
    applyPreferencesBtn.textContent = 'Filtering Jobs...';

    // Get original jobs from the initial match
    const allJobs = parsedResumeData.jobs;

    // Filter by sector if any selected
    let filteredJobs = allJobs;
    if (selectedSectors.length > 0) {
        filteredJobs = allJobs.filter(job => {
            const jobSectors = (job.climate_categories || []).map(c => c.split(' > ')[0].toLowerCase());
            return selectedSectors.some(sector => jobSectors.includes(sector));
        });
    }

    // Filter by years of experience if selected
    if (yearsExperience) {
        filteredJobs = filteredJobs.filter(job => {
            const experienceLevel = (job.experience_level || '').toLowerCase();

            // Map years of experience to job levels
            if (yearsExperience === '0-3') {
                // Intern/Junior: entry-level, intern, junior
                return experienceLevel.includes('intern') ||
                       experienceLevel.includes('junior') ||
                       experienceLevel.includes('entry') ||
                       experienceLevel.includes('entry-level');
            } else if (yearsExperience === '3-5') {
                // Junior/Mid-Level: mid-level, intermediate, mid, associate
                return experienceLevel.includes('junior') ||
                       experienceLevel.includes('mid') ||
                       experienceLevel.includes('intermediate') ||
                       experienceLevel.includes('associate');
            } else if (yearsExperience === '5-7') {
                // Senior: senior, senior-level
                return experienceLevel.includes('senior') &&
                       !experienceLevel.includes('director') &&
                       !experienceLevel.includes('vp') &&
                       !experienceLevel.includes('c-suite');
            } else if (yearsExperience === '7+') {
                // C-Suite/Leadership: director, vp, c-suite, executive, principal, head, lead (with manager context)
                return experienceLevel.includes('director') ||
                       experienceLevel.includes('vp') ||
                       experienceLevel.includes('vice president') ||
                       experienceLevel.includes('c-suite') ||
                       experienceLevel.includes('executive') ||
                       experienceLevel.includes('principal') ||
                       experienceLevel.includes('head of') ||
                       experienceLevel.includes('chief') ||
                       (experienceLevel.includes('lead') && experienceLevel.includes('manager'));
            }

            return false;
        });
    }

    // Apply risk appetite scoring bonus
    if (riskAppetite) {
        filteredJobs = filteredJobs.map(job => {
            let riskBonus = 0;
            const companyStage = (job.company_stage || '').toLowerCase();
            const tags = (job.tags || []).map(t => t.toLowerCase());

            if (riskAppetite === 'moonshot') {
                // Prefer early-stage, innovative companies
                if (companyStage.includes('seed') || companyStage.includes('series a') ||
                    tags.includes('moonshot') || tags.includes('deep tech') ||
                    tags.includes('r&d') || tags.includes('lab')) {
                    riskBonus = 10;
                }
            } else if (riskAppetite === 'essential') {
                // Prefer growth-stage companies
                if (companyStage.includes('series b') || companyStage.includes('series c') ||
                    companyStage.includes('growth') || tags.includes('scaling')) {
                    riskBonus = 10;
                }
            } else if (riskAppetite === 'established') {
                // Prefer mature companies
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

        // Re-sort by updated scores
        filteredJobs.sort((a, b) => b.match_score - a.match_score);
    }

    console.log(`Filtered to ${filteredJobs.length} jobs from ${allJobs.length} total`);

    // Update display with filtered jobs
    const filteredData = {
        profile: parsedResumeData.profile,
        jobs: filteredJobs
    };

    displayResumeResults(filteredData);

    // Re-enable button
    applyPreferencesBtn.disabled = false;
    applyPreferencesBtn.textContent = 'Apply Preferences & Filter Jobs';

    // Scroll to results
    resumeResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// Handle preference reset - clear all filters and show original results
const resetPreferencesBtn = document.getElementById('reset-preferences-btn');
resetPreferencesBtn.addEventListener('click', () => {
    if (!parsedResumeData || !parsedResumeData.jobs) {
        alert('Please upload a resume first');
        return;
    }

    // Reset all sector checkboxes
    const sectorCheckboxes = document.querySelectorAll('input[name="sector-interest"]');
    sectorCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });

    // Reset risk appetite dropdown
    document.getElementById('risk-appetite').value = '';

    // Reset years of experience dropdown
    document.getElementById('years-experience').value = '';

    // Show loading state
    resetPreferencesBtn.disabled = true;
    resetPreferencesBtn.textContent = 'Resetting...';

    // Display original unfiltered results
    displayResumeResults(parsedResumeData);

    // Re-enable button
    resetPreferencesBtn.disabled = false;
    resetPreferencesBtn.textContent = 'Reset Filters';

    // Scroll to results
    resumeResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// Handle resume reset - clear everything and return to upload state
resetResumeBtn.addEventListener('click', () => {
    // Clear the file input
    resumeFileInput.value = '';

    // Hide all results and preferences sections
    resumeResults.style.display = 'none';
    resumePreferences.style.display = 'none';
    fileNameDisplay.style.display = 'none';
    uploadProgress.style.display = 'none';

    // Hide bubble diagram
    const bubbleDiagram = document.getElementById('resume-bubble-diagram');
    if (bubbleDiagram) bubbleDiagram.style.display = 'none';

    // Clear the displayed data
    resumeProfile.innerHTML = '';
    resumeJobsTable.innerHTML = '';
    resumeJobsCount.textContent = '';
    selectedFileName.textContent = '';

    // Reset parsed data
    parsedResumeData = null;
    currentResumeJobs = [];

    // Reset all preference filters
    const sectorCheckboxes = document.querySelectorAll('input[name="sector-interest"]');
    sectorCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('risk-appetite').value = '';
    document.getElementById('years-experience').value = '';

    // Scroll back to upload box
    const uploadSection = document.getElementById('resume-upload');
    uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Sector color mapping for bubble diagram
const sectorColors = {
    'ghg removal': '#9B59B6',
    'ghg': '#9B59B6',
    'carbon removal': '#9B59B6',
    'transportation': '#27AE60',
    'transport': '#27AE60',
    'electricity': '#E67E22',
    'energy': '#E67E22',
    'manufacturing': '#E74C3C',
    'buildings': '#3498DB',
    'building': '#3498DB',
    'food': '#1ABC9C',
    'agriculture': '#1ABC9C',
    'nature': '#1ABC9C'
};

const sectorLegend = [
    { label: 'GHG Removal', color: '#9B59B6' },
    { label: 'Transportation', color: '#27AE60' },
    { label: 'Electricity', color: '#E67E22' },
    { label: 'Manufacturing', color: '#E74C3C' },
    { label: 'Buildings', color: '#3498DB' },
    { label: 'Food, Agriculture & Nature', color: '#1ABC9C' }
];

/**
 * Determine which of the 6 sectors a job belongs to
 */
function getJobSectorName(job) {
    const categories = job.climate_categories || job.climate_sectors || [];
    const catString = (Array.isArray(categories) ? categories.join(' ') : String(categories)).toLowerCase();

    if (catString.includes('ghg') || catString.includes('removal') || catString.includes('carbon removal') || catString.includes('direct air capture') || catString.includes('sequestration')) return 'GHG Removal';
    if (catString.includes('transportation') || catString.includes('transport') || catString.includes('vehicle') || catString.includes('ev ') || catString.includes('mobility')) return 'Transportation';
    if (catString.includes('electricity') || catString.includes('solar') || catString.includes('wind') || catString.includes('grid') || catString.includes('energy storage') || catString.includes('nuclear')) return 'Electricity';
    if (catString.includes('manufacturing') || catString.includes('steel') || catString.includes('cement') || catString.includes('hydrogen') || catString.includes('industrial') || catString.includes('mining') || catString.includes('recycling') || catString.includes('textile')) return 'Manufacturing';
    if (catString.includes('building') || catString.includes('hvac') || catString.includes('heat pump') || catString.includes('retrofit')) return 'Buildings';
    if (catString.includes('food') || catString.includes('agriculture') || catString.includes('nature') || catString.includes('reforest') || catString.includes('crop') || catString.includes('ecosystem')) return 'Food, Agriculture & Nature';

    // Fallback: try title
    const title = (job.title || '').toLowerCase();
    if (title.includes('carbon') || title.includes('removal') || title.includes('dac')) return 'GHG Removal';
    if (title.includes('transport') || title.includes('ev ') || title.includes('battery') || title.includes('vehicle')) return 'Transportation';
    if (title.includes('energy') || title.includes('solar') || title.includes('wind') || title.includes('grid') || title.includes('power')) return 'Electricity';
    if (title.includes('manufactur') || title.includes('steel') || title.includes('hydrogen') || title.includes('industrial')) return 'Manufacturing';
    if (title.includes('building') || title.includes('hvac') || title.includes('retrofit')) return 'Buildings';
    if (title.includes('farm') || title.includes('agri') || title.includes('food') || title.includes('forest')) return 'Food, Agriculture & Nature';

    return 'Electricity'; // default fallback
}

/**
 * Draw the spider diagram visualization
 */
function drawBubbleDiagram(jobs) {
    const container = document.getElementById('resume-bubble-diagram');
    const canvas = document.getElementById('bubble-canvas');
    const legendDiv = document.getElementById('bubble-legend');

    if (!canvas || !jobs || jobs.length === 0) {
        if (container) container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = 800;
    const height = 700;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 80;
    const minRadius = 70;
    const totalJobs = jobs.length;

    // Spider axes - 6 sectors
    const axes = [
        { name: 'GHG Removal', color: '#9B59B6', angle: -Math.PI / 2 },
        { name: 'Transportation', color: '#27AE60', angle: -Math.PI / 2 + (Math.PI / 3) },
        { name: 'Electricity', color: '#E67E22', angle: -Math.PI / 2 + (2 * Math.PI / 3) },
        { name: 'Manufacturing', color: '#E74C3C', angle: -Math.PI / 2 + Math.PI },
        { name: 'Buildings', color: '#3498DB', angle: -Math.PI / 2 + (4 * Math.PI / 3) },
        { name: 'Food, Agriculture & Nature', color: '#1ABC9C', angle: -Math.PI / 2 + (5 * Math.PI / 3) }
    ];

    // Draw concentric web rings
    const ringCount = 4;
    for (let r = 1; r <= ringCount; r++) {
        const ringRadius = minRadius + ((r / ringCount) * (maxRadius - minRadius));
        ctx.beginPath();
        for (let i = 0; i <= axes.length; i++) {
            const ax = axes[i % axes.length];
            const x = centerX + ringRadius * Math.cos(ax.angle);
            const y = centerY + ringRadius * Math.sin(ax.angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(200, 200, 210, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw axes lines and labels
    axes.forEach(ax => {
        const endX = centerX + (maxRadius + 10) * Math.cos(ax.angle);
        const endY = centerY + (maxRadius + 10) * Math.sin(ax.angle);

        // Axis line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = ax.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Axis label
        const labelDist = maxRadius + 35;
        const labelX = centerX + labelDist * Math.cos(ax.angle);
        const labelY = centerY + labelDist * Math.sin(ax.angle);

        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background pill for label
        const labelText = ax.name === 'Food, Agriculture & Nature' ? 'Food & Ag' : ax.name;
        const metrics = ctx.measureText(labelText);
        ctx.fillStyle = ax.color;
        const pillW = metrics.width + 14;
        const pillH = 20;
        const pillX = labelX - pillW / 2;
        const pillY = labelY - pillH / 2;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 10);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.fillText(labelText, labelX, labelY);
    });

    // Group jobs by sector
    const jobsBySector = {};
    axes.forEach(ax => { jobsBySector[ax.name] = []; });
    jobs.forEach((job, index) => {
        const sectorName = getJobSectorName(job);
        if (jobsBySector[sectorName]) {
            jobsBySector[sectorName].push({ job, globalRank: index + 1 });
        } else {
            jobsBySector['Electricity'].push({ job, globalRank: index + 1 });
        }
    });

    // Draw job bubbles along their sector axis
    const bubblePositions = [];

    axes.forEach(ax => {
        const sectorJobs = jobsBySector[ax.name];
        if (sectorJobs.length === 0) return;

        // Sort by global rank so best matches are closest to center
        sectorJobs.sort((a, b) => a.globalRank - b.globalRank);

        sectorJobs.forEach((sj, idx) => {
            // Distance: closer rank = closer to center
            const distance = minRadius + ((sj.globalRank / totalJobs) * (maxRadius - minRadius));

            // Perpendicular offset to spread jobs on same axis
            const perpAngle = ax.angle + Math.PI / 2;
            const spread = (idx % 2 === 0 ? 1 : -1) * (Math.ceil(idx / 2)) * 18;

            const x = centerX + distance * Math.cos(ax.angle) + spread * Math.cos(perpAngle);
            const y = centerY + distance * Math.sin(ax.angle) + spread * Math.sin(perpAngle);

            const bubbleRadius = Math.max(10, 20 - (sj.globalRank * 0.4));

            // Connecting line from center to bubble
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(180, 180, 190, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Shadow
            ctx.beginPath();
            ctx.arc(x + 1.5, y + 1.5, bubbleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fill();

            // Bubble
            ctx.beginPath();
            ctx.arc(x, y, bubbleRadius, 0, Math.PI * 2);
            ctx.fillStyle = ax.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Rank number
            ctx.font = 'bold 10px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.fillText(`#${sj.globalRank}`, x, y);

            bubblePositions.push({ x, y, radius: bubbleRadius, job: sj.job, rank: sj.globalRank });
        });
    });

    // Draw center resume emoji (no bubble)
    ctx.font = '36px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F4BC}', centerX, centerY);

    // Draw legend
    legendDiv.innerHTML = sectorLegend.map(item =>
        `<span style="display: inline-flex; align-items: center; gap: 0.4rem;">
            <span style="width: 14px; height: 14px; border-radius: 50%; background: ${item.color}; display: inline-block; border: 1px solid rgba(0,0,0,0.1);"></span>
            ${item.label}
        </span>`
    ).join('');

    // Tooltip on hover
    canvas.onmousemove = function(e) {
        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = width / canvasRect.width;
        const scaleY = height / canvasRect.height;
        const mouseX = (e.clientX - canvasRect.left) * scaleX;
        const mouseY = (e.clientY - canvasRect.top) * scaleY;

        let hovering = false;
        for (const bp of bubblePositions) {
            const dx = mouseX - bp.x;
            const dy = mouseY - bp.y;
            if (dx * dx + dy * dy <= bp.radius * bp.radius) {
                canvas.style.cursor = 'pointer';
                canvas.title = `#${bp.rank}: ${bp.job.title} at ${bp.job.company}\n${bp.job.location || 'Remote'}\nSector: ${getJobSectorName(bp.job)}`;
                hovering = true;
                break;
            }
        }
        if (!hovering) {
            canvas.style.cursor = 'default';
            canvas.title = '';
        }
    };

    // Click to open job URL
    canvas.onclick = function(e) {
        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = width / canvasRect.width;
        const scaleY = height / canvasRect.height;
        const mouseX = (e.clientX - canvasRect.left) * scaleX;
        const mouseY = (e.clientY - canvasRect.top) * scaleY;

        for (const bp of bubblePositions) {
            const dx = mouseX - bp.x;
            const dy = mouseY - bp.y;
            if (dx * dx + dy * dy <= bp.radius * bp.radius) {
                if (bp.job.url) {
                    window.open(bp.job.url, '_blank');
                }
                break;
            }
        }
    };
}

// Display resume analysis results
function displayResumeResults(data) {
    // Display profile information
    const profile = data.profile;
    resumeProfile.innerHTML = `
        <p><strong>Name:</strong> ${profile.name || 'Not provided'}</p>
        <p><strong>Email:</strong> ${profile.email || 'Not provided'}</p>
        <p><strong>Experience Level:</strong> ${profile.engineer_level || 'Unknown'}</p>
        <p><strong>Student:</strong> ${profile.is_student ? 'Yes' : 'No'}</p>
        <p><strong>Pivoting to Climate-Tech:</strong> ${profile.is_pivoting_into_climate_tech ? 'Yes' : 'No'}</p>
        ${profile.skills && profile.skills.length > 0 ? `<p><strong>Skills:</strong> ${profile.skills.slice(0, 10).join(', ')}${profile.skills.length > 10 ? '...' : ''}</p>` : ''}
        ${profile.areas_of_interest && profile.areas_of_interest.length > 0 ? `<p><strong>Areas of Interest:</strong> ${profile.areas_of_interest.join(', ')}</p>` : ''}
    `;

    // Display matched jobs
    const jobs = data.jobs || [];
    currentResumeJobs = jobs; // Store for CSV export

    resumeJobsCount.innerHTML = `
        Found ${jobs.length} relevant positions matching your profile
        ${jobs.length > 0 ? `<button id="export-resume-jobs-btn" style="background: #4CAF50; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; margin-left: 1rem; transition: background 0.3s ease;">Export to CSV</button>` : ''}
    `;

    // Add export button event listener
    if (jobs.length > 0) {
        setTimeout(() => {
            const exportBtn = document.getElementById('export-resume-jobs-btn');
            if (exportBtn) {
                exportBtn.addEventListener('mouseover', function() {
                    this.style.background = '#45a049';
                });
                exportBtn.addEventListener('mouseout', function() {
                    this.style.background = '#4CAF50';
                });
                exportBtn.addEventListener('click', function() {
                    exportJobsToCSV(currentResumeJobs);
                });
            }
        }, 0);
    }

    if (jobs.length > 0) {
        const tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Position</th>
                        <th>Company</th>
                        <th>Location</th>
                        <th>Match Rank</th>
                        <th>Skills Match</th>
                        <th>Apply</th>
                    </tr>
                </thead>
                <tbody>
                    ${jobs.map((job, index) => `
                        <tr>
                            <td><strong>${job.title}</strong></td>
                            <td>${job.company}</td>
                            <td>${job.location || 'Remote'}</td>
                            <td>#${index + 1}</td>
                            <td>${job.matched_skills ? job.matched_skills.slice(0, 3).join(', ') : 'Multiple'}</td>
                            <td><a href="${job.url}" target="_blank">Apply →</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        resumeJobsTable.innerHTML = tableHTML;
    } else {
        resumeJobsTable.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">No matching jobs found. Try broadening your skills or areas of interest.</p>';
    }

    resumeResults.style.display = 'block';

    // Draw bubble diagram
    drawBubbleDiagram(jobs);

    // Smooth scroll to results
    resumeResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Drag and drop functionality (optional enhancement)
const uploadBox = document.querySelector('.upload-box');

uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = '#2196F3';
    uploadBox.style.background = '#f0f8ff';
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.style.borderColor = '#ddd';
    uploadBox.style.background = 'white';
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = '#ddd';
    uploadBox.style.background = 'white';

    const file = e.dataTransfer.files[0];
    if (file) {
        // Set the file to the input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        resumeFileInput.files = dataTransfer.files;

        // Trigger change event
        const event = new Event('change', { bubbles: true });
        resumeFileInput.dispatchEvent(event);
    }
});
