(() => {
  const station = document.querySelector('#station-filter');
  const serial = document.querySelector('#serial-filter');
  const status = document.querySelector('#lookup-status');
  const results = document.querySelector('#lookup-results');
  const refresh = document.querySelector('#lookup-refresh');
  let computers = [];

  function fill(select, values, label) {
    select.replaceChildren(new Option(`All ${label}`, ''));
    values.forEach(value => select.add(new Option(value, value)));
    select.disabled = false;
  }

  function render() {
    const matches = computers.filter(item => (!station.value || item.station === station.value) && (!serial.value || item.serial === serial.value));
    results.replaceChildren();
    matches.forEach(item => {
      const row = results.insertRow();
      row.insertCell().textContent = item.station;
      row.insertCell().textContent = item.serial;
    });
    status.textContent = matches.length ? `${matches.length} computer${matches.length === 1 ? '' : 's'} found.` : 'No computers match those filters.';
  }

  async function load() {
    refresh.disabled = true;
    status.textContent = 'Loading computers…';
    try {
      const response = await fetch('/api/computer-lookup', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Lookup unavailable');
      const data = await response.json();
      if (!Array.isArray(data.computers)) throw new Error('Invalid lookup data');
      computers = data.computers;
      const stations = [...new Set(computers.map(item => item.station))];
      const serials = [...new Set(computers.map(item => item.serial))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const previousStation = station.value, previousSerial = serial.value;
      fill(station, stations, 'stations');
      fill(serial, serials, 'serial numbers');
      if (stations.includes(previousStation)) station.value = previousStation;
      if (serials.includes(previousSerial)) serial.value = previousSerial;
      render();
    } catch {
      status.textContent = 'Computer lookup is temporarily unavailable. Try Refresh.';
    } finally {
      refresh.disabled = false;
    }
  }

  station.addEventListener('change', () => { if (station.value) serial.value = ''; render(); });
  serial.addEventListener('change', () => { if (serial.value) station.value = ''; render(); });
  refresh.addEventListener('click', load);
  load();
})();
