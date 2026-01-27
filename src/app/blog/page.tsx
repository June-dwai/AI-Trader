
import { supabaseAdmin } from '@/lib/supabase';
import { format } from 'date-fns';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

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

                {/* Posts */}
                <div className="space-y-8">
                    {posts.length === 0 ? (
                        <p className="text-gray-500 text-center py-20">No posts yet. Wait for the daily close.</p>
                    ) : (
                        posts.map((post: any) => (
                            <article key={post.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-blue-500/30 transition-colors">
                                <div className="text-sm text-gray-500 mb-2">
                                    {format(new Date(post.created_at), 'MMMM d, yyyy')}
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-6">{post.title}</h2>
                                <div className="prose prose-invert max-w-none text-gray-300">
                                    <ReactMarkdown>{post.content}</ReactMarkdown>
                                </div>
                            </article>
                        ))
                    )}
                </div>

            </div>
        </main>
    );
}
