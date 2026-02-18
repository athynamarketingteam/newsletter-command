/**
 * Export dashboard_metrics_reference as a branded PDF.
 * 
 * 1. Pre-renders Mermaid diagrams to SVG using @mermaid-js/mermaid-cli
 * 2. Injects inline SVGs into the HTML template
 * 3. Uses Playwright to generate the final PDF
 * 
 * Usage:  node scripts/export-metrics-pdf.js
 * Output: dashboard_metrics_reference.pdf in project root
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Mermaid diagram definitions ──────────────────────────────────────────────
const MERMAID_DIAGRAMS = [
    // Diagram 0: Data flow overview
    `flowchart LR
    A["Beehiiv Analytics"] -->|"Export XLSX"| B["Upload Excel file (3 tabs)"]
    A -->|"Click Sync"| C["Live API connection"]
    B --> D["Our Dashboard"]
    C --> D`,

    // Diagram 1: Open Rate
    `flowchart LR
    A["Total Unique Opens (all emails combined)"] -->|divide| B["Total Delivered (all emails combined)"]
    B -->|x 100| C["Open Rate %"]`,

    // Diagram 2: CTR
    `flowchart LR
    A["Total Unique Clicks (all emails)"] -->|divide| B["Total Unique Opens (all emails)"]
    B -->|x 100| C["CTR %"]`,

    // Diagram 3: Delivery Rate
    `flowchart LR
    A["Total Delivered (all emails)"] -->|divide| B["Total Sent (all emails)"]
    B -->|x 100| C["Delivery Rate %"]`,

    // Diagram 4: Delta badges
    `flowchart TD
    A["All emails in selected period"] -->|Sort by date| B["Split in half"]
    B --> C["First Half (older emails)"]
    B --> D["Second Half (newer emails)"]
    C --> E["Calculate rate/sum for this half"]
    D --> F["Calculate rate/sum for this half"]
    E --> G["Compare: Second Half vs First Half"]
    F --> G
    G --> H["Green if improving / Red if declining"]`,

    // Diagram 5: Growth chart
    `flowchart LR
    A["Green bars = New subscribers per month"] --- B["Red bars = Unsubscribes per month"]
    B --- C["Dashed line = Net growth (new minus lost)"]`
];

async function renderMermaidDiagrams() {
    const tmpDir = path.join(os.tmpdir(), 'mermaid-export-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });

    const mmdc = path.resolve(__dirname, '..', 'node_modules', '.bin', 'mmdc.cmd');
    const svgs = [];

    // Create mermaid config for Athyna brand styling
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
        theme: 'base',
        themeVariables: {
            primaryColor: '#F3EDFC',
            primaryBorderColor: '#6E35CB',
            primaryTextColor: '#1A1F34',
            lineColor: '#6E35CB',
            secondaryColor: '#E6F9F1',
            tertiaryColor: '#F8F5F2',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            edgeLabelBackground: '#FFFFFF',
        }
    }));

    for (let i = 0; i < MERMAID_DIAGRAMS.length; i++) {
        const inputPath = path.join(tmpDir, `diagram-${i}.mmd`);
        const outputPath = path.join(tmpDir, `diagram-${i}.svg`);

        fs.writeFileSync(inputPath, MERMAID_DIAGRAMS[i]);

        console.log(`  📊 Rendering diagram ${i + 1}/${MERMAID_DIAGRAMS.length}...`);
        try {
            execSync(`"${mmdc}" -i "${inputPath}" -o "${outputPath}" -c "${configPath}" -b transparent`, {
                timeout: 30000,
                stdio: 'pipe'
            });

            if (fs.existsSync(outputPath)) {
                svgs.push(fs.readFileSync(outputPath, 'utf-8'));
            } else {
                svgs.push('<p style="color:red;">Diagram failed to render</p>');
            }
        } catch (err) {
            console.log(`  ⚠️  Diagram ${i} failed: ${err.message}`);
            svgs.push('<p style="color:#A1A1AA;font-style:italic;">[Diagram could not be rendered]</p>');
        }
    }

    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) { }

    return svgs;
}

(async () => {
    const outputPath = path.resolve(__dirname, '..', 'dashboard_metrics_reference.pdf');

    // Step 1: Pre-render Mermaid diagrams
    console.log('📊 Pre-rendering Mermaid diagrams...');
    const svgs = await renderMermaidDiagrams();
    console.log(`✅ Rendered ${svgs.length} diagrams`);

    // Step 2: Build the final HTML with inline SVGs
    console.log('🎨 Building branded HTML...');

    // Replace mermaid placeholders with rendered SVGs
    const diagramHtml = svgs.map(svg =>
        `<div class="mermaid-wrapper">${svg}</div>`
    );

    const finalHtml = buildHTML(diagramHtml);

    // Step 3: Serve and render as PDF
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(finalHtml);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    console.log('🚀 Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://127.0.0.1:' + port, {
        waitUntil: 'networkidle',
        timeout: 30000
    });
    await page.waitForTimeout(2000);

    // Save preview screenshot
    const screenshotPath = path.resolve(__dirname, '..', 'pdf-preview.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('📸 Preview saved:', screenshotPath);

    // Generate PDF
    console.log('📑 Generating PDF...');
    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0.6in', bottom: '0.6in', left: '0.5in', right: '0.5in' },
        displayHeaderFooter: true,
        headerTemplate: '<div style="width:100%;font-size:8px;font-family:Arial,sans-serif;color:#A1A1AA;padding:0 0.5in;display:flex;justify-content:space-between;"><span style="color:#6E35CB;font-weight:600;">ATHYNA</span><span>Dashboard Metrics Reference</span></div>',
        footerTemplate: '<div style="width:100%;font-size:8px;font-family:Arial,sans-serif;color:#A1A1AA;padding:0 0.5in;display:flex;justify-content:space-between;"><span>Confidential</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });

    console.log('✅ PDF saved to:', outputPath);
    await browser.close();
    server.close();
    console.log('🎉 Done!');
})();


function buildHTML(diagramHtmls) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dashboard Metrics Reference</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
  :root {
    --purple: #6E35CB; --purple-light: #8B5BD5; --purple-bg: #F3EDFC;
    --mint: #6CD7AE; --mint-bg: #E6F9F1;
    --navy: #1A1F34; --navy-med: #2E3555;
    --offwhite: #F8F5F2;
    --g100: #F4F4F5; --g200: #E4E4E7; --g400: #A1A1AA; --g600: #52525B; --g800: #27272A;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html { font-size:13px; }
  body { font-family:'DM Sans',Arial,sans-serif; color:var(--navy); line-height:1.7; }

  /* Cover */
  .cover { page-break-after:always; display:flex; flex-direction:column; justify-content:center; align-items:center;
    min-height:100vh; background:linear-gradient(135deg,var(--navy) 0%,var(--navy-med) 40%,var(--purple) 100%);
    color:white; text-align:center; padding:3rem; position:relative; overflow:hidden; }
  .cover::before { content:''; position:absolute; top:-20%; right:-15%; width:500px; height:500px; border-radius:50%;
    background:radial-gradient(circle,rgba(108,215,174,0.15) 0%,transparent 70%); }
  .cover .logo { font-size:1rem; text-transform:uppercase; letter-spacing:6px; color:var(--mint); font-weight:600; margin-bottom:2rem; }
  .cover h1 { font-size:2.8rem; font-weight:700; line-height:1.15; margin-bottom:1rem; color:white; border:none; display:block; padding:0; }
  .cover .sub { font-size:1.15rem; color:rgba(255,255,255,0.7); max-width:500px; }
  .cover .badge { margin-top:2.5rem; padding:0.6rem 1.4rem; background:rgba(255,255,255,0.1);
    border:1px solid rgba(108,215,174,0.3); border-radius:100px; font-size:0.85rem; color:var(--mint); }

  /* Content */
  .content { max-width:750px; margin:0 auto; padding:2rem 2.5rem; }

  h2 { font-size:1.4rem; font-weight:700; color:var(--navy); margin:2.2rem 0 0.6rem 0;
    padding-bottom:0.4rem; border-bottom:3px solid var(--purple); display:inline-block; }
  h3 { font-size:1.05rem; font-weight:600; color:var(--navy-med); margin:1.5rem 0 0.4rem 0; page-break-after:avoid; }
  h4 { font-size:0.95rem; font-weight:600; color:var(--purple); margin:1.2rem 0 0.3rem 0; page-break-after:avoid; }
  p { margin:0.5rem 0; color:var(--g800); }
  strong { font-weight:600; color:var(--navy); }
  hr { border:none; height:1px; background:linear-gradient(to right,var(--purple-bg),var(--g200),var(--purple-bg)); margin:1.8rem 0; }

  ul,ol { margin:0.4rem 0 0.4rem 1.4rem; color:var(--g800); }
  li { margin:0.25rem 0; }
  li::marker { color:var(--purple); }

  /* Tables */
  table { width:100%; border-collapse:collapse; margin:0.8rem 0 1.2rem; font-size:0.85rem; border-radius:6px; overflow:hidden; border:1px solid var(--g200); }
  thead { background:var(--navy); color:white; }
  th { padding:0.6rem 0.8rem; text-align:left; font-weight:600; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; }
  td { padding:0.5rem 0.8rem; border-bottom:1px solid var(--g100); color:var(--g800); }
  tbody tr:nth-child(even) { background:var(--g100); }

  /* Callouts */
  blockquote { margin:0.8rem 0; padding:0.7rem 1rem; border-left:4px solid var(--purple); background:var(--purple-bg);
    border-radius:0 6px 6px 0; color:var(--g800); font-size:0.9rem; }
  .alert-tip { border-left-color:#10B981; background:var(--mint-bg); }
  .alert-note { border-left-color:#3B82F6; background:#EEF6FF; }
  .alert-important { border-left-color:var(--purple); background:var(--purple-bg); }
  .alert-label { font-weight:700; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.2rem; display:block; }
  .alert-tip .alert-label { color:#10B981; }
  .alert-note .alert-label { color:#3B82F6; }
  .alert-important .alert-label { color:var(--purple); }

  /* Mermaid diagrams */
  .mermaid-wrapper { margin:1rem 0; padding:1rem; background:var(--offwhite); border:1px solid var(--g200);
    border-radius:8px; text-align:center; page-break-inside:avoid; }
  .mermaid-wrapper svg { max-width:100%; height:auto; }

  /* Checklist */
  .checklist { list-style:none; margin-left:0; padding:0; }
  .checklist li { padding:0.35rem 0 0.35rem 1.8rem; border-bottom:1px solid var(--g100); position:relative; }
  .checklist li::before { content:'\\2610'; position:absolute; left:0.2rem; top:0.35rem; font-size:1rem; color:var(--purple); }

  .footer { margin-top:2.5rem; padding-top:1.2rem; border-top:2px solid var(--g200);
    text-align:center; color:var(--g400); font-size:0.75rem; }
  .footer .brand { color:var(--purple); font-weight:600; }

  @media print { .cover { height:100vh; } h2,h3,h4 { page-break-after:avoid; } table,.mermaid-wrapper,blockquote { page-break-inside:avoid; } }
</style>
</head>
<body>

<div class="cover">
  <div class="logo">ATHYNA</div>
  <h1>Dashboard Metrics<br>Reference Guide</h1>
  <p class="sub">How our dashboard calculates its numbers &mdash; a verification guide for cross-checking with Beehiiv Analytics</p>
  <div class="badge">&#10003; Covers both XLSX Import &amp; API Sync</div>
</div>

<div class="content">

<h2>How Data Gets From Beehiiv &rarr; Our Dashboard</h2>
<p>There are <strong>two ways</strong> to get your data into the dashboard. Both produce the same result &mdash; they just get there differently:</p>

${diagramHtmls[0]}

<h3>Option A: Upload an Excel File</h3>
<p>When you export your analytics from Beehiiv as an Excel file, it comes with <strong>three tabs</strong>:</p>

<table>
<thead><tr><th>Excel Tab</th><th>What it contains</th><th>What it powers on our dashboard</th></tr></thead>
<tbody>
<tr><td><strong>Posts</strong></td><td>One row per email sent</td><td>KPI cards, performance chart, engagement stats, posts table</td></tr>
<tr><td><strong>Current Subscribers</strong></td><td>Daily subscriber snapshots</td><td>Hero number (big subscriber count), audience chart</td></tr>
<tr><td><strong>Subscriber Monthly</strong></td><td>Monthly sub/unsub counts</td><td>Growth chart</td></tr>
</tbody>
</table>

<h3>Option B: Press the Sync Button</h3>
<p>Instead of exporting a file manually, you can just click <strong>Sync</strong> &mdash; the dashboard connects directly to Beehiiv's API and pulls everything automatically.</p>

<blockquote class="alert-tip"><span class="alert-label">Tip</span>
<strong>Sync gives you real-time data.</strong> The Excel file is a snapshot from whenever you exported it, but Sync always fetches the latest numbers straight from Beehiiv.</blockquote>

<blockquote class="alert-note"><span class="alert-label">Note</span>
In most cases, both methods give you the same numbers. Small differences can appear because the API sometimes provides overall publication averages instead of individual post stats. If you notice a slight discrepancy, that's why &mdash; it's normal and the difference is typically negligible.</blockquote>

<hr>

<h2>Overview Tab</h2>

<h3>The Big Number: Active Subscribers</h3>
<blockquote>The large number at the top of the dashboard.</blockquote>
<ul>
<li><strong>What it shows:</strong> Your current number of active subscribers</li>
<li><strong>Excel method:</strong> Takes the <strong>most recent date</strong> from the "Current Subscribers" tab</li>
<li><strong>Sync method:</strong> Pulls the <strong>live Active Subscribers</strong> count directly from Beehiiv</li>
<li><strong>Where to verify in Beehiiv:</strong> Go to <strong>Beehiiv &rarr; Audience</strong> &rarr; the "Active" count at the top</li>
</ul>
<p>The small <strong>delta badge</strong> next to it (e.g., "+5.2% &uarr;") compares your oldest subscriber count vs. your newest:</p>
<blockquote><strong>Delta = (newest count &minus; oldest count) &divide; oldest count &times; 100</strong></blockquote>

<hr>

<h3>The 6 KPI Cards</h3>
<p>Each card shows an <strong>aggregate number</strong> across all your emails in the selected time period (30 days, 90 days, or all time).</p>

<blockquote class="alert-important"><span class="alert-label">Important</span>
Our dashboard uses <strong>weighted averages</strong> for percentage metrics &mdash; this means an email sent to 10,000 people counts more than one sent to 100 people. This matches how Beehiiv calculates their overview numbers.</blockquote>

<hr>

<h4>Card 1: Open Rate</h4>
${diagramHtmls[1]}
<ul>
<li><strong>Example:</strong> If you sent 3 emails and got 500 + 300 + 200 = 1,000 unique opens out of 800 + 600 + 500 = 1,900 delivered &rarr; <strong>Open Rate = 52.6%</strong></li>
<li><strong>In Beehiiv:</strong> Go to <strong>Posts &rarr; All Posts</strong> &rarr; look at the "Open Rate" column.</li>
</ul>

<hr>

<h4>Card 2: Click-Through Rate (CTR)</h4>
${diagramHtmls[2]}
<ul>
<li><strong>What it measures:</strong> Of the people who <em>opened</em> your emails, what percentage <em>clicked</em> a link?</li>
<li><strong>In Beehiiv:</strong> This is the "Click Rate" shown per post. Our dashboard combines all posts weighted by opens.</li>
</ul>

<hr>

<h4>Card 3: Verified CTR</h4>
<p>Same as CTR, but uses <strong>Verified Clicks</strong> instead of all clicks.</p>
<ul>
<li><strong>What "verified" means:</strong> Beehiiv filters out bots and automated scanners. Only clicks from real humans count.</li>
<li><strong>Formula:</strong> Total Verified Clicks &divide; Total Unique Opens &times; 100</li>
<li><strong>In Beehiiv:</strong> Look for "Verified Click Rate" in your post stats.</li>
</ul>

<hr>

<h4>Card 4: Delivery Rate</h4>
${diagramHtmls[3]}
<ul>
<li><strong>What it measures:</strong> What % of sent emails actually landed in inboxes (not bounced)?</li>
<li><strong>In Beehiiv:</strong> Compare against the "Delivery Rate" on individual posts.</li>
</ul>

<hr>

<h4>Card 5: Unique Clicks</h4>
<ul>
<li><strong>Just a simple sum:</strong> Adds up all unique clicks across every email in the time period</li>
<li><strong>In Beehiiv:</strong> Go to <strong>Posts &rarr; All Posts</strong> &rarr; add up the "Unique Clicks" column</li>
</ul>

<hr>

<h4>Card 6: Verified Clicks</h4>
<ul>
<li><strong>Same as above, but bot-filtered:</strong> Adds up all verified unique clicks</li>
<li><strong>In Beehiiv:</strong> Look at "Verified Unique Clicks" per post and sum them up</li>
</ul>

<hr>

<h3>How the Delta Badges Work (All Cards)</h3>
<p>Each KPI card shows a small green/red badge showing whether the metric is trending up or down:</p>
${diagramHtmls[4]}
<ul>
<li>For <strong>rates</strong> (Open Rate, CTR, etc.): The badge shows the <strong>percentage change</strong> between the two halves (e.g., "+3.2%")</li>
<li>For <strong>counts</strong> (Clicks): The badge shows the <strong>raw difference</strong> (e.g., "+142")</li>
</ul>

<hr>

<h3>Performance Chart (Bar Chart)</h3>
<ul>
<li><strong>What it shows:</strong> Verified Unique Clicks per month (or per week)</li>
<li><strong>Where to verify:</strong> In Beehiiv, look at each post's "Verified Unique Clicks" and manually sum by month</li>
<li><strong>Toggle:</strong> Switch between Monthly and Weekly views</li>
</ul>

<hr>

<h2>Engagement Tab</h2>

<h3>Summary Cards Row</h3>
<table>
<thead><tr><th>Card</th><th>What it shows</th><th>How it's calculated</th><th>Where in Beehiiv</th></tr></thead>
<tbody>
<tr><td><strong>Total Opens</strong></td><td>All unique opens combined</td><td>Sum of "Unique Opens" from every email</td><td>Add up the Opens column</td></tr>
<tr><td><strong>Total Clicks</strong></td><td>All unique clicks combined</td><td>Sum of "Unique Clicks" from every email</td><td>Add up the Clicks column</td></tr>
<tr><td><strong>Posts Sent</strong></td><td>Number of emails sent</td><td>Count of emails in the period</td><td>Count rows in Posts</td></tr>
</tbody>
</table>

<h3>Open Rate Donut (Pie Chart)</h3>
<ul>
<li><strong>Shows:</strong> The overall open rate as a visual pie &mdash; green for opened, gray for unopened</li>
<li><strong>Formula:</strong> Same logic as the Open Rate KPI card (total opens &divide; total delivered)</li>
<li><strong>Center number:</strong> The open rate percentage</li>
</ul>

<h3>Top Posts Leaderboard</h3>
<ul>
<li><strong>Shows:</strong> Your top 7 best-performing emails ranked by Open Rate</li>
<li><strong>Note:</strong> This shows <strong>all-time</strong> top posts, not filtered by the date toggle</li>
<li><strong>In Beehiiv:</strong> Go to <strong>Posts &rarr; All Posts</strong> &rarr; sort by "Open Rate" descending</li>
</ul>

<h3>Clicks by Post (Horizontal Bars)</h3>
<ul>
<li><strong>Shows:</strong> Top 10 posts by click count</li>
<li><strong>Date filtered:</strong> Yes, respects the 30d/90d toggle</li>
<li><strong>In Beehiiv:</strong> Sort Posts by "Unique Clicks" descending</li>
</ul>

<hr>

<h2>Growth Tab</h2>

<h3>Subscriber Growth Chart (Bars + Line)</h3>
${diagramHtmls[5]}
<ul>
<li><strong>Where the data comes from:</strong>
  <ul>
  <li><strong>Excel:</strong> Directly from the "Subscriber Monthly" tab (includes both new subs and unsubs)</li>
  <li><strong>Sync:</strong> Derives monthly unsubscribes from your posts. New subscriber counts aren't available via API, so this chart works best with the Excel method.</li>
  </ul>
</li>
<li><strong>In Beehiiv:</strong> Go to <strong>Audience &rarr; Growth</strong> &rarr; compare monthly numbers</li>
</ul>

<h3>Active Subscribers Over Time (Area Chart)</h3>
<ul>
<li><strong>Shows:</strong> A line chart of your active subscriber count over time</li>
<li><strong>Where the data comes from:</strong>
  <ul>
  <li><strong>Excel:</strong> One data point per date from the "Current Subscribers" tab &mdash; exact daily counts</li>
  <li><strong>Sync:</strong> Estimates historical counts based on how many people received each email, plus today's live count</li>
  </ul>
</li>
<li><strong>In Beehiiv:</strong> Go to <strong>Audience</strong> &rarr; look at the subscriber trend line</li>
</ul>

<hr>

<h2>Posts Table (Bottom of Dashboard)</h2>
<p>The table at the bottom shows individual email performance:</p>

<table>
<thead><tr><th>Column</th><th>What it shows</th><th>Beehiiv equivalent</th></tr></thead>
<tbody>
<tr><td><strong>Title</strong></td><td>The email subject line</td><td>"Subject" column in Posts</td></tr>
<tr><td><strong>Date</strong></td><td>When the email was sent</td><td>"Send Date" in Posts</td></tr>
<tr><td><strong>Recipients</strong></td><td>How many people received it</td><td>"Delivered" (or "Sent")</td></tr>
<tr><td><strong>Opens</strong></td><td>How many unique people opened it</td><td>"Unique Opens"</td></tr>
<tr><td><strong>Clicks</strong></td><td>How many unique people clicked</td><td>"Unique Clicks"</td></tr>
<tr><td><strong>CTR</strong></td><td>Click-through rate for that email</td><td>"Click Rate"</td></tr>
</tbody>
</table>

<p>You can sort by any column, search by title, and change how many posts per page.</p>

<hr>

<h2>Quick Verification Checklist</h2>
<p>Use this checklist when cross-referencing the dashboard with Beehiiv:</p>

<ul class="checklist">
<li><strong>Active Subscribers</strong> &rarr; Beehiiv Audience &rarr; Active count</li>
<li><strong>Open Rate</strong> &rarr; Beehiiv Posts &rarr; weighted average of Open Rate</li>
<li><strong>CTR</strong> &rarr; Beehiiv Posts &rarr; weighted average of Click Rate</li>
<li><strong>Verified CTR</strong> &rarr; Beehiiv Posts &rarr; weighted average of Verified Click Rate</li>
<li><strong>Delivery Rate</strong> &rarr; Beehiiv Posts &rarr; weighted average of Delivery Rate</li>
<li><strong>Unique Clicks</strong> &rarr; Beehiiv Posts &rarr; sum of Unique Clicks column</li>
<li><strong>Verified Clicks</strong> &rarr; Beehiiv Posts &rarr; sum of Verified Unique Clicks column</li>
<li><strong>Total Opens (Engagement)</strong> &rarr; Beehiiv Posts &rarr; sum of Unique Opens</li>
<li><strong>Total Clicks (Engagement)</strong> &rarr; Beehiiv Posts &rarr; sum of Unique Clicks</li>
<li><strong>Posts Sent</strong> &rarr; Count of posts in Beehiiv for the period</li>
<li><strong>Growth chart</strong> &rarr; Beehiiv Audience &rarr; Growth &rarr; monthly breakdown</li>
<li><strong>Audience chart</strong> &rarr; Beehiiv Audience &rarr; subscriber trend</li>
</ul>

<hr>

<h2>Things to Watch Out For</h2>
<ol>
<li><strong>Date range matters:</strong> Make sure you're looking at the same period in both Beehiiv and the dashboard (30 days, 90 days, or all time)</li>
<li><strong>The leaderboard is NOT date-filtered</strong> &mdash; it always shows your all-time best posts</li>
<li><strong>Weighted vs. simple averages:</strong> If you manually average open rates in a spreadsheet, you'll get a slightly different number. Our dashboard weights by audience size (same as Beehiiv).</li>
<li><strong>Verified Clicks &lt; Unique Clicks</strong> &mdash; Verified clicks are always lower because bots are removed. It's normal.</li>
<li><strong>Excel vs. Sync might differ slightly</strong> &mdash; The Sync button pulls live data, while the Excel file is a snapshot. Small differences in subscriber history are normal.</li>
</ol>

<div class="footer"><span class="brand">ATHYNA</span> &mdash; Dashboard Metrics Reference &middot; February 2025</div>

</div>
</body>
</html>`;
}
