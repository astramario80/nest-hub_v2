(function() {

const slideDisplayUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS48SaNAi_BcEsa09RJINK8kX5Su6eJ6g2YvL4dAMqBBNo_09qilAG1tTBXAgSwFoRY1kCLHwR-VBG1/pub?gid=0&single=true&output=csv";
const currentScheduleUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS48SaNAi_BcEsa09RJINK8kX5Su6eJ6g2YvL4dAMqBBNo_09qilAG1tTBXAgSwFoRY1kCLHwR-VBG1/pub?gid=927955961&single=true&output=csv";

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else if (char !== '\r') {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
}

async function loadBellSchedule() {
    const loadingEl = document.getElementById('bell-loading');
    
    try {
        loadingEl.innerHTML = "Step 1: Initiating connection to Google Sheets...<br><span style='font-size:0.8rem;color:#888;'>This might take a second.</span>";
        
        const cacheBuster = "&t=" + new Date().getTime();
        
        loadingEl.innerHTML = "Step 2: Fetching SlideDisplay data...";
        const slideRes = await fetch(slideDisplayUrl + cacheBuster);
        
        loadingEl.innerHTML = "Step 3: Fetching CurrentSchedule data...";
        const currentRes = await fetch(currentScheduleUrl + cacheBuster);

        if (!slideRes.ok || !currentRes.ok) {
            throw new Error("Google Sheets returned an error (Status " + slideRes.status + " / " + currentRes.status + ").");
        }
        
        loadingEl.innerHTML = "Step 4: Downloading text data...";
        const slideText = await slideRes.text();
        const currentText = await currentRes.text();

        if (slideText.includes("<html") || currentText.includes("<html") || slideText.includes("<!DOCTYPE") || currentText.includes("<!DOCTYPE")) {
            throw new Error("Google Sheets returned a webpage instead of a CSV file. This means the Bethel School District security wall is blocking the request and redirecting to a login page. You must use Option 3 (Google Apps Script Web App) or ensure the sheet is published completely publicly.");
        }

        if (slideText.includes("#REF!") || currentText.includes("#REF!")) {
            throw new Error("Google Sheets IMPORTRANGE Error: You need to open your new Google Sheet and click 'Allow Access' on the #REF! cell so it can pull the data from the original sheet.");
        }

        loadingEl.innerHTML = "Step 5: Parsing CSV data...";
        const slideData = parseCSV(slideText);
        const currentData = parseCSV(currentText);

        loadingEl.innerHTML = "Step 6: Building interface...";

        // 1. Background Color
        // Look specifically for a hex code in the second row (index 1), third column (index 2)
        let bgColor = '#E87722'; // Default NEST Orange
        
        if (currentData.length > 1 && currentData[1].length > 2) {
            let potentialColor = currentData[1][2].trim();
            // Verify it actually looks like a hex code (#FFF or #FFFFFF)
            if (/^#([0-9A-F]{3}){1,2}$/i.test(potentialColor)) {
                bgColor = potentialColor;
            }
        }
        
        // Also check if the body exists before applying
        const bellBody = document.getElementById('bell-body');
        if (bellBody) {
            bellBody.style.backgroundColor = bgColor;
            // Add a smooth transition
            bellBody.style.transition = "background-color 1s ease";
        }

        // 2. Today's Schedule
        const todayTitle = slideData[7] && slideData[7][0] ? slideData[7][0] : 'No School Today';
        document.getElementById('today-title').textContent = todayTitle;

        const todayTable = document.getElementById('today-table').querySelector('tbody');
        todayTable.innerHTML = '';
        for(let i = 8; i <= 25; i++) {
            if(slideData[i] && slideData[i][0] && slideData[i][1]) {
                const tr = document.createElement('tr');
                const isLunch = slideData[i][0].toLowerCase().includes('lunch');
                if (isLunch) tr.classList.add('lunch-row');
                
                tr.innerHTML = `<td class="period-name">${slideData[i][0]}</td><td class="period-time">${slideData[i][1]}</td>`;
                todayTable.appendChild(tr);
            }
        }

        // 3. Upcoming Schedule
        const upcomingTitle = slideData[7] && slideData[7].length > 3 ? slideData[7][3] : '';
        document.getElementById('upcoming-title').textContent = upcomingTitle;
        
        const upcomingTable = document.getElementById('upcoming-table').querySelector('tbody');
        upcomingTable.innerHTML = '';
        if(upcomingTitle) {
            for(let i = 8; i <= 25; i++) {
                if(slideData[i] && slideData[i].length > 4 && slideData[i][3] && slideData[i][4]) {
                    const tr = document.createElement('tr');
                    const isLunch = slideData[i][3].toLowerCase().includes('lunch');
                    if (isLunch) tr.classList.add('lunch-row');
                    
                    tr.innerHTML = `<td class="period-name">${slideData[i][3]}</td><td class="period-time">${slideData[i][4]}</td>`;
                    upcomingTable.appendChild(tr);
                }
            }
        } else {
            document.querySelector('.upcoming-card').style.display = 'none';
        }

        // 4. Ticker
        let tickerItems = [];
        for(let i = 2; i <= 5; i++) {
            if(currentData[i] && currentData[i][0] && currentData[i][1]) {
                let dateStr = currentData[i][0];
                if(dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if(parts.length >= 2) dateStr = `${parts[0]}/${parts[1]}`;
                }
                tickerItems.push(`${dateStr} – ${currentData[i][1]}`);
            }
        }
        if(tickerItems.length > 0) {
            document.getElementById('ticker-text').innerHTML = `<strong>Upcoming:</strong> &nbsp;&nbsp; ${tickerItems.join(' &nbsp;❧&nbsp; ')}`;
        } else {
            document.querySelector('.bell-ticker').style.display = 'none';
        }

        // Show content
        loadingEl.style.display = 'none';
        document.getElementById('bell-content').style.display = 'block';

    } catch (e) {
        console.error(e);
        let errorMsg = "<strong>Failed to load schedule data.</strong><br><br>";
        
        if (window.location.protocol === 'file:') {
            errorMsg += "<span style='font-size: 1.1rem; color: #ff9999;'>Note: Browsers block fetching live data when opening HTML files directly from your computer (file://).<br>This will work perfectly once you upload it to Netlify!</span>";
        } else {
            errorMsg += "<span style='font-size: 1.1rem; color: #ff9999;'>" + e.message + "</span>";
        }
        
        loadingEl.innerHTML = errorMsg;
    }
}

document.addEventListener('DOMContentLoaded', loadBellSchedule);

})();