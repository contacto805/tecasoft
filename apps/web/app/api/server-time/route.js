import { NextResponse } from 'next/server';
import { getMexicoCityTime } from '@/app/api/utils/mexico-time';

export async function GET() {
  try {
    const mx = getMexicoCityTime();
    return NextResponse.json({
      ...mx,
      label: 'Ciudad de México',
      tz: 'America/Mexico_City'
    });
  } catch (_) {
    const now = new Date();
    return NextResponse.json({
      date: now.toISOString().slice(0,10),
      time: now.toTimeString().slice(0,8),
      dateTime: now.toISOString(),
      timestamp: now.toISOString(),
      week: 1,
      label: 'Ciudad de México',
      tz: 'America/Mexico_City'
    });
  }
}
