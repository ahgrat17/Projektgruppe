
const STORAGE_KEY = "timingData";

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function startTimer() {
  return performance.now();
}

export function stopTimer(start, operation, step) {
  const duration = performance.now() - start;
  const key = `${operation}::${step}`;

  const data = loadData();
  if (!data[key]) data[key] = [];
  data[key].push(duration);
  saveData(data);

  return duration;
}

export function logTimingSummary(operation, stepDurations, totalDuration) {
  const data = loadData();

  console.group(`⏱ ${operation} – Zeitmessung`);

  stepDurations.forEach(({ step, duration }) => {
    const key = `${operation}::${step}`;
    const history = data[key] || [];
    const avg = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : duration;
    console.log(
      `  ${step}: ${duration.toFixed(1)} ms (Durchschnitt: ${avg.toFixed(1)} ms, n=${history.length})`
    );
  });

  const totalKey = `${operation}::GESAMT`;
  if (!data[totalKey]) data[totalKey] = [];
  data[totalKey].push(totalDuration);
  saveData(data);

  const totalHistory = data[totalKey] || [];
  const totalAvg = totalHistory.reduce((a, b) => a + b, 0) / totalHistory.length;
  console.log(
    `  GESAMT: ${totalDuration.toFixed(1)} ms (Durchschnitt: ${totalAvg.toFixed(1)} ms, n=${totalHistory.length})`
  );

  console.groupEnd();
}


export function clearTimingData() {
  localStorage.removeItem(STORAGE_KEY);
  console.log("Timing-Daten gelöscht.");
}
