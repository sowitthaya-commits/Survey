import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/authHelper';

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
