import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { getWeekChunks } from '../components/PaperTables';
import { MONTH_NAMES, formatDate } from './dates';
import { GROUP_COLORS } from './houseGroups';
import { hasOrangeWork, minsToHHMM, parseHoursToMinutes } from './timesheet';

function entryFor(entries, year, month, day) {
  return entries[formatDate(year, month, day)];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const BASE_STYLE = `
  body { font-family: Helvetica, Arial, sans-serif; padding: 16px; color: #000; }
  h1 { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
  p { font-size: 12px; margin: 0 0 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 8px; }
  th, td { padding: 5px 6px; text-align: center; }
  th { font-weight: 700; }
`;

function buildWhiteHtml({ worker, monthName, daysCount, entries, year, month }) {
  const rows = Array.from({ length: daysCount }, (_, i) => {
    const day = i + 1;
    const entry = entryFor(entries, year, month, day);
    const bg = entry ? '#fafafa' : '#ffffff';
    return `<tr style="background:${bg}">
      <td style="border:0.5pt solid #333"><b>${day}</b></td>
      <td style="border:0.5pt solid #333">${escapeHtml(entry?.white_start?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #333">${escapeHtml(entry?.white_finish?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #333">30 min</td>
      <td style="border:0.5pt solid #333">${escapeHtml(entry ? entry.white_hours || '8:00' : '')}</td>
      <td style="border:0.5pt solid #333; text-align:left">${escapeHtml(entry?.what_work)}</td>
    </tr>`;
  }).join('');

  return `<html><head><style>${BASE_STYLE}</style></head><body>
    <h1>WORK PAID BY THE HOUR</h1>
    <p>8 HOURS PER DAY / 40 HOURS PER WEEK</p>
    <p>Name: ${escapeHtml(worker?.full_name)}   Work number: ${escapeHtml(worker?.work_number)}   ${escapeHtml(monthName)}</p>
    <table>
      <thead><tr style="background:#e0e0e0">
        <th style="border:0.5pt solid #333">Date</th>
        <th style="border:0.5pt solid #333">Start</th>
        <th style="border:0.5pt solid #333">Finish</th>
        <th style="border:0.5pt solid #333">Eating break</th>
        <th style="border:0.5pt solid #333">Hours minus breaks</th>
        <th style="border:0.5pt solid #333">What work</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

function buildOrangeHtml({ worker, monthName, daysCount, entries, year, month }) {
  const rows = Array.from({ length: daysCount }, (_, i) => {
    const day = i + 1;
    const entry = entryFor(entries, year, month, day);
    const orange = hasOrangeWork(entry);
    const bg = orange ? '#fff8e1' : '#fffbf0';
    return `<tr style="background:${bg}">
      <td style="border:0.5pt solid #c97d00"><b>${day}</b></td>
      <td style="border:0.5pt solid #c97d00">${escapeHtml(orange ? entry.orange_start?.slice(0, 5) : '')}</td>
      <td style="border:0.5pt solid #c97d00">${escapeHtml(orange ? entry.orange_finish?.slice(0, 5) : '')}</td>
      <td style="border:0.5pt solid #c97d00">${escapeHtml(orange ? entry.orange_break || '0:00' : '')}</td>
      <td style="border:0.5pt solid #c97d00">${escapeHtml(orange ? entry.orange_hours : '')}</td>
      <td style="border:0.5pt solid #c97d00; text-align:left">${escapeHtml(orange ? entry.what_work : '')}</td>
      <td style="border:0.5pt solid #c97d00"></td>
    </tr>`;
  }).join('');

  return `<html><head><style>${BASE_STYLE}</style></head><body>
    <h1 style="color:#b45309">EXTRAWORK PAID BY THE HOUR</h1>
    <p>Name: ${escapeHtml(worker?.full_name)}   Work number: ${escapeHtml(worker?.work_number)}   ${escapeHtml(monthName)}</p>
    <table style="background:#fffbf0">
      <thead><tr style="background:#ffe0a0">
        <th style="border:0.5pt solid #c97d00">Date</th>
        <th style="border:0.5pt solid #c97d00">Start</th>
        <th style="border:0.5pt solid #c97d00">Finish</th>
        <th style="border:0.5pt solid #c97d00">Break</th>
        <th style="border:0.5pt solid #c97d00">Hours minus breaks</th>
        <th style="border:0.5pt solid #c97d00">What work</th>
        <th style="border:0.5pt solid #c97d00">Signature</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

function buildWeeklyHtml({ worker, monthName, daysCount, entries, greenEntries, year, month }) {
  const weeks = getWeekChunks(year, month, daysCount);
  const tables = weeks.map((weekDays, weekIdx) => {
    let totalWorking = 0;
    let totalExtra = 0;
    let totalKg = 0;
    weekDays.forEach((info) => {
      if (!info.exists || info.isSun) return;
      const entry = entryFor(entries, year, month, info.day);
      if (entry) {
        totalWorking += parseHoursToMinutes(entry.white_hours);
        totalExtra += parseHoursToMinutes(entry.orange_hours);
      }
      const ge = entryFor(greenEntries, year, month, info.day);
      if (ge?.kg_picked != null) totalKg += Number(ge.kg_picked) || 0;
    });

    const headerCells = weekDays
      .map((info) => `<th style="border:0.5pt solid #333; background:#d0d0d0">${info.exists ? 'Day ' + info.day : ''}</th>`)
      .join('');

    const pickupCells = weekDays
      .map((info) => {
        if (info.isSun) return '<td style="border:0.5pt solid #333; background:#e8f5e9; color:#2d6a2d; font-weight:700">X</td>';
        const ge = entryFor(greenEntries, year, month, info.day);
        const value = ge?.kg_picked != null ? escapeHtml(ge.kg_picked) : '';
        return `<td style="border:0.5pt solid #333; background:#e8f5e9; color:#2d6a2d; font-weight:700">${value}</td>`;
      })
      .join('');

    const workingCells = weekDays
      .map((info) => {
        if (info.isSun) return '<td style="border:0.5pt solid #333; background:#fafafa">X</td>';
        const entry = entryFor(entries, year, month, info.day);
        const value = entry ? entry.white_hours || '8:00' : '';
        return `<td style="border:0.5pt solid #333; background:#fafafa; font-weight:700">${escapeHtml(value)}</td>`;
      })
      .join('');

    const extraCells = weekDays
      .map((info) => {
        if (info.isSun) return '<td style="border:0.5pt solid #c97d00; background:#fff3e0; color:#b45309; font-weight:700">X</td>';
        const entry = entryFor(entries, year, month, info.day);
        const value = entry ? entry.orange_hours : '';
        return `<td style="border:0.5pt solid #c97d00; background:#fff3e0; color:#b45309; font-weight:700">${escapeHtml(value)}</td>`;
      })
      .join('');

    return `<p style="font-weight:800; font-size:11px; text-transform:uppercase; margin-top:14px">Week ${weekIdx + 1}</p>
      <table>
        <thead><tr style="background:#d0d0d0">
          <th style="border:0.5pt solid #333; background:#d0d0d0"></th>
          ${headerCells}
          <th style="border:0.5pt solid #333; background:#d0d0d0">Total</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="border:0.5pt solid #333; background:#e8f5e9; color:#2d6a2d; font-weight:700; text-align:left">Berry picking (kg)</td>
            ${pickupCells}
            <td style="border:0.5pt solid #333; background:#e8f5e9; color:#2d6a2d; font-weight:700">${totalKg > 0 ? escapeHtml(Math.round(totalKg * 100) / 100) : ''}</td>
          </tr>
          <tr>
            <td style="border:0.5pt solid #333; background:#fafafa; font-weight:700; text-align:left">working hrs</td>
            ${workingCells}
            <td style="border:0.5pt solid #333; background:#fafafa; font-weight:700">${minsToHHMM(totalWorking)}</td>
          </tr>
          <tr>
            <td style="border:0.5pt solid #c97d00; background:#fff3e0; color:#b45309; font-weight:700; text-align:left">extra hrs</td>
            ${extraCells}
            <td style="border:0.5pt solid #c97d00; background:#fff3e0; color:#b45309; font-weight:700">${minsToHHMM(totalExtra)}</td>
          </tr>
          <tr>
            <td colspan="9" style="border:0.5pt solid #333; background:#ffffff; text-align:left">yes, I want to work extra hours &nbsp;&#9744;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Signature: _______________________</td>
          </tr>
        </tbody>
      </table>`;
  }).join('');

  return `<html><head><style>${BASE_STYLE}</style></head><body>
    <h1>WEEKLY SUMMARY</h1>
    <p>Name: ${escapeHtml(worker?.full_name)}   Work number: ${escapeHtml(worker?.work_number)}   ${escapeHtml(monthName)}</p>
    ${tables}
  </body></html>`;
}

function buildGreenHtml({ worker, monthName, daysCount, greenEntries, year, month }) {
  const rows = Array.from({ length: daysCount }, (_, i) => {
    const day = i + 1;
    const ge = entryFor(greenEntries, year, month, day);
    const bg = ge ? '#f6fff6' : '#ffffff';
    return `<tr style="background:${bg}">
      <td style="border:0.5pt solid #2d6a2d"><b>${day}</b></td>
      <td style="border:0.5pt solid #2d6a2d">${escapeHtml(ge?.start_time?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #2d6a2d">${escapeHtml(ge?.finish_time?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #2d6a2d; color:#888888">1 hour</td>
      <td style="border:0.5pt solid #2d6a2d"></td>
      <td style="border:0.5pt solid #2d6a2d"></td>
      <td style="border:0.5pt solid #2d6a2d; text-align:left">${escapeHtml(ge?.what_picked)}</td>
      <td style="border:0.5pt solid #2d6a2d">${ge?.kg_picked != null ? `<b style="color:#2d6a2d">${escapeHtml(ge.kg_picked)}</b>` : ''}</td>
    </tr>`;
  }).join('');

  return `<html><head><style>${BASE_STYLE}</style></head><body>
    <h1 style="color:#2d6a2d">TIME USED FOR PICKUP, SALARY PAID BY KILOS</h1>
    <p>Name: ${escapeHtml(worker?.full_name)}   Work number: ${escapeHtml(worker?.work_number)}   ${escapeHtml(monthName)}</p>
    <table>
      <thead><tr style="background:#e8f5e9; color:#2d6a2d">
        <th style="border:0.5pt solid #2d6a2d">Date</th>
        <th style="border:0.5pt solid #2d6a2d">Start</th>
        <th style="border:0.5pt solid #2d6a2d">Finish</th>
        <th style="border:0.5pt solid #2d6a2d">Eating break</th>
        <th style="border:0.5pt solid #2d6a2d">Extra breaks</th>
        <th style="border:0.5pt solid #2d6a2d">Hours minus breaks</th>
        <th style="border:0.5pt solid #2d6a2d">What was picked up</th>
        <th style="border:0.5pt solid #2d6a2d">Kg picked</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

const PDF_BUILDERS = {
  white: buildWhiteHtml,
  orange: buildOrangeHtml,
  weekly: buildWeeklyHtml,
  green: buildGreenHtml,
};

const PDF_FILENAME_PREFIX = {
  white: 'white-paper',
  orange: 'orange-paper',
  weekly: 'weekly-summary',
  green: 'green-paper',
};

export async function exportPaperPdf(tab, { month, year, worker, entries, greenEntries, daysInMonth }) {
  const monthName = `${MONTH_NAMES[month - 1]} ${year}`;
  const html = PDF_BUILDERS[tab]({ worker, monthName, daysCount: daysInMonth, entries, greenEntries, year, month });
  const { uri } = await Print.printToFileAsync({
    html,
    orientation: tab === 'weekly' ? Print.Orientation.landscape : Print.Orientation.portrait,
  });

  const filename = `${PDF_FILENAME_PREFIX[tab]}-${monthName}-${worker?.work_number || ''}.pdf`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
}

function buildWhiteSheet({ worker, monthName, daysCount, entries, year, month }) {
  return [
    ['WORK PAID BY THE HOUR'],
    ['8 HOURS PER DAY / 40 HOURS PER WEEK'],
    [`Name: ${worker?.full_name || ''}   Work number: ${worker?.work_number || ''}   ${monthName}`],
    [],
    ['Date', 'Start', 'Finish', 'Eating break', 'Hours minus breaks', 'What work'],
    ...Array.from({ length: daysCount }, (_, i) => {
      const day = i + 1;
      const entry = entryFor(entries, year, month, day);
      return [
        day,
        entry?.white_start?.slice(0, 5) || '',
        entry?.white_finish?.slice(0, 5) || '',
        '30 min',
        entry ? entry.white_hours || '8:00' : '',
        entry?.what_work || '',
      ];
    }),
  ];
}

function buildOrangeSheet({ worker, monthName, daysCount, entries, year, month }) {
  return [
    ['EXTRAWORK PAID BY THE HOUR'],
    [`Name: ${worker?.full_name || ''}   Work number: ${worker?.work_number || ''}   ${monthName}`],
    [],
    ['Date', 'Start', 'Finish', 'Break', 'Hours minus breaks', 'What work', 'Signature'],
    ...Array.from({ length: daysCount }, (_, i) => {
      const day = i + 1;
      const entry = entryFor(entries, year, month, day);
      const orange = hasOrangeWork(entry);
      return [
        day,
        orange ? entry.orange_start?.slice(0, 5) || '' : '',
        orange ? entry.orange_finish?.slice(0, 5) || '' : '',
        orange ? entry.orange_break || '0:00' : '',
        orange ? entry.orange_hours || '' : '',
        orange ? entry.what_work || '' : '',
        '',
      ];
    }),
  ];
}

function buildGreenSheet({ worker, monthName, daysCount, greenEntries, year, month }) {
  return [
    ['TIME USED FOR PICKUP, SALARY PAID BY KILOS'],
    [`Name: ${worker?.full_name || ''}   Work number: ${worker?.work_number || ''}   ${monthName}`],
    [],
    ['Date', 'Start', 'Finish', 'Eating break', 'Extra breaks', 'Hours minus breaks', 'What was picked up', 'Kg picked'],
    ...Array.from({ length: daysCount }, (_, i) => {
      const day = i + 1;
      const ge = entryFor(greenEntries, year, month, day);
      return [
        day,
        ge?.start_time?.slice(0, 5) || '',
        ge?.finish_time?.slice(0, 5) || '',
        '1 hour',
        '',
        '',
        ge?.what_picked || '',
        ge?.kg_picked != null ? ge.kg_picked : '',
      ];
    }),
  ];
}

export async function exportPaperExcel(tab, { month, year, worker, entries, greenEntries, daysInMonth }) {
  const monthName = `${MONTH_NAMES[month - 1]} ${year}`;
  const wb = XLSX.utils.book_new();

  if (tab === 'white') {
    const data = buildWhiteSheet({ worker, monthName, daysCount: daysInMonth, entries, year, month });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'White Paper');
  } else if (tab === 'orange') {
    const data = buildOrangeSheet({ worker, monthName, daysCount: daysInMonth, entries, year, month });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Orange Paper');
  } else if (tab === 'weekly') {
    const weeks = getWeekChunks(year, month, daysInMonth);
    weeks.forEach((weekDays, weekIdx) => {
      let totalWorking = 0;
      let totalExtra = 0;
      let totalKg = 0;
      weekDays.forEach((info) => {
        if (!info.exists || info.isSun) return;
        const entry = entryFor(entries, year, month, info.day);
        if (entry) {
          totalWorking += parseHoursToMinutes(entry.white_hours);
          totalExtra += parseHoursToMinutes(entry.orange_hours);
        }
        const ge = entryFor(greenEntries, year, month, info.day);
        if (ge?.kg_picked != null) totalKg += Number(ge.kg_picked) || 0;
      });

      const data = [
        weekIdx === 0 ? ['WEEKLY SUMMARY'] : [],
        weekIdx === 0 ? [`Name: ${worker?.full_name || ''}   Work number: ${worker?.work_number || ''}   ${monthName}`] : [],
        [],
        [`Week ${weekIdx + 1}`],
        ['', ...weekDays.map((info) => (info.exists ? `Day ${info.day}` : '')), 'Total'],
        ['Berry picking (kg)', ...weekDays.map((info) => {
          if (info.isSun) return 'X';
          const ge = entryFor(greenEntries, year, month, info.day);
          return ge?.kg_picked != null ? ge.kg_picked : '';
        }), totalKg > 0 ? Math.round(totalKg * 100) / 100 : ''],
        ['working hrs', ...weekDays.map((info) => {
          if (info.isSun) return 'X';
          const entry = entryFor(entries, year, month, info.day);
          return entry ? entry.white_hours || '8:00' : '';
        }), minsToHHMM(totalWorking)],
        ['extra hrs', ...weekDays.map((info) => {
          if (info.isSun) return 'X';
          const entry = entryFor(entries, year, month, info.day);
          return entry ? entry.orange_hours : '';
        }), minsToHHMM(totalExtra)],
        ['yes, I want to work extra hours   Signature: _______________________'],
        [],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), `Week ${weekIdx + 1}`);
    });
  } else if (tab === 'green') {
    const data = buildGreenSheet({ worker, monthName, daysCount: daysInMonth, greenEntries, year, month });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Green Paper');
  }

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = `${PDF_FILENAME_PREFIX[tab]}-${monthName}-${worker?.work_number || ''}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: filename,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

function buildWorkLogHtml({ worker, session, logs, dateLabel }) {
  const rows = logs.map((r) => {
    const c = GROUP_COLORS[r.house_group] || GROUP_COLORS.Unknown;
    return `<tr style="background:${c.bg}">
      <td style="border:0.5pt solid #999"><b>${escapeHtml(r.worker_number)}</b></td>
      <td style="border:0.5pt solid #999; text-align:left">${escapeHtml(r.worker_name)}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.house_group)}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.start_time?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.finish_time?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #999">${escapeHtml((r.total_break_mins || 0) + ' min')}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.white_hours)}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.orange_hours)}</td>
      <td style="border:0.5pt solid #999"><b>${escapeHtml(r.total_hours)}</b></td>
      <td style="border:0.5pt solid #999; text-align:left">${escapeHtml(r.what_work)}</td>
    </tr>`;
  }).join('');

  return `<html><head><style>${BASE_STYLE}</style></head><body>
    <h1>Work Log</h1>
    <p>Supervisor: ${escapeHtml(worker?.full_name)}   Date: ${escapeHtml(dateLabel)}   Total break: ${session?.total_break_mins || 0} min</p>
    <table>
      <thead><tr style="background:#2d6a2d; color:#fff">
        <th style="border:0.5pt solid #999">Work#</th>
        <th style="border:0.5pt solid #999">Name</th>
        <th style="border:0.5pt solid #999">Group</th>
        <th style="border:0.5pt solid #999">Start</th>
        <th style="border:0.5pt solid #999">Finish</th>
        <th style="border:0.5pt solid #999">Break</th>
        <th style="border:0.5pt solid #999">White hrs</th>
        <th style="border:0.5pt solid #999">Orange hrs</th>
        <th style="border:0.5pt solid #999">Total hrs</th>
        <th style="border:0.5pt solid #999">Work done</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

export async function exportWorkLogPdf({ worker, session, logs, dateLabel }) {
  const html = buildWorkLogHtml({ worker, session, logs, dateLabel });
  const { uri } = await Print.printToFileAsync({ html, orientation: Print.Orientation.landscape });
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `worklog-${dateStr}.pdf`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
}

function buildWorkLogSheet({ worker, session, logs, dateLabel }) {
  return [
    ['Work Log'],
    [`Supervisor: ${worker?.full_name || ''}   Date: ${dateLabel}   Break: ${session?.total_break_mins || 0} min`],
    [],
    ['Work#', 'Name', 'Group', 'Start', 'Finish', 'Break', 'White hrs', 'Orange hrs', 'Total hrs', 'Work done'],
    ...logs.map((r) => [
      r.worker_number,
      r.worker_name || '',
      r.house_group,
      r.start_time?.slice(0, 5) || '',
      r.finish_time?.slice(0, 5) || '',
      (r.total_break_mins || 0) + ' min',
      r.white_hours || '',
      r.orange_hours || '',
      r.total_hours || '',
      r.what_work || '',
    ]),
  ];
}

export async function exportWorkLogExcel({ worker, session, logs, dateLabel }) {
  const wb = XLSX.utils.book_new();
  const data = buildWorkLogSheet({ worker, session, logs, dateLabel });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Work Log');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `worklog-${dateStr}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: filename,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

function sanitizeFilenamePart(s) {
  return String(s || '').replace(/[^a-z0-9]/gi, '-');
}

function buildHousemasterWorklogHtml({ worklog, logs, dateLabel }) {
  const rows = logs.map((r, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#fafaf8';
    return `<tr style="background:${bg}">
      <td style="border:0.5pt solid #999"><b>${escapeHtml(r.worker_number)}</b></td>
      <td style="border:0.5pt solid #999; text-align:left">${escapeHtml(r.worker_name)}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.start_time?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.finish_time?.slice(0, 5))}</td>
      <td style="border:0.5pt solid #999">${escapeHtml(r.total_break_mins > 0 ? r.total_break_mins + ' min' : '')}</td>
      <td style="border:0.5pt solid #999"><b>${escapeHtml(r.total_hours)}</b></td>
      <td style="border:0.5pt solid #999; text-align:left">${escapeHtml(r.what_work)}</td>
    </tr>`;
  }).join('');

  return `<html><head><style>${BASE_STYLE}</style></head><body>
    <h1>${escapeHtml(worklog.house_group)} — Work Log</h1>
    <p>${escapeHtml(dateLabel)}   |   ${logs.length} worker${logs.length !== 1 ? 's' : ''}</p>
    <table>
      <thead><tr style="background:#2d6a2d; color:#fff">
        <th style="border:0.5pt solid #999">Work#</th>
        <th style="border:0.5pt solid #999">Name</th>
        <th style="border:0.5pt solid #999">Start</th>
        <th style="border:0.5pt solid #999">Finish</th>
        <th style="border:0.5pt solid #999">Break</th>
        <th style="border:0.5pt solid #999">Total hrs</th>
        <th style="border:0.5pt solid #999">Work done</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

export async function exportHousemasterWorklogPdf({ worklog, logs, dateLabel }) {
  const html = buildHousemasterWorklogHtml({ worklog, logs, dateLabel });
  const { uri } = await Print.printToFileAsync({ html, orientation: Print.Orientation.landscape });
  const dateStr = String(worklog.session_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const filename = `worklog-${sanitizeFilenamePart(worklog.house_group)}-${dateStr}.pdf`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
}

function buildHousemasterWorklogSheet({ worklog, logs, dateLabel }) {
  return [
    [`${worklog.house_group} — Work Log`],
    [`${dateLabel}   |   ${logs.length} worker${logs.length !== 1 ? 's' : ''}`],
    [],
    ['Work#', 'Name', 'Start', 'Finish', 'Break', 'Total hrs', 'Work done'],
    ...logs.map((r) => [
      r.worker_number || '',
      r.worker_name || '',
      r.start_time?.slice(0, 5) || '',
      r.finish_time?.slice(0, 5) || '',
      r.total_break_mins > 0 ? `${r.total_break_mins} min` : '',
      r.total_hours || '',
      r.what_work || '',
    ]),
  ];
}

export async function exportHousemasterWorklogExcel({ worklog, logs, dateLabel }) {
  const wb = XLSX.utils.book_new();
  const data = buildHousemasterWorklogSheet({ worklog, logs, dateLabel });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Work Log');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const dateStr = String(worklog.session_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const filename = `worklog-${sanitizeFilenamePart(worklog.house_group)}-${dateStr}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: filename,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}
