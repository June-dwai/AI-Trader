import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: openTrades, error } = await supabaseAdmin
            .from('trades')
            .select('*')
            .eq('status', 'OPEN')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, trades: openTrades || [] });
    } catch (error) {
        console.error('Fetch trades error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
