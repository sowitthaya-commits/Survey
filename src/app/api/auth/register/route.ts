import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/authHelper';

export async function POST(request: Request) {
  try {
    const { username, password, name, position } = await request.json();

    if (!username || !password || !name || !position) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง' }, { status: 400 });
    }

    // Check if username already exists
    const exists = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    if (exists) {
      return NextResponse.json({ error: 'Username นี้ถูกใช้งานไปแล้ว' }, { status: 400 });
    }

    // Hash password with SHA-256
    const hashedPassword = hashPassword(password);

    // Insert user into Turso DB
    await db.insert(users).values({
      username,
      password: hashedPassword,
      name,
      position,
      role: 'User', // Default role for new signups
      active: 1,
      vacationQuota: 12.0
    });

    return NextResponse.json({ success: true, message: 'ลงทะเบียนสมาชิกสำเร็จ' });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' }, { status: 500 });
  }
}
