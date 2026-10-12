export function getMexicoCityTime() {
  const dateObj = new Date();
  const dtfDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dtfTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const date = dtfDate.format(dateObj);
  const time = dtfTime.format(dateObj);

  // Week of year based on Ciudad de México calendar day (ISO style week #)
  const [y, m, dd] = date.split('-').map(n => parseInt(n, 10));
  const mxDate = new Date(Date.UTC(y, m - 1, dd));
  const getWeekNumber = (d, year) => {
    const t = new Date(d.valueOf());
    const dayNr = (d.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() + 3 - dayNr);
    const firstThu = t.valueOf();
    t.setUTCFullYear(year, 0, 1);
    if (t.getUTCDay() !== 4) {
      t.setUTCDate(t.getUTCDate() + ((4 - t.getUTCDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThu - t.valueOf()) / (7 * 86400000));
  };
  const week = getWeekNumber(mxDate, y);

  return {
    date,
    time,
    dateTime: `${date} ${time}`,
    timestamp: dateObj.toISOString(),
    week
  };
}
