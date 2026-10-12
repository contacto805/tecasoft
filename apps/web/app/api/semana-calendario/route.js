import { NextResponse } from "next/server";

const MONTHS = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

function parseSpanishDate(day, monthName, year) {
  const m = MONTHS[(monthName || '').toLowerCase()] || 1;
  const d = parseInt(day, 10) || 1;
  const y = parseInt(year, 10) || new Date().getFullYear();
  return { d, m, y, iso: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` };
}

function formatDisplay(d, m, y) {
  const names = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d} ${names[m-1]}`;
}

export async function GET() {
  try {
    const res = await fetch('https://www.calendario-365.mx/numero-de-semana.html', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppBot/1.0)' },
      cache: 'no-store'
    });
    const html = await res.text();

    // Primary MX week number (first big_weeknr)
    let semana = 1;
    const weekMatch = html.match(/id="big_weeknr">(\d+)<\/div>/);
    if (weekMatch) semana = parseInt(weekMatch[1], 10) || 1;

    // Extract the main description for Sunday start - Saturday end (MX style)
    // "Esta semana empieza el domingo 26 julio 2026<br /> y termina el sábado 1 agosto 2026"
    const descMatch = html.match(/empieza el domingo\s+(\d+)\s+(\w+)\s+(\d{4}).*?termina el sábado\s+(\d+)\s+(\w+)\s+(\d{4})/i);
    
    let fecha_inicio = null; // lunes
    let fecha_fin = null;    // sábado
    let display_lunes = '';
    let display_sabado = '';

    if (descMatch) {
      const domD = descMatch[1], domM = descMatch[2], domY = descMatch[3];
      const sabD = descMatch[4], sabM = descMatch[5], sabY = descMatch[6];

      // domingo date
      const dom = parseSpanishDate(domD, domM, domY);
      // sabado date
      const sab = parseSpanishDate(sabD, sabM, sabY);

      // Lunes = domingo + 1 day
      let lunD = dom.d + 1;
      let lunM = dom.m;
      let lunY = dom.y;
      if (lunD > 28) { // simple month rollover (good enough for this)
        // rough: assume max 31
        if (([1,3,5,7,8,10,12].includes(lunM) && lunD > 31) || ([4,6,9,11].includes(lunM) && lunD > 30) || (lunM===2 && lunD > 28)) {
          lunD = 1; lunM += 1; if (lunM > 12) { lunM=1; lunY++; }
        }
      }
      fecha_inicio = `${lunY}-${String(lunM).padStart(2,'0')}-${String(lunD).padStart(2,'0')}`;
      fecha_fin = sab.iso;
      display_lunes = formatDisplay(lunD, lunM, lunY);
      display_sabado = formatDisplay(sab.d, sab.m, sab.y);
    } else {
      // Fallback: use ISO second block or current date calc
      const isoMatch = html.match(/empieza el lunes\s+(\d+)\s+(\w+)\s+(\d{4}).*?termina el domingo\s+(\d+)\s+(\w+)\s+(\d{4})/i);
      if (isoMatch) {
        const lun = parseSpanishDate(isoMatch[1], isoMatch[2], isoMatch[3]);
        const domEnd = parseSpanishDate(isoMatch[4], isoMatch[5], isoMatch[6]);
        // sábado is day before sunday end
        let sabD = domEnd.d - 1, sabM = domEnd.m, sabY = domEnd.y;
        if (sabD < 1) { sabM -= 1; if (sabM<1){sabM=12;sabY--;} sabD=31; } // approx
        fecha_inicio = lun.iso;
        fecha_fin = `${sabY}-${String(sabM).padStart(2,'0')}-${String(sabD).padStart(2,'0')}`;
        display_lunes = formatDisplay(lun.d, lun.m, lun.y);
        display_sabado = formatDisplay(sabD, sabM, sabY);
      } else {
        // last resort: today based simple week (Mon-Sat)
        const now = new Date();
        const day = now.getDay(); // 0 sun ... 1 mon
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
        const sat = new Date(mon); sat.setDate(mon.getDate() + 5);
        const y = mon.getFullYear();
        fecha_inicio = mon.toISOString().slice(0,10);
        fecha_fin = sat.toISOString().slice(0,10);
        display_lunes = `${mon.getDate()} ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][mon.getMonth()]}`;
        display_sabado = `${sat.getDate()} ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][sat.getMonth()]}`;
      }
    }

    return NextResponse.json({
      semana,
      fecha_inicio,
      fecha_fin,
      display_lunes,
      display_sabado,
      label: `Semana ${semana} • Lunes ${display_lunes} — Sábado ${display_sabado}`
    });
  } catch (e) {
    // graceful fallback using current date
    const now = new Date();
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
    const sat = new Date(mon); sat.setDate(mon.getDate() + 5);
    const y = mon.getFullYear();
    const mNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return NextResponse.json({
      semana: Math.ceil((mon.getTime() - new Date(y,0,1).getTime()) / (7*86400000)) || 1,
      fecha_inicio: mon.toISOString().slice(0,10),
      fecha_fin: sat.toISOString().slice(0,10),
      display_lunes: `${mon.getDate()} ${mNames[mon.getMonth()]}`,
      display_sabado: `${sat.getDate()} ${mNames[sat.getMonth()]}`,
      label: `Semana ${Math.ceil((mon.getTime() - new Date(y,0,1).getTime()) / (7*86400000)) || 1}`
    });
  }
}
