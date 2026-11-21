import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDuration } from '../data/defaultData';
import type { WorkoutSession } from '../types/bike';

function formatItalianDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSingleWorkoutPdf(workout: WorkoutSession): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Deep navy header banner
  doc.setFillColor(12, 26, 46);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 35, pageWidth, 1.2, 'F');

  doc.setTextColor(232, 240, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('BIKEAWARE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 172, 200);
  doc.text('Report Dettagliato Allenamento Cyclette', 14, 22);
  doc.text(formatItalianDate(workout.dateIso), 14, 29);

  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(workout.programName || 'Sessione Libera', pageWidth - 14, 22, { align: 'right' });

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(workout.title, 14, 48);

  // Summary metrics table
  autoTable(doc, {
    startY: 54,
    head: [['Metrica', 'Valore Medio / Totale', 'Valore Massimo / Dettaglio']],
    body: [
      ['Durata sessione', formatDuration(workout.durationSec), `${Math.round(workout.durationSec / 60)} min`],
      ['Distanza percorsa', `${workout.distanceKm.toFixed(2)} km`, workout.source === 'bluetooth' ? 'Sensore Bluetooth' : 'Simulatore BLE'],
      ['Potenza', `${workout.avgPowerWatts} W`, `Picco ${workout.maxPowerWatts} W`],
      ['Velocità', `${workout.avgSpeedKmh.toFixed(1)} km/h`, `Max ${workout.maxSpeedKmh.toFixed(1)} km/h`],
      ['Cadenza', `${workout.avgCadenceRpm} RPM`, `Resistenza media lv. ${workout.avgResistance}`],
      ['Frequenza cardiaca', workout.avgHeartRateBpm > 0 ? `${workout.avgHeartRateBpm} BPM` : 'N/D', workout.maxHeartRateBpm > 0 ? `Max ${workout.maxHeartRateBpm} BPM` : 'N/D'],
      ['Energia bruciata', `${workout.caloriesKcal} kcal`, workout.syncedToSheets ? 'Archiviato su Google Sheets' : 'Archivio locale'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [19, 38, 66], textColor: [232, 240, 250], fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 3.2 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 125;

  if (workout.notes?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Note della sessione', 14, afterSummaryY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(workout.notes.trim(), pageWidth - 28);
    doc.text(wrapped, 14, afterSummaryY + 16);
  }

  // Sampled telemetry checkpoints
  if (workout.samples.length > 0) {
    const stride = Math.max(1, Math.ceil(workout.samples.length / 18));
    const sampled = workout.samples.filter((_, idx) => idx % stride === 0).slice(0, 18);

    const startSamplesY = workout.notes?.trim() ? afterSummaryY + 28 : afterSummaryY + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Campionamento Telemetria', 14, startSamplesY);

    autoTable(doc, {
      startY: startSamplesY + 4,
      head: [['Tempo', 'Potenza (W)', 'Cadenza (RPM)', 'Velocità (km/h)', 'FC (BPM)', 'Resistenza', 'Dist. (km)']],
      body: sampled.map((s) => [
        formatDuration(s.elapsedSec),
        String(s.powerWatts),
        String(s.cadenceRpm),
        s.speedKmh.toFixed(1),
        s.heartRateBpm > 0 ? String(s.heartRateBpm) : '-',
        String(s.resistanceLevel),
        s.distanceKm.toFixed(2),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [12, 26, 46], textColor: [232, 240, 250], fontSize: 8.5 },
      styles: { fontSize: 8.2, halign: 'right', cellPadding: 2.2 },
      columnStyles: { 0: { halign: 'left' } },
    });
  }

  const safeDate = workout.dateIso.slice(0, 10);
  doc.save(`Bikeaware_Report_${safeDate}_${workout.id.slice(-4)}.pdf`);
}

export function exportHistorySummaryPdf(workouts: WorkoutSession[], periodLabel: string): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(12, 26, 46);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 29, pageWidth, 1.2, 'F');

  doc.setTextColor(232, 240, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('BIKEAWARE — Report Riepilogativo Allenamenti', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 172, 200);
  doc.text(
    `Periodo: ${periodLabel} · Sessioni incluse: ${workouts.length} · Generato il ${new Date().toLocaleDateString('it-IT')}`,
    14,
    22
  );

  const totalDist = workouts.reduce((a, w) => a + w.distanceKm, 0);
  const totalDur = workouts.reduce((a, w) => a + w.durationSec, 0);
  const totalKcal = workouts.reduce((a, w) => a + w.caloriesKcal, 0);
  const avgPower =
    workouts.length > 0
      ? Math.round(workouts.reduce((a, w) => a + w.avgPowerWatts, 0) / workouts.length)
      : 0;

  autoTable(doc, {
    startY: 36,
    head: [['Sessioni', 'Distanza Totale', 'Tempo Totale', 'Potenza Media', 'Calorie Totali']],
    body: [
      [
        String(workouts.length),
        `${totalDist.toFixed(1)} km`,
        formatDuration(totalDur),
        `${avgPower} W`,
        `${totalKcal} kcal`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [19, 38, 66], textColor: [232, 240, 250] },
    styles: { fontSize: 10, fontStyle: 'bold', halign: 'center' },
  });

  const afterKpiY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;

  autoTable(doc, {
    startY: afterKpiY + 8,
    head: [
      [
        'Data',
        'Allenamento',
        'Durata',
        'Distanza',
        'Vel. Media',
        'Potenza (Med/Max)',
        'Cadenza',
        'FC Media',
        'Calorie',
      ],
    ],
    body: workouts.map((w) => [
      new Date(w.dateIso).toLocaleDateString('it-IT'),
      w.title,
      formatDuration(w.durationSec),
      `${w.distanceKm.toFixed(1)} km`,
      `${w.avgSpeedKmh.toFixed(1)} km/h`,
      `${w.avgPowerWatts} / ${w.maxPowerWatts} W`,
      `${w.avgCadenceRpm} RPM`,
      w.avgHeartRateBpm > 0 ? `${w.avgHeartRateBpm} BPM` : '-',
      `${w.caloriesKcal} kcal`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [12, 26, 46], textColor: [232, 240, 250], fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2.6 },
  });

  doc.save(`Bikeaware_Cronologia_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Valid Garmin TCX XML export compatible with Strava and Google Fit / Health Connect importers
export function buildWorkoutTcxXml(workout: WorkoutSession): string {
  const startIso = new Date(workout.dateIso).toISOString();
  const trackpoints = workout.samples
    .map((pt) => {
      const ptIso = new Date(new Date(workout.dateIso).getTime() + pt.elapsedSec * 1000).toISOString();
      return `          <Trackpoint>
            <Time>${ptIso}</Time>
            <DistanceMeters>${(pt.distanceKm * 1000).toFixed(1)}</DistanceMeters>
            ${
              pt.heartRateBpm > 0
                ? `<HeartRateBpm><Value>${Math.round(pt.heartRateBpm)}</Value></HeartRateBpm>`
                : ''
            }
            <Cadence>${Math.round(pt.cadenceRpm)}</Cadence>
            <Extensions>
              <ns3:TPX xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <ns3:Speed>${(pt.speedKmh / 3.6).toFixed(2)}</ns3:Speed>
                <ns3:Watts>${Math.round(pt.powerWatts)}</ns3:Watts>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startIso}</Id>
      <Notes>${escapeXml(workout.title + (workout.notes ? ' — ' + workout.notes : ''))}</Notes>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${workout.durationSec}</TotalTimeSeconds>
        <DistanceMeters>${(workout.distanceKm * 1000).toFixed(1)}</DistanceMeters>
        <Calories>${Math.round(workout.caloriesKcal)}</Calories>
        <AverageHeartRateBpm><Value>${Math.round(workout.avgHeartRateBpm || 120)}</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>${Math.round(workout.maxHeartRateBpm || 140)}</Value></MaximumHeartRateBpm>
        <Intensity>Active</Intensity>
        <Cadence>${Math.round(workout.avgCadenceRpm)}</Cadence>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

export function exportWorkoutTcx(workout: WorkoutSession): void {
  const xml = buildWorkoutTcxXml(workout);
  const blob = new Blob([xml], { type: 'application/vnd.garmin.tcx+xml;charset=utf-8' });
  downloadBlob(blob, `Bikeaware_${workout.dateIso.slice(0, 10)}_${workout.id.slice(-4)}.tcx`);
}

export function exportWorkoutsCsv(workouts: WorkoutSession[]): void {
  const header = [
    'Data',
    'Titolo',
    'Programma',
    'Durata_Sec',
    'Distanza_Km',
    'Velocita_Media_Kmh',
    'Potenza_Media_W',
    'Potenza_Max_W',
    'Cadenza_Media_RPM',
    'FC_Media_BPM',
    'Calorie_Kcal',
    'Note',
  ];
  const rows = workouts.map((w) => [
    w.dateIso,
    `"${w.title.replace(/"/g, '""')}"`,
    `"${w.programName.replace(/"/g, '""')}"`,
    w.durationSec,
    w.distanceKm.toFixed(2),
    w.avgSpeedKmh.toFixed(1),
    w.avgPowerWatts,
    w.maxPowerWatts,
    w.avgCadenceRpm,
    w.avgHeartRateBpm,
    w.caloriesKcal,
    `"${w.notes.replace(/"/g, '""')}"`,
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `Bikeaware_Allenamenti_${new Date().toISOString().slice(0, 10)}.csv`);
}
