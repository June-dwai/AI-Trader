
import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import BlogList from '@/components/BlogList';

export const dynamic = 'force-dynamic';

async function getPosts() {
    const { data } = await supabaseAdmin
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
    return data || [];
}

export default async function BlogPage() {
    const posts = await getPosts();

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex justify-between items-center border-b border-gray-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                            Alpha Log
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Daily Trading Journal & AI Analysis</p>
                    </div>
                    <Link href="/" className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm hover:bg-gray-800 transition-colors">
                        Back to Dashboard
                    </Link>
                </div>

                {/* Client Component for Posts */}
                <BlogList posts={posts} />

            </div>
        </main>
    );
}
