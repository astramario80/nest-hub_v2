
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
    try {
        // We append a timestamp to bypass browser caching
        const cacheBuster = "&t=" + new Date().getTime();
        const [slideRes, currentRes] = await Promise.all([
            fetch(slideDisplayUrl + cacheBuster),
            fetch(currentScheduleUrl + cacheBuster)
        ]);

        if (!slideRes.ok || !currentRes.ok) {
            throw new Error("Google Sheets returned an error (Status " + slideRes.status + ").");
        }
        const slideText = await slideRes.text();
        const currentText = await currentRes.text();

        if (slideText.includes("#REF!") || currentText.includes("#REF!")) {
            throw new Error("Google Sheets IMPORTRANGE Error: You need to open your new Google Sheet and click 'Allow Access' on the #REF! cell so it can pull the data from the original sheet.");
        }

        const slideData = parseCSV(slideText);
        const currentData = parseCSV(currentText);

        // 1. Background Color
        const bgColor = currentData[1] && currentData[1][2] ? currentData[1][2] : '#E87722';
        document.getElementById('bell-body').style.backgroundColor = bgColor;

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
        document.getElementById('bell-loading').style.display = 'none';
        document.getElementById('bell-content').style.display = 'block';

    } catch (e) {
        console.error(e);
        let errorMsg = "Failed to load schedule data. ";
        
        if (window.location.protocol === 'file:') {
            errorMsg += "<br><br><span style='font-size: 1rem; color: #ff9999;'>Note: Browsers block fetching live data when opening HTML files directly from your computer (file://).<br>This will work perfectly once you upload it to Netlify or run a local server!</span>";
        } else {
            errorMsg += "<br><br><span style='font-size: 1rem; color: #ff9999;'>Error details: " + e.message + "</span>";
        }
        
        document.getElementById('bell-loading').innerHTML = errorMsg;
    }
}

document.addEventListener('DOMContentLoaded', loadBellSchedule);
