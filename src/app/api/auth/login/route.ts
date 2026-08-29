import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, setSession } from '@/lib/authHelper';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอก Username และ Password' }, { status: 400 });
    }

    // Query user from Turso DB (case-insensitive lookup matching original app)
    const user = await db.select()
      .from(users)
      .where(eq(sql`lower(${users.username})`, username.toLowerCase()))
      .get();

    if (!user) {
      return NextResponse.json({ error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 });
    }

    // Hash input password with SHA-256 and compare
    const hashed = hashPassword(password);
    if (user.password !== hashed) {
      return NextResponse.json({ error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 });
    }

    // Set cookie session
    await setSession({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      position: user.position
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        position: user.position
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' }, { status: 500 });
  }
}
